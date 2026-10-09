import hashlib

F4_CONTENT = '''#!/usr/bin/env python3
"""
S-01b experiment: Navamsha temporary friendship, Option A vs Option B.

Question (Gate S-01b)
    For Navamsha (D-9) compound dignity, is Tatkalika (temporary) friendship measured
    from the D-1/Rashi signs (Option A) or from the D-9/Navamsha signs (Option B)?

What this script does
    Reads PRINTED values only from a reference JSON (v1.4-style schema):
        PLANETS[p].sign            printed D-1 sign
        NAVAMSHA[p].sign           printed D-9 sign
        NAVAMSHA[p].dignity        printed D-9 dignity
    For each of the seven classical planets it derives the D-9 dignity under both options and
    compares them with the printed dignity.

What this script refuses to do
    * It never recomputes positions from longitudes (Gate T-10: the reference longitudes are
      0.26-0.50 deg off the engine, and a Navamsha is only 3 deg 20 min wide).
    * It never infers, defaults or repairs a missing / unrecognised value.
    * It never forces a winner. Possible results:
          OPTION_A_SUPPORTED | OPTION_B_SUPPORTED | BOTH_INCONCLUSIVE | REFERENCE_DATA_INCOMPLETE
    * Rahu / Ketu are NOT evaluated: their dignity convention (Gate S-01c) is unresolved.

Authority
    The reference JSON is non-authoritative evidence (Master Contract section 0). A result here
    informs an operator decision on a contract gap; it never changes the engine. If the JSON
    conflicts with a settled contract rule, record VALIDATION_MISMATCH, do not alter the engine.

Rule sources (all contract-derived; no PyJHora code is copied - AGPL, handoff section 7)
    * Natural friendship table: Master Contract v1.6 section 9.2.
    * Exaltation / debilitation / own signs: classical; Master Contract section 3.3 gotchas
      (Moon exalted in Taurus only, Mercury exalted in Virgo only, Jupiter exalted in Cancer).
    * Sign lords: fixed (Mars = Scorpio, Saturn = Aquarius), as in SIGN_LORDS.
    * Temporary friendship: the other planet is in the 2nd, 3rd, 4th, 10th, 11th or 12th sign
      from this planet's sign (offsets 1,2,3,9,10,11); otherwise temporary enemy.
    * Compound (five-fold): Nat F + Temp F = Grt.Friend; Nat N + Temp F = Friend;
      Nat F + Temp E or Nat E + Temp F = Neutral; Nat N + Temp E = Enemy; Nat E + Temp E = Grt.Enemy.
    * Moolatrikona is a degree range inside a sign and is indistinguishable at sign level, so
      printed "Moolatrikona" is compared as "Own" (every moolatrikona sign is also an own or
      exaltation sign).

Usage
    python3 s01b_navamsha_friendship_experiment.py REFERENCE.json [--json]
    python3 s01b_navamsha_friendship_experiment.py --selftest

Exit codes: 0 supported, 1 inconclusive, 2 reference data incomplete, 3 usage / unreadable file.
"""

import argparse
import json
import sys

SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
         "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]
PLANETS7 = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"]

LORD = {"Aries": "Mars", "Taurus": "Venus", "Gemini": "Mercury", "Cancer": "Moon",
        "Leo": "Sun", "Virgo": "Mercury", "Libra": "Venus", "Scorpio": "Mars",
        "Sagittarius": "Jupiter", "Capricorn": "Saturn", "Aquarius": "Saturn", "Pisces": "Jupiter"}

EXALT = {"Sun": "Aries", "Moon": "Taurus", "Mars": "Capricorn", "Mercury": "Virgo",
         "Jupiter": "Cancer", "Venus": "Pisces", "Saturn": "Libra"}
DEBIL = {"Sun": "Libra", "Moon": "Scorpio", "Mars": "Cancer", "Mercury": "Pisces",
         "Jupiter": "Capricorn", "Venus": "Virgo", "Saturn": "Aries"}
OWN = {"Sun": {"Leo"}, "Moon": {"Cancer"}, "Mars": {"Aries", "Scorpio"},
       "Mercury": {"Gemini", "Virgo"}, "Jupiter": {"Sagittarius", "Pisces"},
       "Venus": {"Taurus", "Libra"}, "Saturn": {"Capricorn", "Aquarius"}}

# Master Contract v1.6 section 9.2 - Natural Planetary Friendship Table.
NATURAL = {
    "Sun":     {"F": {"Moon", "Mars", "Jupiter"}, "N": {"Mercury"}, "E": {"Venus", "Saturn"}},
    "Moon":    {"F": {"Sun", "Mercury"}, "N": {"Mars", "Jupiter", "Venus", "Saturn"}, "E": set()},
    "Mars":    {"F": {"Sun", "Moon", "Jupiter"}, "N": {"Venus", "Saturn"}, "E": {"Mercury"}},
    "Mercury": {"F": {"Sun", "Venus"}, "N": {"Mars", "Jupiter", "Saturn"}, "E": {"Moon"}},
    "Jupiter": {"F": {"Sun", "Moon", "Mars"}, "N": {"Saturn"}, "E": {"Mercury", "Venus"}},
    "Venus":   {"F": {"Mercury", "Saturn"}, "N": {"Mars", "Jupiter"}, "E": {"Sun", "Moon"}},
    "Saturn":  {"F": {"Mercury", "Venus"}, "N": {"Jupiter"}, "E": {"Sun", "Moon", "Mars"}},
}

TEMP_FRIEND_OFFSETS = {1, 2, 3, 9, 10, 11}

COMPOUND = {("F", "F"): "Grt.Friend", ("N", "F"): "Friend",
            ("F", "E"): "Neutral", ("E", "F"): "Neutral",
            ("N", "E"): "Enemy", ("E", "E"): "Grt.Enemy"}

CANONICAL_DIGNITIES = ["Exalted", "Own", "Moolatrikona", "Grt.Friend", "Friend",
                       "Neutral", "Enemy", "Grt.Enemy", "Debilitated"]
_DIGNITY_LOOKUP = {d.lower(): d for d in CANONICAL_DIGNITIES}
_SIGN_LOOKUP = {s.lower(): s for s in SIGNS}

RESULTS = ("OPTION_A_SUPPORTED", "OPTION_B_SUPPORTED", "BOTH_INCONCLUSIVE", "REFERENCE_DATA_INCOMPLETE")


# ----------------------------------------------------------------------------------------
# Dignity model
# ----------------------------------------------------------------------------------------

def natural_relation(planet, other):
    row = NATURAL[planet]
    for key in ("F", "N", "E"):
        if other in row[key]:
            return key
    raise ValueError("no natural relation for %s -> %s" % (planet, other))


def dignity_in_sign(planet, sign, planet_sign_for_temp, lord_sign_for_temp):
    """Dignity of `planet` in `sign`.

    planet_sign_for_temp / lord_sign_for_temp are the sign INDEXES (0-11) used to measure temporary
    friendship between the planet and the lord of `sign`. They are the only thing that differs
    between Option A (D-1 signs) and Option B (D-9 signs).
    """
    if sign == EXALT[planet]:
        return "Exalted"
    if sign == DEBIL[planet]:
        return "Debilitated"
    if sign in OWN[planet]:
        return "Own"
    lord = LORD[sign]
    nat = natural_relation(planet, lord)
    offset = (lord_sign_for_temp - planet_sign_for_temp) % 12
    temp = "F" if offset in TEMP_FRIEND_OFFSETS else "E"
    return COMPOUND[(nat, temp)]


def navamsha_dignity(planet, d1, d9, option):
    """Printed-sign-only derivation of the planet's D-9 dignity under option 'A' or 'B'."""
    sign9 = d9[planet]
    lord = LORD[sign9]
    if option == "A":
        p_idx, l_idx = SIGNS.index(d1[planet]), SIGNS.index(d1[lord])
    elif option == "B":
        p_idx, l_idx = SIGNS.index(d9[planet]), SIGNS.index(d9[lord])
    else:
        raise ValueError(option)
    return dignity_in_sign(planet, sign9, p_idx, l_idx)


def own_class(d):
    """Moolatrikona is not distinguishable from Own at sign level."""
    return "Own" if d == "Moolatrikona" else d


# ----------------------------------------------------------------------------------------
# Input handling - refuses to guess
# ----------------------------------------------------------------------------------------

def extract_printed(doc):
    """Return (printed, problems). printed = {planet: {d1, d9, dignity}} for the 7 planets.
    Any missing / NOT_FOUND / unrecognised value is a problem; nothing is defaulted."""
    problems = []
    if isinstance(doc, dict) and "PLANETS" not in doc and isinstance(doc.get("data"), dict):
        doc = doc["data"]
    if not isinstance(doc, dict):
        return None, ["top-level JSON value is not an object"]
    planets, nav = doc.get("PLANETS"), doc.get("NAVAMSHA")
    if not isinstance(planets, dict):
        problems.append("PLANETS block missing or not an object")
    if not isinstance(nav, dict):
        problems.append("NAVAMSHA block missing or not an object")
    if problems:
        return None, problems
    if nav.get("_available") is False:
        problems.append("NAVAMSHA._available is false (D-9 not present in the reference)")

    printed = {}
    for p in PLANETS7:
        pe, ne = planets.get(p), nav.get(p)
        if not isinstance(pe, dict):
            problems.append("PLANETS.%s missing" % p)
            continue
        if not isinstance(ne, dict):
            problems.append("NAVAMSHA.%s missing" % p)
            continue
        d1_raw, d9_raw, dg_raw = pe.get("sign"), ne.get("sign"), ne.get("dignity")
        d1 = _SIGN_LOOKUP.get(d1_raw.strip().lower()) if isinstance(d1_raw, str) else None
        d9 = _SIGN_LOOKUP.get(d9_raw.strip().lower()) if isinstance(d9_raw, str) else None
        dg = _DIGNITY_LOOKUP.get(dg_raw.strip().lower()) if isinstance(dg_raw, str) else None
        if d1 is None:
            problems.append("PLANETS.%s.sign unusable: %r" % (p, d1_raw))
        if d9 is None:
            problems.append("NAVAMSHA.%s.sign unusable: %r" % (p, d9_raw))
        if dg is None:
            problems.append("NAVAMSHA.%s.dignity unusable: %r" % (p, dg_raw))
        if d1 and d9 and dg:
            printed[p] = {"d1": d1, "d9": d9, "dignity": dg}
    if problems:
        return None, problems
    return printed, []


# ----------------------------------------------------------------------------------------
# Experiment
# ----------------------------------------------------------------------------------------

def run_experiment(doc):
    printed, problems = extract_printed(doc)
    if problems:
        return {"result": "REFERENCE_DATA_INCOMPLETE", "problems": problems, "rows": [],
                "discriminating": [], "baseline_mismatches": [], "notes": []}

    d1 = {p: printed[p]["d1"] for p in PLANETS7}
    d9 = {p: printed[p]["d9"] for p in PLANETS7}
    rows, disc, baseline = [], [], []
    notes = ["Rahu/Ketu not evaluated (Gate S-01c unresolved).",
             "Single-chart evidence: a SUPPORTED result is not a universal rule."]

    for p in PLANETS7:
        a, b = navamsha_dignity(p, d1, d9, "A"), navamsha_dignity(p, d1, d9, "B")
        pr = own_class(printed[p]["dignity"])
        if printed[p]["dignity"] == "Moolatrikona":
            notes.append("%s printed 'Moolatrikona' compared as 'Own' (sign level)." % p)
        if a == b:
            kind = "same"
            if a != pr:
                baseline.append(p)
        else:
            kind = "discriminating"
            disc.append(p)
        rows.append({"planet": p, "d1": d1[p], "d9": d9[p], "printed": printed[p]["dignity"],
                     "A": a, "B": b, "kind": kind,
                     "matches": [o for o, v in (("A", a), ("B", b)) if v == pr]})

    if baseline:
        result = "BOTH_INCONCLUSIVE"
        notes.append("Baseline dignity model disagrees with the printed D-9 dignity on non-"
                     "discriminating planet(s) %s, so the premise of the comparison fails "
                     "(check own/exaltation tables, sign-lord rules, Moolatrikona)." % baseline)
    elif not disc:
        result = "BOTH_INCONCLUSIVE"
        notes.append("Options A and B give identical dignities for every planet on this chart.")
    else:
        by = {r["planet"]: r for r in rows}
        if all("A" in by[p]["matches"] for p in disc):
            result = "OPTION_A_SUPPORTED"
        elif all("B" in by[p]["matches"] for p in disc):
            result = "OPTION_B_SUPPORTED"
        else:
            result = "BOTH_INCONCLUSIVE"
            notes.append("Printed dignities on discriminating planets are mixed or match neither option.")
    return {"result": result, "problems": [], "rows": rows, "discriminating": disc,
            "baseline_mismatches": baseline, "notes": notes}


def render(report):
    out = []
    if report["problems"]:
        out.append("REFERENCE DATA PROBLEMS (nothing was inferred or defaulted):")
        out += ["  - " + m for m in report["problems"]]
    else:
        out.append("%-8s %-12s %-12s %-12s %-11s %-11s %s" %
                   ("Planet", "D-1 sign", "D-9 sign", "Printed", "Option A", "Option B", "Note"))
        for r in report["rows"]:
            note = ("discriminating: matches " + ("/".join(r["matches"]) or "NEITHER")
                    if r["kind"] == "discriminating"
                    else ("same under A and B" + ("" if r["matches"] else " - DISAGREES with printed")))
            out.append("%-8s %-12s %-12s %-12s %-11s %-11s %s" %
                       (r["planet"], r["d1"], r["d9"], r["printed"], r["A"], r["B"], note))
    out += ["- " + n for n in report["notes"]]
    out.append("RESULT: " + report["result"])
    return "\n".join(out)


EXIT = {"OPTION_A_SUPPORTED": 0, "OPTION_B_SUPPORTED": 0, "BOTH_INCONCLUSIVE": 1,
        "REFERENCE_DATA_INCOMPLETE": 2}


# ----------------------------------------------------------------------------------------
# Self-test (synthetic data only; hand-checked anchors, then verdict logic)
# ----------------------------------------------------------------------------------------

def _chart(d1, d9, printed):
    return {"PLANETS": {p: {"sign": d1[p]} for p in PLANETS7},
            "NAVAMSHA": dict({"_available": True},
                             **{p: {"sign": d9[p], "dignity": printed[p]} for p in PLANETS7})}


def selftest():
    # 0. Tables are well-formed: every planet's natural row partitions the other six planets.
    for p in PLANETS7:
        row = NATURAL[p]
        others = set(PLANETS7) - {p}
        assert row["F"] | row["N"] | row["E"] == others, p
        assert not (row["F"] & row["N"] or row["F"] & row["E"] or row["N"] & row["E"]), p
        assert EXALT[p] != DEBIL[p] and DEBIL[p] not in OWN[p], p

    # 1. Hand-checked anchors (idx: Aries=0 ... Pisces=11).
    ix = SIGNS.index
    # Saturn in Pisces, Saturn's own sign Pisces(11), lord Jupiter in Cancer(3): nat Neutral,
    # offset (3-11)%12 = 4 -> temp Enemy -> Enemy. (Reference-chart observation, Gate S-01.)
    assert dignity_in_sign("Saturn", "Pisces", ix("Pisces"), ix("Cancer")) == "Enemy"
    assert dignity_in_sign("Moon", "Cancer", 0, 0) == "Own"          # not Exalted (contract 3.3)
    assert dignity_in_sign("Mercury", "Gemini", 0, 0) == "Own"       # not Exalted
    assert dignity_in_sign("Mercury", "Virgo", 0, 0) == "Exalted"    # exalted wins over own
    assert dignity_in_sign("Moon", "Taurus", 0, 0) == "Exalted"      # exalted wins over moolatrikona
    assert dignity_in_sign("Jupiter", "Cancer", 0, 0) == "Exalted"
    assert dignity_in_sign("Sun", "Libra", 0, 0) == "Debilitated"
    # Venus in Leo (lord Sun): nat Venus->Sun = Enemy. Temp Friend (offset 1) -> Neutral;
    # Temp Enemy (offset 0) -> Grt.Enemy.
    assert dignity_in_sign("Venus", "Leo", ix("Taurus"), ix("Gemini")) == "Neutral"
    assert dignity_in_sign("Venus", "Leo", ix("Leo"), ix("Leo")) == "Grt.Enemy"
    # Temporary friendship for every offset 0..11, written out by hand (classical rule: planets in the
    # 2nd,3rd,4th,10th,11th,12th sign from a planet are temporary friends; 1st,5th-9th are enemies).
    # Saturn -> Jupiter is naturally Neutral, so temp Friend => "Friend" and temp Enemy => "Enemy".
    hand = ["Enemy",   # 0  same sign (1st)
            "Friend",  # 1  2nd
            "Friend",  # 2  3rd
            "Friend",  # 3  4th
            "Enemy",   # 4  5th
            "Enemy",   # 5  6th
            "Enemy",   # 6  7th
            "Enemy",   # 7  8th
            "Enemy",   # 8  9th
            "Friend",  # 9  10th
            "Friend",  # 10 11th
            "Friend"]  # 11 12th
    for off in range(12):
        got = dignity_in_sign("Saturn", "Pisces", 0, off)   # Pisces lord = Jupiter; planet sign index 0
        assert got == hand[off], (off, got, hand[off])
    # Compound table, all six combinations.
    assert COMPOUND[("F", "F")] == "Grt.Friend" and COMPOUND[("E", "E")] == "Grt.Enemy"
    assert COMPOUND[("E", "F")] == COMPOUND[("F", "E")] == "Neutral"

    # 2. Synthetic chart where Options A and B differ (hand-derived).
    d1 = dict(Sun="Gemini", Moon="Cancer", Mars="Leo", Mercury="Virgo",
              Jupiter="Sagittarius", Venus="Taurus", Saturn="Aquarius")
    d9 = dict(Sun="Leo", Moon="Taurus", Mars="Aries", Mercury="Gemini",
              Jupiter="Cancer", Venus="Leo", Saturn="Pisces")
    # Venus: D-9 Leo, lord Sun. A: Venus D-1 Taurus(1), Sun D-1 Gemini(2), offset 1 -> Neutral.
    #                         B: Venus D-9 Leo(4), Sun D-9 Leo(4), offset 0 -> Grt.Enemy.
    assert navamsha_dignity("Venus", d1, d9, "A") == "Neutral"
    assert navamsha_dignity("Venus", d1, d9, "B") == "Grt.Enemy"
    # Saturn: D-9 Pisces, lord Jupiter, nat Neutral. A: Aquarius(10)->Sagittarius(8) offset 10 -> Friend.
    #                                               B: Pisces(11)->Cancer(3) offset 4 -> Enemy.
    assert navamsha_dignity("Saturn", d1, d9, "A") == "Friend"
    assert navamsha_dignity("Saturn", d1, d9, "B") == "Enemy"
    printed_a = {p: navamsha_dignity(p, d1, d9, "A") for p in PLANETS7}
    printed_b = {p: navamsha_dignity(p, d1, d9, "B") for p in PLANETS7}
    r = run_experiment(_chart(d1, d9, printed_a))
    assert r["result"] == "OPTION_A_SUPPORTED" and r["discriminating"] == ["Venus", "Saturn"], r
    r = run_experiment(_chart(d1, d9, printed_b))
    assert r["result"] == "OPTION_B_SUPPORTED", r

    # 3. Mixed printed values on the discriminating planets -> no forced winner.
    mixed = dict(printed_a, Saturn=printed_b["Saturn"])
    assert run_experiment(_chart(d1, d9, mixed))["result"] == "BOTH_INCONCLUSIVE"
    # Printed matches neither option on a discriminating planet.
    neither = dict(printed_a, Venus="Exalted")
    assert run_experiment(_chart(d1, d9, neither))["result"] == "BOTH_INCONCLUSIVE"

    # 4. Baseline disagreement on a non-discriminating planet voids the premise.
    bad_base = dict(printed_a, Sun="Debilitated")
    rb = run_experiment(_chart(d1, d9, bad_base))
    assert rb["result"] == "BOTH_INCONCLUSIVE" and rb["baseline_mismatches"] == ["Sun"], rb

    # 5. Chart where A == B for every planet (all D-9 signs own/exalted) -> inconclusive.
    d9_same = dict(Sun="Leo", Moon="Cancer", Mars="Aries", Mercury="Virgo",
                   Jupiter="Cancer", Venus="Pisces", Saturn="Aquarius")
    printed_same = {p: navamsha_dignity(p, d1, d9_same, "A") for p in PLANETS7}
    assert printed_same == {p: navamsha_dignity(p, d1, d9_same, "B") for p in PLANETS7}
    rs = run_experiment(_chart(d1, d9_same, printed_same))
    assert rs["result"] == "BOTH_INCONCLUSIVE" and rs["discriminating"] == [], rs

    # 6. Printed Moolatrikona is compared as Own.
    pm = dict(printed_same, Sun="Moolatrikona")
    assert run_experiment(_chart(d1, d9_same, pm))["result"] == "BOTH_INCONCLUSIVE"  # still no discrimination
    assert run_experiment(_chart(d1, d9_same, pm))["baseline_mismatches"] == []

    # 7. Incomplete / unusable reference data is reported, never repaired.
    good = _chart(d1, d9, printed_a)
    def broken(fn):
        doc = json.loads(json.dumps(good)); fn(doc); return run_experiment(doc)
    assert broken(lambda d: d["NAVAMSHA"]["Saturn"].pop("sign"))["result"] == "REFERENCE_DATA_INCOMPLETE"
    assert broken(lambda d: d["NAVAMSHA"]["Mars"].__setitem__("dignity", "NOT_FOUND"))["result"] == "REFERENCE_DATA_INCOMPLETE"
    assert broken(lambda d: d["NAVAMSHA"]["Mars"].__setitem__("dignity", "Great Friend"))["result"] == "REFERENCE_DATA_INCOMPLETE"
    assert broken(lambda d: d["NAVAMSHA"].__setitem__("_available", False))["result"] == "REFERENCE_DATA_INCOMPLETE"
    assert broken(lambda d: d["PLANETS"].pop("Sun"))["result"] == "REFERENCE_DATA_INCOMPLETE"
    assert broken(lambda d: d.pop("NAVAMSHA"))["result"] == "REFERENCE_DATA_INCOMPLETE"
    assert run_experiment([1, 2, 3])["result"] == "REFERENCE_DATA_INCOMPLETE"
    # Rahu/Ketu entries are ignored (no problem raised, never evaluated).
    with_nodes = json.loads(json.dumps(good))
    with_nodes["NAVAMSHA"]["Rahu"] = {"sign": "NOT_FOUND", "dignity": "NOT_FOUND"}
    assert run_experiment(with_nodes)["result"] == "OPTION_A_SUPPORTED"
    # {"data": {...}} envelope is accepted.
    assert run_experiment({"data": good})["result"] == "OPTION_A_SUPPORTED"

    print("selftest: all assertions passed")
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description="S-01b Navamsha temporary-friendship experiment")
    ap.add_argument("reference", nargs="?", help="reference JSON (printed values only)")
    ap.add_argument("--json", action="store_true", help="emit machine-readable report")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args(argv)
    if args.selftest:
        return selftest()
    if not args.reference:
        ap.error("reference JSON path required (or --selftest)")
    try:
        with open(args.reference, encoding="utf-8") as fh:
            doc = json.load(fh)
    except (OSError, ValueError) as exc:
        print("cannot read reference JSON: %s" % exc, file=sys.stderr)
        return 3
    report = run_experiment(doc)
    print(json.dumps(report, indent=2) if args.json else render(report))
    return EXIT[report["result"]]


if __name__ == "__main__":
    sys.exit(main())
'''

with open("s01b_navamsha_friendship_experiment.py", "w", newline="\n") as f:
    f.write(F4_CONTENT)

h_f4 = hashlib.sha256(F4_CONTENT.encode('utf-8')).hexdigest()
T_F4 = "e41f5dcd9f5114b38e9808327e46760495341b3544c6de62b14e903e844c11e7"
print("F4 hash:", h_f4)
print("F4 matches:", h_f4 == T_F4)
