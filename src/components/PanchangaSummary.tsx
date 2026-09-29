import React, { useMemo, useState, useEffect } from "react";
import {
  Moon,
  Sparkles,
  Sun,
  Shield,
  Clock,
  Calendar,
  Layers,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { CanonicalChart } from "../types/dssme-canonical-types.ts";
import {
  fromCanonicalChart,
  computePanchanga,
  PanchangaResult,
  createSwissLongitudeProvider,
  createSunriseProvider,
  LongitudeProvider,
  SunriseProvider,
} from "../engine/panchanga/index.ts";
import { formatDms } from "../engine/astronomy/ayanamsa.ts";

interface PanchangaSummaryProps {
  chart: CanonicalChart;
}

export function PanchangaSummary({ chart }: PanchangaSummaryProps) {
  const [includeBoundaries, setIncludeBoundaries] = useState<boolean>(true);
  const [varaMode, setVaraMode] = useState<"sunrise" | "civil">("sunrise");
  const [providers, setProviders] = useState<{
    longitude?: LongitudeProvider;
    sunrise: SunriseProvider;
  }>(() => ({
    sunrise: createSunriseProvider(),
  }));

  // Initialize async Swiss longitude provider once
  useEffect(() => {
    let mounted = true;
    async function initProviders() {
      try {
        const longitude = await createSwissLongitudeProvider();
        if (mounted) {
          setProviders((prev) => ({ ...prev, longitude }));
        }
      } catch (err) {
        console.warn("Failed to initialize Swiss longitude provider for boundaries", err);
      }
    }
    initProviders();
    return () => {
      mounted = false;
    };
  }, []);

  // Compute Panchanga state from CanonicalChart
  const panchanga = useMemo<PanchangaResult | null>(() => {
    if (!chart || !chart.planets?.Sun || !chart.planets?.Moon) return null;

    try {
      const src = fromCanonicalChart(chart);
      const hasLongitude = Boolean(providers.longitude);
      const shouldComputeBoundaries = includeBoundaries && hasLongitude;

      return computePanchanga(
        src,
        {
          provider: shouldComputeBoundaries ? providers.longitude : undefined,
          sunrise: providers.sunrise,
        },
        {
          varaMode,
          includeBoundaries: shouldComputeBoundaries,
        }
      );
    } catch (err) {
      console.error("Failed to compute Panchanga from CanonicalChart:", err);
      return null;
    }
  }, [chart, providers, includeBoundaries, varaMode]);

  if (!panchanga) {
    return null;
  }

  const { tithi, nakshatra, yoga, karana, vara, provenance } = panchanga;

  // Format short time (HH:mm) from local ISO or local string
  const formatTimeOnly = (localStr?: string) => {
    if (!localStr) return "—";
    // localStr is sv-SE: "YYYY-MM-DD HH:mm:ss"
    const parts = localStr.split(" ");
    return parts.length > 1 ? parts[1].substring(0, 5) : localStr;
  };

  const formatDateShort = (localStr?: string) => {
    if (!localStr) return "";
    const parts = localStr.split(" ");
    if (parts.length < 1) return "";
    const d = parts[0].split("-");
    return d.length === 3 ? `${d[1]}/${d[2]}` : parts[0];
  };

  return (
    <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl transition-all">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Moon className="h-4 w-4 text-amber-400" />
              Panchanga Summary
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              (5 Vedic Limbs)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Derived deterministically from CanonicalChart Sun &amp; Moon sidereal longitudes
          </p>
        </div>

        {/* Controls: Vara & Boundary Switch */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Vara Info */}
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <Calendar className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="font-semibold text-amber-300">{vara.name}</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400 capitalize">{vara.mode} Day</span>
          </div>

          {/* Interactive Boundary Toggle Button */}
          <button
            type="button"
            onClick={() => setIncludeBoundaries(!includeBoundaries)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition cursor-pointer ${
              includeBoundaries
                ? "bg-amber-950/40 text-amber-300 border-amber-500/40 hover:bg-amber-950/60"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
            title="Toggle exact transition boundary bisection windows"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Boundaries {includeBoundaries ? "On" : "Off"}</span>
          </button>
        </div>
      </div>

      {/* 4-Column Grid: Tithi, Nakshatra, Yoga, Karana */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ==================================================================== */}
        {/* Card 1: Tithi (Lunar Day) */}
        {/* ==================================================================== */}
        <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700/80 transition group">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-1.5">
              <span className="flex items-center gap-1.5 text-amber-400 font-semibold uppercase tracking-wider text-[11px]">
                <Moon className="h-3.5 w-3.5" />
                Tithi {tithi.index} / 30
              </span>
              <span className="text-slate-400 capitalize">
                {tithi.paksha} {tithi.numberInPaksha}
              </span>
            </div>

            <div className="mt-1">
              <h4 className="text-lg font-bold text-slate-100 tracking-tight">
                {tithi.name}
              </h4>
              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>{tithi.paksha === "shukla" ? "Waxing (Bright)" : "Waning (Dark)"}</span>
                <span className="text-slate-600">·</span>
                <span className="font-mono text-slate-400">
                  {tithi.elongationDeg.toFixed(2)}° elong
                </span>
              </div>
            </div>

            {/* Elongation Progress Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-1">
                <span>Elapsed</span>
                <span className="text-slate-300 font-medium">
                  {Math.round(tithi.fractionElapsed * 100)}%
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, tithi.fractionElapsed * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Transition Window */}
          {tithi.window?.startLocal && tithi.window?.endLocal && (
            <div className="mt-4 pt-3 border-t border-slate-800/60 text-xs font-mono">
              <div className="text-[10px] uppercase text-slate-500 tracking-wider mb-1">
                Transition Window
              </div>
              <div className="flex items-center justify-between text-slate-300 text-[11px]">
                <span title={`Start: ${tithi.window.startLocal}`}>
                  {formatDateShort(tithi.window.startLocal)} {formatTimeOnly(tithi.window.startLocal)}
                </span>
                <ArrowRight className="h-3 w-3 text-slate-600 shrink-0 mx-1" />
                <span title={`End: ${tithi.window.endLocal}`}>
                  {formatDateShort(tithi.window.endLocal)} {formatTimeOnly(tithi.window.endLocal)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* Card 2: Nakshatra (Lunar Mansion) */}
        {/* ==================================================================== */}
        <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700/80 transition group">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-1.5">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold uppercase tracking-wider text-[11px]">
                <Sparkles className="h-3.5 w-3.5" />
                Nakshatra {nakshatra.index} / 27
              </span>
              <span className="text-slate-300 font-bold">
                Pada {nakshatra.pada}
              </span>
            </div>

            <div className="mt-1">
              <h4 className="text-lg font-bold text-slate-100 tracking-tight">
                {nakshatra.name}
              </h4>
              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Moon: {formatDms(nakshatra.moonLongitudeDeg % (360 / 27))} in division</span>
              </div>
            </div>

            {/* 4 Padas Indicator Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-1">
                <span>Pada Progress</span>
                <span className="text-slate-300 font-medium">
                  {Math.round(nakshatra.fractionElapsed * 100)}%
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 h-1.5">
                {[1, 2, 3, 4].map((p) => {
                  const isActive = p === nakshatra.pada;
                  const isPassed = p < nakshatra.pada;
                  return (
                    <div
                      key={p}
                      className={`h-full rounded-sm transition-colors ${
                        isActive
                          ? "bg-emerald-400"
                          : isPassed
                          ? "bg-emerald-700/60"
                          : "bg-slate-800"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Transition Window */}
          {nakshatra.window?.startLocal && nakshatra.window?.endLocal && (
            <div className="mt-4 pt-3 border-t border-slate-800/60 text-xs font-mono">
              <div className="text-[10px] uppercase text-slate-500 tracking-wider mb-1">
                Transition Window
              </div>
              <div className="flex items-center justify-between text-slate-300 text-[11px]">
                <span title={`Start: ${nakshatra.window.startLocal}`}>
                  {formatDateShort(nakshatra.window.startLocal)} {formatTimeOnly(nakshatra.window.startLocal)}
                </span>
                <ArrowRight className="h-3 w-3 text-slate-600 shrink-0 mx-1" />
                <span title={`End: ${nakshatra.window.endLocal}`}>
                  {formatDateShort(nakshatra.window.endLocal)} {formatTimeOnly(nakshatra.window.endLocal)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* Card 3: Yoga (Solar-Lunar Angular Sum) */}
        {/* ==================================================================== */}
        <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700/80 transition group">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-1.5">
              <span className="flex items-center gap-1.5 text-cyan-400 font-semibold uppercase tracking-wider text-[11px]">
                <Sun className="h-3.5 w-3.5" />
                Yoga {yoga.index} / 27
              </span>
              <span className="text-slate-400 font-mono">
                {yoga.sumDeg.toFixed(1)}° sum
              </span>
            </div>

            <div className="mt-1">
              <h4 className="text-lg font-bold text-slate-100 tracking-tight">
                {yoga.name}
              </h4>
              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                <span>(Sun + Moon) mod 360°</span>
              </div>
            </div>

            {/* Yoga Elapsed Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-1">
                <span>Elapsed</span>
                <span className="text-slate-300 font-medium">
                  {Math.round(yoga.fractionElapsed * 100)}%
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, yoga.fractionElapsed * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Transition Window */}
          {yoga.window?.startLocal && yoga.window?.endLocal && (
            <div className="mt-4 pt-3 border-t border-slate-800/60 text-xs font-mono">
              <div className="text-[10px] uppercase text-slate-500 tracking-wider mb-1">
                Transition Window
              </div>
              <div className="flex items-center justify-between text-slate-300 text-[11px]">
                <span title={`Start: ${yoga.window.startLocal}`}>
                  {formatDateShort(yoga.window.startLocal)} {formatTimeOnly(yoga.window.startLocal)}
                </span>
                <ArrowRight className="h-3 w-3 text-slate-600 shrink-0 mx-1" />
                <span title={`End: ${yoga.window.endLocal}`}>
                  {formatDateShort(yoga.window.endLocal)} {formatTimeOnly(yoga.window.endLocal)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* Card 4: Karana (Half-Tithi) */}
        {/* ==================================================================== */}
        <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700/80 transition group">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-1.5">
              <span className="flex items-center gap-1.5 text-violet-400 font-semibold uppercase tracking-wider text-[11px]">
                <Shield className="h-3.5 w-3.5" />
                Karana {karana.halfTithiIndex} / 60
              </span>
              <span className="text-slate-400 capitalize">
                {karana.kind}
              </span>
            </div>

            <div className="mt-1">
              <h4 className="text-lg font-bold text-slate-100 tracking-tight">
                {karana.name}
              </h4>
              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>{karana.kind === "movable" ? "7 Movable Cycle (x8)" : "4 Fixed Karanas"}</span>
                <span className="text-slate-600">·</span>
                <span>6° segment</span>
              </div>
            </div>

            {/* Karana cycle indicator */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-1">
                <span>Cycle Position</span>
                <span className="text-slate-300 font-medium">
                  {karana.halfTithiIndex % 2 === 1 ? "1st Half" : "2nd Half"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 h-1.5">
                <div
                  className={`h-full rounded-sm ${
                    karana.halfTithiIndex % 2 === 1 ? "bg-violet-400" : "bg-violet-900/60"
                  }`}
                />
                <div
                  className={`h-full rounded-sm ${
                    karana.halfTithiIndex % 2 === 0 ? "bg-violet-400" : "bg-slate-800"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Transition Window */}
          {karana.window?.startLocal && karana.window?.endLocal && (
            <div className="mt-4 pt-3 border-t border-slate-800/60 text-xs font-mono">
              <div className="text-[10px] uppercase text-slate-500 tracking-wider mb-1">
                Transition Window
              </div>
              <div className="flex items-center justify-between text-slate-300 text-[11px]">
                <span title={`Start: ${karana.window.startLocal}`}>
                  {formatDateShort(karana.window.startLocal)} {formatTimeOnly(karana.window.startLocal)}
                </span>
                <ArrowRight className="h-3 w-3 text-slate-600 shrink-0 mx-1" />
                <span title={`End: ${karana.window.endLocal}`}>
                  {formatDateShort(karana.window.endLocal)} {formatTimeOnly(karana.window.endLocal)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
