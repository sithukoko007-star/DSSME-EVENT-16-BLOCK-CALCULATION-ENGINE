import React, { useState, useMemo } from "react";

type TaraGrahaId = "Mars" | "Mercury" | "Jupiter" | "Venus" | "Saturn";
type AshtaGatiState =
  | "Vakra"
  | "Anuvakra"
  | "Vikala"
  | "Manda"
  | "Mandatara"
  | "Sama"
  | "Chara"
  | "Atichara";

interface GatiMetadata {
  sanskrit: string;
  myanmarName: string;
  description: string;
  ruleText: string;
  bphsVirupas: number;
  modernVirupas: number;
  badgeColor: string;
}

const PLANET_META: Record<
  TaraGrahaId,
  { myanmar: string; meanSpeed: number; maxSpeed: number; dms: string }
> = {
  Mars: {
    myanmar: "အင်္ဂါ (Mars)",
    meanSpeed: 0.5240,
    maxSpeed: 0.79,
    dms: "0° 31' 26\"",
  },
  Mercury: {
    myanmar: "ဗုဒ္ဓဟူး (Mercury)",
    meanSpeed: 0.9856,
    maxSpeed: 2.20,
    dms: "0° 59' 08\"",
  },
  Jupiter: {
    myanmar: "ကြာသပတေး (Jupiter)",
    meanSpeed: 0.0831,
    maxSpeed: 0.24,
    dms: "0° 04' 59\"",
  },
  Venus: {
    myanmar: "သောကြာ (Venus)",
    meanSpeed: 0.9856,
    maxSpeed: 1.25,
    dms: "0° 59' 08\"",
  },
  Saturn: {
    myanmar: "စနေ (Saturn)",
    meanSpeed: 0.0335,
    maxSpeed: 0.13,
    dms: "0° 02' 00\"",
  },
};

const GATI_TABLE: Record<AshtaGatiState, GatiMetadata> = {
  Vakra: {
    sanskrit: "Vakra (वक्र)",
    myanmarName: "ဝကြ",
    description: "လက်ရှိရာသီခွင်အတွင်း နောက်ပြန်သွားခြင်း (Full Retrograde)",
    ruleText: "R ≤ -0.05 (လက်ရှိရာသီအတွင်း)",
    bphsVirupas: 60.0,
    modernVirupas: 60.0,
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  Anuvakra: {
    sanskrit: "Anuvakra (अनुवक्र)",
    myanmarName: "အနုဝကြ",
    description: "နောက်ပြန်သွားရင်း အရှေ့ရာသီခွင် (Previous Sign) သို့ ပြန်ဝင်ခြင်း",
    ruleText: "R ≤ -0.05 + အရှေ့ရာသီသို့ နောက်ပြန်ကူးဝင်ခြင်း",
    bphsVirupas: 30.0,
    modernVirupas: 30.0,
    badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  },
  Vikala: {
    sanskrit: "Vikala / Kutila (विकल)",
    myanmarName: "ဝိကလ",
    description: "ရပ်တန့်နေခြင်း / သွားနှုန်း ကင်းမဲ့နေခြင်း (Stationary)",
    ruleText: "|R| < 0.05 သို့မဟုတ် |v| < 0° 01'/day",
    bphsVirupas: 15.0,
    modernVirupas: 15.0,
    badgeColor: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  },
  Manda: {
    sanskrit: "Manda (मन्द)",
    myanmarName: "မန္ဒ",
    description: "ပုံမှန်သွားနှုန်းထက် အနည်းငယ်နှေးကွေးခြင်း (Slower than mean)",
    ruleText: "0.50 ≤ R < 0.90",
    bphsVirupas: 30.0,
    modernVirupas: 15.0,
    badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/40",
  },
  Mandatara: {
    sanskrit: "Mandatara (मन्दतर)",
    myanmarName: "မန္ဒတရ",
    description: "မန္ဒထက်ပင် ပို၍ အလွန်နှေးကွေးခြင်း (Much slower than mean)",
    ruleText: "0.05 ≤ R < 0.50",
    bphsVirupas: 15.0,
    modernVirupas: 7.5,
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  },
  Sama: {
    sanskrit: "Sama (सम)",
    myanmarName: "သမ",
    description: "ပုံမှန်သွားနှုန်းအတိုင်း သွားနေခြင်း (Normal / Mean motion)",
    ruleText: "0.90 ≤ R ≤ 1.10",
    bphsVirupas: 7.5,
    modernVirupas: 30.0,
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
  Chara: {
    sanskrit: "Chara / Shighra (चर)",
    myanmarName: "စရ (သီဃြ)",
    description: "ပုံမှန်သွားနှုန်းထက် မြန်ဆန်ခြင်း (Faster than normal)",
    ruleText: "1.10 < R ≤ 1.50",
    bphsVirupas: 45.0,
    modernVirupas: 30.0,
    badgeColor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  },
  Atichara: {
    sanskrit: "Atichara (अतिचर)",
    myanmarName: "အတိစရ",
    description: "အလွန်မြန်သောအရှိန်ဖြင့် နောက်ရာသီခွင်သို့ ကျော်ဝင်ခြင်း (Accelerated)",
    ruleText: "R > 1.50 (သို့မဟုတ် အရှိန်ဖြင့် ရာသီကူးပြောင်းခြင်း)",
    bphsVirupas: 30.0,
    modernVirupas: 45.0,
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  },
};

export const ChestaBalaCalculator: React.FC = () => {
  const [planet, setPlanet] = useState<TaraGrahaId>("Mars");
  const [dailySpeed, setDailySpeed] = useState<number>(0.35);
  const [crossedPrevSign, setCrossedPrevSign] = useState<boolean>(false);
  const [crossedNextSignFast, setCrossedNextSignFast] = useState<boolean>(false);
  const [useModernScale, setUseModernScale] = useState<boolean>(false);

  const calculation = useMemo(() => {
    const meta = PLANET_META[planet];
    const meanSpeed = meta.meanSpeed;
    const speedRatio = dailySpeed / meanSpeed;
    const absSpeed = Math.abs(dailySpeed);
    const absRatio = Math.abs(speedRatio);

    let gati: AshtaGatiState;
    if (absRatio < 0.05 || absSpeed < 1 / 60) {
      gati = "Vikala";
    } else if (dailySpeed < 0) {
      gati = crossedPrevSign ? "Anuvakra" : "Vakra";
    } else if (speedRatio < 0.50) {
      gati = "Mandatara";
    } else if (speedRatio < 0.90) {
      gati = "Manda";
    } else if (speedRatio <= 1.10) {
      gati = "Sama";
    } else if (crossedNextSignFast || speedRatio > 1.50) {
      gati = "Atichara";
    } else {
      gati = "Chara";
    }

    const gatiInfo = GATI_TABLE[gati];
    const virupas = useModernScale
      ? gatiInfo.modernVirupas
      : gatiInfo.bphsVirupas;
    const rupas = virupas / 60.0;

    return {
      meanSpeed,
      speedRatio,
      gati,
      gatiInfo,
      virupas,
      rupas,
    };
  }, [planet, dailySpeed, crossedPrevSign, crossedNextSignFast, useModernScale]);

  return (
    <div className="bg-slate-950 text-slate-100 p-6 rounded-2xl border border-slate-800 shadow-xl max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-teal-400">
            BPHS Ch.27 — Chesta Bala Interactive Calculator (အဋ္ဌဂတိ တွက်ချက်စက်)
          </h2>
          <p className="text-sm text-slate-400">
            Method 2: ဂြိုဟ်သွားနှုန်း (Daily Speed) နှင့် နောက်ပြန်သွားမှု (Retrograde) အခြေအနေ ၈ မျိုးဖြင့် တွက်ချက်ခြင်း
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setUseModernScale(false)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              !useModernScale
                ? "bg-teal-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            BPHS မူရင်း (27.23)
          </button>
          <button
            type="button"
            onClick={() => setUseModernScale(true)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              useModernScale
                ? "bg-amber-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            ခေတ်သစ် Software မူကွဲ
          </button>
        </div>
      </div>

      {/* Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Planet & Speed Input */}
        <div className="bg-slate-900/70 p-5 rounded-xl border border-slate-800 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              ၁။ တာရာဂြိုဟ် ရွေးချယ်ရန် (Select Tara Graha)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(PLANET_META) as TaraGrahaId[]).map((pKey) => (
                <button
                  key={pKey}
                  type="button"
                  onClick={() => {
                    setPlanet(pKey);
                    setDailySpeed(PLANET_META[pKey].meanSpeed);
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition ${
                    planet === pKey
                      ? "bg-teal-500/20 border-teal-500 text-teal-300"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className="font-bold">{PLANET_META[pKey].myanmar}</div>
                  <div className="text-[11px] text-slate-400">
                    v̄ = {PLANET_META[pKey].meanSpeed}°/d
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400 font-medium">
                ၂။ တစ်နေ့တာ အမှန်သွားနှုန်း v (°/day):
              </span>
              <span className="font-mono text-teal-300 font-bold">
                {dailySpeed >= 0 ? `+${dailySpeed.toFixed(4)}` : dailySpeed.toFixed(4)}°/day
              </span>
            </div>
            <input
              type="range"
              min={-PLANET_META[planet].maxSpeed}
              max={PLANET_META[planet].maxSpeed * 1.4}
              step={0.001}
              value={dailySpeed}
              onChange={(e) => setDailySpeed(parseFloat(e.target.value))}
              className="w-full accent-teal-500 cursor-pointer"
            />
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                step="0.0001"
                value={dailySpeed}
                onChange={(e) => setDailySpeed(parseFloat(e.target.value) || 0)}
                className="bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm font-mono text-slate-100 w-36"
              />
              <button
                type="button"
                onClick={() => setDailySpeed(-0.1167)}
                className="text-xs px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
              >
                နမူနာ ၁ (Jupiter -0.1167°)
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlanet("Mars");
                  setDailySpeed(0.35);
                }}
                className="text-xs px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
              >
                နမူနာ ၂ (Mars +0.35°)
              </button>
            </div>
          </div>

          {/* Sign Transition Toggles */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              ၃။ ရာသီကူးပြောင်းမှု အခြေအနေ (Sign Boundary Conditions)
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={crossedPrevSign}
                disabled={dailySpeed >= 0}
                onChange={(e) => setCrossedPrevSign(e.target.checked)}
                className="accent-amber-500"
              />
              <span>
                နောက်ပြန်သွားရင်း အရှေ့ရာသီခွင်သို့ ပြန်ဝင်ထားသည် (Anuvakra)
              </span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={crossedNextSignFast}
                disabled={dailySpeed <= 0}
                onChange={(e) => setCrossedNextSignFast(e.target.checked)}
                className="accent-purple-500"
              />
              <span>
                အရှိန်ပြင်းစွာဖြင့် နောက်ရာသီခွင်သို့ ကျော်ဖြတ်ဝင်ရောက်သည် (Atichara)
              </span>
            </label>
          </div>
        </div>

        {/* Right: Live Result Card */}
        <div className="bg-slate-900/70 p-5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-slate-400">
                လက်ရှိ ဂတိအမျိုးအစား (Motion State)
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${calculation.gatiInfo.badgeColor}`}
              >
                {calculation.gatiInfo.sanskrit} — {calculation.gatiInfo.myanmarName}
              </span>
            </div>

            <p className="text-sm text-slate-300 bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
              {calculation.gatiInfo.description}
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-400">ပျမ်းမျှသွားနှုန်း (v̄)</div>
                <div className="font-mono text-sm font-bold text-slate-200 mt-0.5">
                  {calculation.meanSpeed.toFixed(4)}°/day ({PLANET_META[planet].dms})
                </div>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-400">သွားနှုန်းအချိုး (R = v / v̄)</div>
                <div className="font-mono text-sm font-bold text-teal-400 mt-0.5">
                  {calculation.speedRatio.toFixed(3)} ({(calculation.speedRatio * 100).toFixed(1)}%)
                </div>
              </div>
            </div>
          </div>

          {/* Virupa & Rupa Output Box */}
          <div className="bg-gradient-to-r from-teal-950/60 to-slate-950 p-4 rounded-xl border border-teal-500/30 flex items-center justify-between">
            <div>
              <div className="text-xs text-teal-300 font-semibold uppercase">
                ရရှိသော Chesta Bala စွမ်းအား
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                စည်းမျဉ်း: {calculation.gatiInfo.ruleText}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold text-amber-400 font-mono">
                {calculation.virupas.toFixed(1)} <span className="text-sm font-normal">Virupas</span>
              </div>
              <div className="text-xs font-mono text-teal-300">
                = {calculation.rupas.toFixed(3)} Rupas
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full 8-Gati Reference Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/50">
              <th className="py-2.5 px-3">စဉ်</th>
              <th className="py-2.5 px-3">ဂြိုဟ်သွားအခြေအနေ (Gati)</th>
              <th className="py-2.5 px-3">သင်္ချာစံနှုန်း (Speed Ratio R)</th>
              <th className="py-2.5 px-3 text-right">BPHS မူရင်း (Virupas)</th>
              <th className="py-2.5 px-3 text-right">Rupa (÷60)</th>
              <th className="py-2.5 px-3 text-right">Software မူကွဲ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {(Object.keys(GATI_TABLE) as AshtaGatiState[]).map((gKey, idx) => {
              const row = GATI_TABLE[gKey];
              const isActive = calculation.gati === gKey;
              return (
                <tr
                  key={gKey}
                  className={
                    isActive
                      ? "bg-teal-500/10 text-teal-200 font-semibold"
                      : "text-slate-300 hover:bg-slate-900/40"
                  }
                >
                  <td className="py-2 px-3 font-mono">{idx + 1}</td>
                  <td className="py-2 px-3">
                    {row.sanskrit} — <span className="text-teal-400">{row.myanmarName}</span>
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px]">{row.ruleText}</td>
                  <td className="py-2 px-3 text-right font-mono text-amber-300">
                    {row.bphsVirupas.toFixed(1)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono">
                    {(row.bphsVirupas / 60).toFixed(3)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-slate-400">
                    {row.modernVirupas.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ChestaBalaCalculator;

