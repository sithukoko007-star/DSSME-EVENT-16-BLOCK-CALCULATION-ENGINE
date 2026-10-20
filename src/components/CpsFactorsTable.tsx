import React, { useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Filter,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { PlanetCpsFactors } from "../engine/dssme/types.ts";

interface CpsFactorsTableProps {
  cpsAudit: PlanetCpsFactors[];
  threshold: number;
}

export function CpsFactorsTable({ cpsAudit, threshold }: CpsFactorsTableProps) {
  const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null);

  if (!cpsAudit || cpsAudit.length === 0) return null;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div className="px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-wide text-slate-200 uppercase flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              Planetary CPS Decomposition Table (S5→S10d Product)
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
              θ_s = {threshold.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            CPS_pre = S × SIF × T × RB × PAS × TM × BHF × DRF × VGF · Continuous Composite Planetary Strength (§8 Contract)
          </p>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Click any row for full micro-factor breakdown
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 text-slate-400 font-mono border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 font-semibold">Planet</th>
              <th className="px-3 py-3 text-right">RS (Virupas)</th>
              <th className="px-3 py-3 text-right font-medium text-slate-300">S (Norm)</th>
              <th className="px-3 py-3 text-right">SIF_v3</th>
              <th className="px-3 py-3 text-right">T_v3</th>
              <th className="px-3 py-3 text-right">RB</th>
              <th className="px-3 py-3 text-right">PAS_v3</th>
              <th className="px-3 py-3 text-right">TM_v3</th>
              <th className="px-3 py-3 text-right">BHF</th>
              <th className="px-3 py-3 text-right">DRF</th>
              <th className="px-3 py-3 text-right">VGF</th>
              <th className="px-3 py-3 text-right font-bold text-amber-300">CPS_pre_v3</th>
              <th className="px-4 py-3 text-center">S11 Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {cpsAudit.map((p) => {
              const isSelected = selectedPlanet === p.planet;
              const survives = p.survived || p.CPS_pre_v3 >= threshold;

              return (
                <React.Fragment key={p.planet}>
                  <tr
                    onClick={() => setSelectedPlanet(isSelected ? null : p.planet)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-slate-800/80"
                        : survives
                        ? "hover:bg-slate-800/40 bg-emerald-950/5"
                        : "hover:bg-slate-800/40"
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold font-sans text-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${survives ? "bg-emerald-400" : "bg-slate-600"}`} />
                        <span>{p.planet}</span>
                      </div>
                      {isSelected ? <ChevronUp className="h-3 w-3 text-slate-400" /> : <ChevronDown className="h-3 w-3 text-slate-600" />}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-400">
                      {p.RS.toFixed(1)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-200 font-bold">
                      {p.S.toFixed(3)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">
                      {p.SIF_v3.toFixed(3)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">
                      {p.T_v3.toFixed(3)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">
                      {p.RB.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">
                      {p.PAS_v3.toFixed(3)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">
                      {p.TM_v3.toFixed(3)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">
                      {p.BHF.toFixed(3)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">
                      {p.DRF.toFixed(3)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">
                      {p.VGF.toFixed(3)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-amber-300 text-sm">
                      {p.CPS_pre_v3.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {survives ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-600/50">
                          <CheckCircle2 className="h-3 w-3" />
                          SURVIVOR
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-500 border border-slate-700/60">
                          <XCircle className="h-3 w-3" />
                          Filtered
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Micro-factor Detail Drawer */}
                  {isSelected && (
                    <tr className="bg-slate-950/80">
                      <td colSpan={13} className="px-6 py-4">
                        <div className="space-y-3">
                          <div className="text-xs font-semibold text-slate-300 flex items-center justify-between border-b border-slate-800 pb-2">
                            <span>Channel Decomposition for {p.planet}:</span>
                            <span className="text-[11px] font-mono text-amber-400">
                              Product Score = {p.CPS_pre_v3.toFixed(6)}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-[11px]">
                            {/* SIF */}
                            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                              <div className="text-slate-400 font-semibold mb-1">SIF Channels:</div>
                              <div className="space-y-0.5 font-mono text-slate-300">
                                <div>KIF (Kaala): {p.KIF.toFixed(2)}</div>
                                <div>DIF (Drig): {p.DIF.toFixed(2)}</div>
                                <div>AIF (Ashtaka): {p.AIF.toFixed(2)}</div>
                                <div>CIF (Cluster): {p.CIF.toFixed(2)}</div>
                                <div>YIF (Yoga): {p.YIF.toFixed(2)}</div>
                              </div>
                            </div>

                            {/* T_v3 */}
                            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                              <div className="text-slate-400 font-semibold mb-1">T_v3 Channels:</div>
                              <div className="space-y-0.5 font-mono text-slate-300">
                                <div>ZC (ZW): {p.ZC.toFixed(2)}</div>
                                <div>PC (Paksha): {p.PC.toFixed(2)}</div>
                                <div>VR (Volatility): {p.VR.toFixed(2)}</div>
                                <div>SS Dignity: {p.SS_dignity.toFixed(2)}</div>
                                <div>SS House: {p.SS_house.toFixed(2)}</div>
                                <div>SS BAV: {p.SS_bav.toFixed(2)}</div>
                                <div>SS Navamsha: {p.SS_nav.toFixed(2)}</div>
                              </div>
                            </div>

                            {/* PAS_v3 */}
                            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                              <div className="text-slate-400 font-semibold mb-1">PAS_v3 Channels:</div>
                              <div className="space-y-0.5 font-mono text-slate-300">
                                <div>D (Dignity): {p.D.toFixed(2)}</div>
                                <div>C (Combust): {p.C.toFixed(2)}</div>
                                <div>R (Retrograde): {p.R.toFixed(2)}</div>
                                <div>I (Aspect Tier): {p.I_aspect.toFixed(2)}</div>
                                <div>H (House Type): {p.H.toFixed(2)}</div>
                                <div>DCF (Dispositor): {p.DCF.toFixed(2)}</div>
                              </div>
                            </div>

                            {/* TM_v3 */}
                            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                              <div className="text-slate-400 font-semibold mb-1">TM_v3 Channels:</div>
                              <div className="space-y-0.5 font-mono text-slate-300">
                                <div>DLR (Day Lord): {p.DLR.toFixed(2)}</div>
                                <div>TF (Tithi Mod): {p.TF.toFixed(2)}</div>
                                <div>NF (Nak Lord): {p.NF.toFixed(2)}</div>
                                <div>HP (Hora Ruler): {p.HP.toFixed(2)}</div>
                              </div>
                            </div>

                            {/* S10 Factors */}
                            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                              <div className="text-slate-400 font-semibold mb-1">Environmental:</div>
                              <div className="space-y-0.5 font-mono text-slate-300">
                                <div>BHF (Bhava AV): {p.BHF.toFixed(3)}</div>
                                <div>DRF (Dasha): {p.DRF.toFixed(3)}</div>
                                <div>VGF (Navamsha): {p.VGF.toFixed(3)}</div>
                                <div>RB (Rank Bonus): {p.RB.toFixed(2)}</div>
                              </div>
                            </div>

                            {/* Status and Warnings */}
                            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                              <div className="text-slate-400 font-semibold mb-1">Threshold:</div>
                              <div className="space-y-1 font-mono">
                                <div className="text-[10px] text-slate-400">Cutoff: {threshold.toFixed(2)}</div>
                                <div className={`font-bold ${survives ? "text-emerald-400" : "text-slate-500"}`}>
                                  {survives ? "PASS (Survives)" : "FAIL (Below θ_s)"}
                                </div>
                                {p.warnings && p.warnings.length > 0 && (
                                  <div className="text-[10px] text-amber-400 mt-1">
                                    {p.warnings[0]}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
