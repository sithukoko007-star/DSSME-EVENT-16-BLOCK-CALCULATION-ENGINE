"""
DSSME v1.6 conformance probe -- exercises the REAL functions in dssme_engine.py
with small synthetic inputs. These are probes, not production fixtures.
Usage: python3 dssme_v16_conformance_probe.py /path/to/dssme_engine.py
"""
import importlib.util, sys, copy

path = sys.argv[1] if len(sys.argv) > 1 else "/mnt/project/dssme_engine.py"
spec = importlib.util.spec_from_file_location("eng", path)
E = importlib.util.module_from_spec(spec); spec.loader.exec_module(E)

def show(tag, status, detail):
    print(f"[{status:15s}] {tag}: {detail}")

# ---- 1. RB fixed weights ------------------------------------------------------
want = {"Jupiter":1.15,"Venus":1.15,"Mercury":1.10,"Rahu":1.10,"Mars":1.05,
        "Moon":0.95,"Sun":0.95,"Ketu":0.90,"Saturn":0.85}
show("RB fixed weights", "MATCH" if E.RB_TABLE == want else "MISMATCH",
     f"RB_TABLE == contract table: {E.RB_TABLE == want}")

# ---- 2. SIF_v3 floor 0.82: force every sub-factor to its worst legal value ---
chart_sif = {"SHADBALA": {"total_virupas":[500]*7, "_columns":E.P7,
              "kaala_pct":[9.0]*7,"sthana_pct":[1.0]*7,"dig_pct":[1.0]*7,"chesta_pct":[1.0]*7,"drig_pct":[1.0]*7,
              "drig_bala":[-50.0]*7,"sthana_total":[400]*7,"dig_bala":[10]*7,"kaala_total":[300]*7,
              "chesta_bala":[10]*7,"naisargika_bala":[10]*7},
             "SIGN_CLUSTERS":[{"sign":"X","sign_index":0,"planets":E.ALL_PLANETS[:3],"sav":10}],
             "SAV":{"values":[10]*12},
             "YOGA_LIST":[{"name":"Daridra Yoga","planets_involved":E.ALL_PLANETS},
                          {"name":"Graha Yuddha","planets_involved":E.ALL_PLANETS}]}
rs = dict(zip(E.P7, chart_sif["SHADBALA"]["total_virupas"]))
sif, *_ = E.compute_sif_v3(chart_sif, rs, max(rs.values()))
show("SIF_v3 floor", "MATCH" if min(sif.values()) >= 0.82 else "MISMATCH",
     f"worst-case SIF = {min(sif.values()):.2f} (clamp literal max(0.82, ...) at engine line 537)")

# ---- 3. T_v3 contains SS_house and SS_nav ------------------------------------
chart_t = {"PANCHANGA":{"paksha":"Shukla","tithi_name":"Shukla Dwitiya"},
           "HOUSE_POSITIONS":{p:{"house":1,"type":"Angular"} for p in E.ALL_PLANETS},
           "BAV_CURRENT_SIGN":{p:{"bav":4} for p in E.ALL_PLANETS},
           "DIGNITY":{p:"Neutral" for p in E.P7},
           "NAVAMSHA":{"_available":True, **{p:{"sign":"A","dignity":"Neutral","is_vargottama":False,"is_pushkara":False} for p in E.ALL_PLANETS}}}
t, det = E.compute_t_v3(chart_t, "OPEN", 0)
show("T_v3 has SS_house", "MATCH" if "SS_house" in det["Sun"] else "MISMATCH", f"detail keys={sorted(det['Sun'])}")
show("T_v3 has SS_nav",   "MATCH" if "SS_nav"   in det["Sun"] else "MISMATCH", f"SS_nav(Sun, neutral nav)={det['Sun']['SS_nav']}")

# SS_nav Pushkara tier (v1.5 table: Pushkara -> 1.03)
c2 = copy.deepcopy(chart_t); c2["NAVAMSHA"]["Sun"]["is_pushkara"] = True
v, why = E.compute_ss_nav(c2, "Sun")
show("SS_nav Pushkara tier (v1.5 table = 1.03)", "MATCH" if abs(v-1.03)<1e-9 else "MISMATCH",
     f"engine returns {v} ({why}); is_pushkara is never read by compute_ss_nav")

# ---- 4. PAS_v3: H present; I_bav must be absent -------------------------------
chart_p = {"ASPECTS_PLANETS":[], "BAV_CURRENT_SIGN":{p:{"bav":8} for p in E.ALL_PLANETS},
           "HOUSE_POSITIONS":{p:{"house":1,"type":"Angular"} for p in E.ALL_PLANETS},
           "COMBUST":{}, "RETROGRADE":{}, "DIGNITY":{p:"Neutral" for p in E.P7},
           "PLANETS":{p:{"dispositor":"Sun"} for p in E.ALL_PLANETS}}
rs7 = {p:500.0 for p in E.P7}
pas, pdet = E.compute_pas_v3(chart_p, rs7, 500.0)
show("PAS_v3 includes H", "MATCH" if "H" in pdet["Sun"] else "MISMATCH", f"H(Angular)={pdet['Sun']['H']}")
ibav_live = abs(pdet["Sun"]["I_v2"] - 1.00) > 1e-9
show("PAS_v3 has no I_bav (clean aspect, BAV=8)", "MISMATCH" if ibav_live else "MATCH",
     f"I_v2={pdet['Sun']['I_v2']} with no aspects (contract: I_aspect = 1.00); I_BAV[8]={E.I_BAV[8]} is applied")
lo = E.compute_pas_v3({**chart_p,"BAV_CURRENT_SIGN":{p:{"bav":0} for p in E.ALL_PLANETS},
        "DIGNITY":{p:"Debilitated" for p in E.P7},"COMBUST":{p:{"combust":True,"severity":"Severe"} for p in E.P7},
        "RETROGRADE":{p:True for p in E.ALL_PLANETS},
        "HOUSE_POSITIONS":{p:{"house":3,"type":"Cadent"} for p in E.ALL_PLANETS},
        "ASPECTS_PLANETS":[{"from":"Mars","to":p,"score":50} for p in E.ALL_PLANETS]}, rs7, 500.0)[0]
hi = E.compute_pas_v3({**chart_p,"DIGNITY":{p:"Exalted" for p in E.P7}}, rs7, 500.0)[0]
show("PAS_v3 clamp [0.58,1.14]", "MISMATCH",
     f"engine achieves min={min(lo.values()):.3f} max={max(hi.values()):.3f}; coded clamp is (0.57, 1.18) at line 670")

# ---- 5. TM_v3: no GTF / no Gochara -------------------------------------------
chart_m = {"PANCHANGA":{"weekday_lord":"Sun","tithi_name":"Shukla Dwitiya","nakshatra_name":"Ashwini"},
           "HORA":{"planet":"Sun"}, "GOCHARA":{}}
base_tm, _ = E.compute_tm_v3(chart_m)
chart_m2 = copy.deepcopy(chart_m)
chart_m2["GOCHARA"] = {"Mars":{"bav_transit_sign":8,"vedha_present":False,"over_lagna":True}}
tm2, tmdet = E.compute_tm_v3(chart_m2)
changed = abs(tm2["Mars"] - base_tm["Mars"]) > 1e-9
show("TM_v3 has no GTF", "MISMATCH" if ("GTF" in tmdet["Mars"]) else "MATCH",
     f"TM(Mars) {base_tm['Mars']:.4f} -> {tm2['Mars']:.4f} when a GOCHARA entry is supplied; changed={changed}")
show("Gochara absent from engine input", "MISMATCH" if "GOCHARA" in open(path).read() else "MATCH",
     "engine reads chart['GOCHARA'] (compute_gtf, line 703-717); TM clamp coded (0.88, 1.08) at line 729")

# ---- 6. BHF: H2/H5/H8/H11 bonus exactly once; <0.55 band --------------------
def bhf_for(house, total):
    bb = {h:{"total":100} for h in range(1,13)}; bb[house]["total"] = total
    ch = {"BHAVA_BALA":bb, "HOUSE_POSITIONS":{"Jupiter":{"house":house}}}
    out,_ = E.compute_bhf(ch); return out["Jupiter"]
b_spec  = bhf_for(5, 150)   # norm ~1.38 -> base 1.05 -> min(1.05, 1.05*1.01)=1.05
b_spec2 = bhf_for(5, 105)   # norm ~1.04 -> base 1.01 -> 1.01*1.01 = 1.0201
b_non   = bhf_for(3, 105)
show("BHF spec-house bonus once", "MATCH" if abs(b_spec2-1.0201)<1e-4 and abs(b_non-1.01)<1e-4 and b_spec<=1.05 else "MISMATCH",
     f"H5 norm~1.04 -> {b_spec2}; H3 same norm -> {b_non}; H5 strong -> {b_spec}")
b_low = bhf_for(5, 10)      # norm ~ 0.11 (< 0.55)
show("BHF band BB_norm < 0.55 (contract 0.88)", "MATCH" if abs(b_low-0.88)<1e-9 else "MISMATCH",
     f"engine returns {b_low} (final else-branch at line 755 is 0.92)")

# ---- 7. DRF: AD-secondary once; MD tier values --------------------------------
chart_d = {"DASHA":{"mahadasha_planet":"Sun","antardasha_planet":"Saturn"}}
drf = E.compute_drf(chart_d)
# Moon: Friend of Sun (MD) ; Saturn-AD: Moon is Enemy-of-Saturn per table -> x0.98
show("DRF AD-secondary applied once", "MATCH" if abs(drf["Moon"] - max(0.88, 1.04*0.98)) < 1e-9 else "MISMATCH",
     f"Moon: MD-friend tier x AD-enemy 0.98 -> {drf['Moon']:.4f}")
chart_d2 = {"DASHA":{"mahadasha_planet":"Sun","antardasha_planet":None}}
d2 = E.compute_drf(chart_d2)
show("DRF MD tier Friend = 1.02 (v1.5 §9.2)", "MATCH" if abs(d2["Moon"]-1.02)<1e-9 else "MISMATCH",
     f"Moon (Friend of Sun MD) -> {d2['Moon']}")
show("DRF MD tier Enemy = 0.94 (v1.5 §9.2)", "MATCH" if abs(d2["Venus"]-0.94)<1e-9 else "MISMATCH",
     f"Venus (Enemy of Sun MD) -> {d2['Venus']}")

# ---- 8. VGF separate from SS_nav ---------------------------------------------
c3 = copy.deepcopy(chart_t); c3["NAVAMSHA"]["Sun"]["is_vargottama"] = True
ssn,_ = E.compute_ss_nav(c3,"Sun"); vg = E.compute_vgf(c3)["Sun"]
show("VGF separate from SS_nav", "MATCH" if (ssn != vg and E.compute_vgf is not E.compute_ss_nav) else "MISMATCH",
     f"Vargottama Sun: SS_nav={ssn} (inside T_v3), VGF={vg} (top-level); two functions, two tables")

# ---- 9. S12 Moon exclusion ---------------------------------------------------
cps = {"Sun":0.9,"Moon":0.8,"Mars":0.7,"Mercury":0.6,"Jupiter":0.5}
tv  = {p:0.9 for p in cps}
with_moon = E.field_classification(["Sun","Moon","Mars","Mercury","Jupiter"], cps, tv)
no_moon   = E.field_classification(["Sun","Mars","Mercury","Jupiter"], cps, tv)
show("S12 excludes Moon from n and D", "MISMATCH" if with_moon[1] != no_moon[1] else "MATCH",
     f"with Moon: type={with_moon[0]} n={with_moon[1]} D={with_moon[2]:.3f}; "
     f"digit-bearing only: type={no_moon[0]} n={no_moon[1]} D={no_moon[2]:.3f}")
