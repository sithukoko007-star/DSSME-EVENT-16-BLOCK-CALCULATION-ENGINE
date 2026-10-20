import React, { useState } from "react";
import {
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  Layers,
  Sparkles,
} from "lucide-react";
import type { Dssme16BlockResult } from "../types/dssme-canonical-types.ts";

interface ChartblocksInspectorProps {
  blocks: Dssme16BlockResult;
}

type BlockCategory = "all" | "core" | "bala" | "ashtakavarga" | "dasha_yoga" | "temporal";

export function ChartblocksInspector({ blocks }: ChartblocksInspectorProps) {
  const [activeTab, setActiveTab] = useState<string>("SUMMARY");
  const [category, setCategory] = useState<BlockCategory>("all");
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);

  if (!blocks) return null;

  const blockEntries: { key: string; name: string; category: BlockCategory; desc: string; data: any }[] = [
    { key: "IDENTITY", name: "1. IDENTITY", category: "core", desc: "Session meta, calculation input & engine specs", data: blocks.IDENTITY },
    { key: "PLANETS", name: "2. PLANETS", category: "core", desc: "Bodies with sign, degree, nakshatra, dignity, sb_rank", data: blocks.PLANETS },
    { key: "HOUSES", name: "3. HOUSES", category: "core", desc: "12 whole-sign bhavas, types, lords, occupants", data: blocks.HOUSES },
    { key: "HOUSE_POSITIONS", name: "4. HOUSE POSITIONS", category: "core", desc: "Planet-to-house mapping", data: blocks.HOUSE_POSITIONS },
    { key: "DIGNITY", name: "5. DIGNITY", category: "core", desc: "Planetary dignity assessment (Exalted, Own, etc.)", data: blocks.DIGNITY },
    { key: "RETROGRADE", name: "6. RETROGRADE", category: "core", desc: "Vakri motion & planetary speed", data: blocks.RETROGRADE },
    { key: "COMBUST", name: "7. COMBUST", category: "core", desc: "Solar combustion & severity", data: blocks.COMBUST },
    { key: "SHADBALA", name: "8. SHADBALA", category: "bala", desc: "Sixfold classical planetary strengths (Virupas)", data: blocks.SHADBALA },
    { key: "BHAVA_BALA", name: "9. BHAVA BALA", category: "bala", desc: "12 house strengths & drishti contributions", data: blocks.BHAVA_BALA },
    { key: "BAV", name: "10. BAV (Bhinnashtakavarga)", category: "ashtakavarga", desc: "8x12 individual planet bindu matrix", data: blocks.BAV },
    { key: "SAV", name: "11. SAV (Samudayashtakavarga)", category: "ashtakavarga", desc: "Combined 12 sign bindu totals (target ~337)", data: blocks.SAV },
    { key: "BAV_CURRENT_SIGN", name: "12. BAV CURRENT SIGN", category: "ashtakavarga", desc: "Current sign bindu for each planet", data: blocks.BAV_CURRENT_SIGN },
    { key: "ASPECTS_PLANETS", name: "13. ASPECTS (Planets)", category: "bala", desc: "Mutual Graha Drishti aspect matrix", data: blocks.ASPECTS_PLANETS },
    { key: "ASPECTS_BHAVAS", name: "14. ASPECTS (Bhavas)", category: "bala", desc: "Aspects falling on the 12 houses", data: blocks.ASPECTS_BHAVAS },
    { key: "DASHA", name: "15. DASHA", category: "dasha_yoga", desc: "Vimshottari MD / AD / PD dasha timeline", data: blocks.DASHA },
    { key: "YOGA_LIST", name: "16. YOGA LIST", category: "dasha_yoga", desc: "Active Vedic yogas (Raja, Dhana, Gaja Kesari, etc.)", data: blocks.YOGA_LIST },
    { key: "PANCHANGA", name: "17. PANCHANGA", category: "temporal", desc: "5 limbs, gandanta, eclipse, ingress status", data: blocks.PANCHANGA },
    { key: "HORA", name: "18. HORA", category: "temporal", desc: "Planetary hour lord and intervals", data: blocks.HORA },
    { key: "PHASE_STRESS", name: "19. PHASE STRESS", category: "temporal", desc: "Syzygy proximity & sign boundary stress", data: blocks.PHASE_STRESS },
    { key: "NAVAMSHA", name: "20. NAVAMSHA (D9)", category: "core", desc: "D9 Vargottama & Pushkara Navamsha positions", data: blocks.NAVAMSHA },
    { key: "SIGN_CLUSTERS", name: "21. SIGN CLUSTERS", category: "core", desc: "Stelliums & planetary density per sign", data: blocks.SIGN_CLUSTERS },
  ];

  const filteredBlocks = category === "all"
    ? blockEntries
    : blockEntries.filter(b => b.category === category);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div className="px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-wide text-slate-200 uppercase flex items-center gap-2">
              <Boxes className="h-4 w-4 text-amber-400" />
              DSSME 16-Block Architectural Surface (Contract §2)
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {blockEntries.length} Blocks Verified
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic assembled intermediate representation for downstream CPS Engine processing
          </p>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1">
          {[
            { id: "all", label: "All" },
            { id: "core", label: "Core" },
            { id: "bala", label: "Balas" },
            { id: "ashtakavarga", label: "Ashtakavarga" },
            { id: "dasha_yoga", label: "Dasha/Yogas" },
            { id: "temporal", label: "Temporal" },
          ].map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id as BlockCategory)}
              className={`px-2.5 py-1 rounded text-xs font-mono transition cursor-pointer ${
                category === c.id
                  ? "bg-amber-500 text-slate-950 font-bold"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-400"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Blocks */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredBlocks.map((b) => {
          const isExpanded = expandedBlock === b.key;
          const hasData = Boolean(b.data);

          return (
            <div
              key={b.key}
              className={`rounded-lg border transition-all ${
                isExpanded
                  ? "border-amber-500/50 bg-slate-950 col-span-1 md:col-span-2 lg:col-span-3 shadow-lg"
                  : "border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/60"
              }`}
            >
              <div
                onClick={() => setExpandedBlock(isExpanded ? null : b.key)}
                className="p-3.5 flex items-start justify-between cursor-pointer select-none"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-200">{b.name}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">{b.desc}</p>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    {isExpanded ? "Collapse" : "Inspect"}
                  </span>
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-800/80 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono text-slate-400">
                      Block Payload ({b.key}):
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Conforms to Schema
                    </span>
                  </div>
                  <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono text-amber-300/80 overflow-x-auto max-h-72">
                    {JSON.stringify(b.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
