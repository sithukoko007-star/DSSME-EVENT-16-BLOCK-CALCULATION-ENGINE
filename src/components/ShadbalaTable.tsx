import React, { useState } from "react";
import {
  Award,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import type { ShadbalaBlock, ClassicalPlanet } from "../types/dssme-canonical-types.ts";

interface ShadbalaTableProps {
  shadbala: ShadbalaBlock;
}

export function ShadbalaTable({ shadbala }: ShadbalaTableProps) {
  const [showSubcomponents, setShowSubcomponents] = useState<boolean>(false);

  if (!shadbala || !shadbala.total_virupas) {
    return null;
  }

  const planets = shadbala._columns ?? [
    "Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn",
  ];

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div className="px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-wide text-slate-200 uppercase flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-400" />
              Shadbala — Sixfold Planetary Strength (BPHS Canonical)
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              BPHS Strict Parity
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            1 Rupa = 60 Virupas · Sthana, Dig, Kaala, Chesta (Max 60), Naisargika, Drig Bala · Minimum required baseline
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowSubcomponents(!showSubcomponents)}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
        >
          {showSubcomponents ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {showSubcomponents ? "Hide Formulas" : "View Bala Explanations"}
        </button>
      </div>

      {showSubcomponents && (
        <div className="p-4 bg-slate-950/70 border-b border-slate-800 text-xs text-slate-400 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800/80">
              <div className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                1. Sthana Bala (Positional)
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Uchcha Bala (arc to de-exaltation / 3), Saptavargaja Bala (dignities across D1–D9), Ojha Yugma (Mercury Napumsaka 15v rule), Kendradi & Drekkana Bala.
              </p>
            </div>
            <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800/80">
              <div className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                2. Dig Bala (Directional)
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Max 60 virupas at strong house cusps: Jupiter/Mercury in 1st house (Asc), Sun/Mars in 10th (MC), Saturn in 7th (Desc), Moon/Venus in 4th (IC).
              </p>
            </div>
            <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800/80">
              <div className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                3. Kaala Bala (Temporal)
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Nathonnatha (diurnal/nocturnal), Paksha (Shukla benefics, Krishna malefics), Tribhaga day/night lords, Abda, Masa, Vaara, Hora, Ayana, Yuddha.
              </p>
            </div>
            <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800/80">
              <div className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                4. Chesta Bala (Motional)
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                BPHS Ch. 27: Retrograde motion imparts full 60 virupas motional power. Sun & Moon derive Chesta from Ayana/Paksha respectively.
              </p>
            </div>
            <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800/80">
              <div className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                5. Naisargika Bala (Natural)
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Natural constant intrinsic luminosity: Sun (60), Moon (51.43), Venus (42.86), Jupiter (34.29), Mercury (25.71), Mars (17.14), Saturn (8.57).
              </p>
            </div>
            <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800/80">
              <div className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                6. Drig Bala (Aspectual)
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Aspectual strength from all other planets. Special Parashari partial aspects included (Mars 4th/8th, Jupiter 5th/9th, Saturn 3rd/10th). Can be negative.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 text-slate-400 font-mono border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 font-semibold">Planet</th>
              <th className="px-3 py-3 text-right">Sthana</th>
              <th className="px-3 py-3 text-right">Dig</th>
              <th className="px-3 py-3 text-right">Kaala</th>
              <th className="px-3 py-3 text-right">Chesta</th>
              <th className="px-3 py-3 text-right">Naisargika</th>
              <th className="px-3 py-3 text-right">Drig</th>
              <th className="px-3 py-3 text-right font-bold text-amber-300">Total (Virupas)</th>
              <th className="px-3 py-3 text-right text-slate-400">Min. Req</th>
              <th className="px-3 py-3 text-center">Req. %</th>
              <th className="px-3 py-3 text-right text-slate-300">Rupas</th>
              <th className="px-3 py-3 text-center">Rank</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {planets.map((planet, idx) => {
              const totalV = shadbala.total_virupas[idx] ?? 0;
              const minReq = shadbala.minimum_required[idx] ?? 300;
              const pctReq = shadbala.percent_required[idx] ?? (minReq > 0 ? (totalV / minReq) * 100 : 0);
              const rank = shadbala.rank[idx] ?? (idx + 1);
              const isStrong = pctReq >= 100;
              const rupas = totalV / 60;

              return (
                <tr
                  key={planet}
                  className="hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-4 py-3 font-semibold font-sans text-slate-100 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    {planet}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-300">
                    {(shadbala.sthana_total?.[idx] ?? 0).toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-300">
                    {(shadbala.dig_bala?.[idx] ?? 0).toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-300">
                    {(shadbala.kaala_total?.[idx] ?? 0).toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-300">
                    {(shadbala.chesta_bala?.[idx] ?? 0).toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-400">
                    {(shadbala.naisargika_bala?.[idx] ?? 0).toFixed(1)}
                  </td>
                  <td className={`px-3 py-3 text-right ${(shadbala.drig_bala?.[idx] ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {(shadbala.drig_bala?.[idx] ?? 0) > 0 ? `+${(shadbala.drig_bala?.[idx] ?? 0).toFixed(1)}` : (shadbala.drig_bala?.[idx] ?? 0).toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-amber-300 text-sm">
                    {totalV.toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-500">
                    {minReq}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        isStrong
                          ? "bg-emerald-950/60 text-emerald-400 border border-emerald-600/40"
                          : "bg-rose-950/60 text-rose-400 border border-rose-600/40"
                      }`}
                    >
                      {pctReq.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-slate-200">
                    {rupas.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                        rank === 1
                          ? "bg-amber-400 text-slate-950 shadow-sm shadow-amber-400/50"
                          : rank === 2
                          ? "bg-slate-300 text-slate-950"
                          : rank === 3
                          ? "bg-amber-700 text-amber-100"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {rank}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
