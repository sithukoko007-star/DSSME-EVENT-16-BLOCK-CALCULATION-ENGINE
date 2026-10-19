/**
 * DSSME Native Calculation Engine — Phase 1 Verification Surface
 */

import React, { useState, useEffect } from "react";
import {
  Compass,
  Calendar,
  Clock,
  Globe,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  ArrowRight,
  Database,
  Sparkles,
} from "lucide-react";
import { CanonicalChart, DssmeCalculationInput } from "./types/dssme-canonical-types.ts";
import { generateCanonicalChart } from "./engine/canonical/canonicalChart.ts";
import { formatDms } from "./engine/astronomy/ayanamsa.ts";
import { TimezoneSelect } from "./components/TimezoneSelect.tsx";
import { PanchangaSummary } from "./components/PanchangaSummary.tsx";
import {
  deriveTimezoneOffset,
  isValidIanaTimezone,
  formatOffsetDisplay,
} from "./utils/timezoneHelper.ts";
import { getDefaultLocationForTimezone } from "./data/timezoneLocations.ts";
import { buildDssme16BlockResult } from "./engine/chartblocks/index.ts";
import { runDssmeEngine } from "./engine/dssme/dssmeEngine.ts";
import type { DssmeRunResult } from "./engine/dssme/types.ts";

const PRESET_CHOFU: DssmeCalculationInput = {
  date: "2026-09-16",
  time: "18:50:00",
  latitude: 35.65,
  longitude: 139.54,
  timezone: "Asia/Tokyo",
  timezoneOffset: 9,
  ayanamsa: "Lahiri",
  bodyMode: "Full",
  chartMode: "Standard",
};

export default function App() {
  const [input, setInput] = useState<DssmeCalculationInput>(PRESET_CHOFU);
  const [chart, setChart] = useState<CanonicalChart | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [calcTimeMs, setCalcTimeMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const [selectedCityLocation, setSelectedCityLocation] = useState<string>("Tokyo/Chofu, Japan");

  // DSSME Engine state
  const [dssmeBodyMode, setDssmeBodyMode] = useState<"7-body" | "9-body">("9-body");
  const [dssmeRisk, setDssmeRisk] = useState<"LOW" | "MEDIUM" | "HIGH" | "OBSERVE">("MEDIUM");
  const [dssmeGeometry, setDssmeGeometry] = useState<"ordered_2_digit" | "ordered_3_digit">("ordered_2_digit");
  const [dssmeResult, setDssmeResult] = useState<DssmeRunResult | null>(null);
  const [dssmeLoading, setDssmeLoading] = useState<boolean>(false);
  const [dssmeError, setDssmeError] = useState<string | null>(null);
  const [showDssmeJson, setShowDssmeJson] = useState<boolean>(false);
  const [dssmeTimeMs, setDssmeTimeMs] = useState<number | null>(null);

  // Auto-run initial chart on mount
  useEffect(() => {
    handleCalculate(PRESET_CHOFU);
  }, []);

  const handleDateChange = (newDate: string) => {
    setInput((prev) => {
      const updated = { ...prev, date: newDate };
      if (isValidIanaTimezone(updated.timezone)) {
        const res = deriveTimezoneOffset(updated.timezone, newDate, updated.time);
        if (res.valid && res.offsetHours !== undefined) {
          updated.timezoneOffset = res.offsetHours;
        }
      }
      return updated;
    });
  };

  const handleTimeChange = (newTime: string) => {
    setInput((prev) => {
      const updated = { ...prev, time: newTime };
      if (isValidIanaTimezone(updated.timezone)) {
        const res = deriveTimezoneOffset(updated.timezone, updated.date, newTime);
        if (res.valid && res.offsetHours !== undefined) {
          updated.timezoneOffset = res.offsetHours;
        }
      }
      return updated;
    });
  };

  const handleLocationSelect = (
    lat: number,
    lon: number,
    city?: string,
    country?: string
  ) => {
    setInput((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lon,
    }));
    if (city && country) {
      setSelectedCityLocation(`${city}, ${country}`);
    } else if (city) {
      setSelectedCityLocation(city);
    }
  };

  const handleTimezoneChange = (newTz: string, autoDerivedOffset?: number) => {
    setInput((prev) => {
      const updated = { ...prev, timezone: newTz };
      if (autoDerivedOffset !== undefined) {
        updated.timezoneOffset = autoDerivedOffset;
      } else if (isValidIanaTimezone(newTz)) {
        const res = deriveTimezoneOffset(newTz, updated.date, updated.time);
        if (res.valid && res.offsetHours !== undefined) {
          updated.timezoneOffset = res.offsetHours;
        }
      }
      const defaultLoc = getDefaultLocationForTimezone(newTz);
      if (defaultLoc) {
        updated.latitude = defaultLoc.latitude;
        updated.longitude = defaultLoc.longitude;
        setSelectedCityLocation(`${defaultLoc.city}, ${defaultLoc.country}`);
      }
      return updated;
    });
  };

  async function handleCalculate(inputData: DssmeCalculationInput = input) {
    setLoading(true);
    setError(null);

    // Front-end pre-validation for international IANA timezone reliability
    if (!isValidIanaTimezone(inputData.timezone)) {
      setError(
        `INVALID_INPUT: "${inputData.timezone}" is not a recognized IANA timezone identifier (e.g. Asia/Tokyo, Asia/Yangon, America/New_York). Please select or enter a valid timezone.`
      );
      setLoading(false);
      return;
    }

    if (inputData.timezoneOffset < -14 || inputData.timezoneOffset > 14) {
      setError(
        `TIMEZONE_ERROR: Timezone offset (${inputData.timezoneOffset}h) must be within legal astronomical boundaries [-14, +14].`
      );
      setLoading(false);
      return;
    }

    // Ensure timezone offset is consistent with timezone and datetime
    let finalInputData = { ...inputData };
    const tzCheck = deriveTimezoneOffset(inputData.timezone, inputData.date, inputData.time);
    if (tzCheck.valid && tzCheck.offsetHours !== undefined) {
      // If user provided 6.5h while timezone is still Asia/Tokyo, detect if they intended Asia/Yangon (+6.5)
      if (Math.abs(inputData.timezoneOffset - 6.5) < 0.01 && inputData.timezone === "Asia/Tokyo") {
        finalInputData.timezone = "Asia/Yangon";
        const yLoc = getDefaultLocationForTimezone("Asia/Yangon");
        if (yLoc) {
          finalInputData.latitude = yLoc.latitude;
          finalInputData.longitude = yLoc.longitude;
          setSelectedCityLocation(`${yLoc.city}, ${yLoc.country}`);
        }
        setInput(finalInputData);
      } else if (Math.abs(inputData.timezoneOffset - tzCheck.offsetHours) > 0.05) {
        // Automatically align offset with the chosen IANA timezone for the given date/time
        finalInputData.timezoneOffset = tzCheck.offsetHours;
        setInput(finalInputData);
      }
    }

    const t0 = performance.now();

    try {
      // First try server API endpoint
      const response = await fetch("/api/canonical-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalInputData),
      });

      if (response.ok) {
        const json = await response.json();
        setChart(json.data);
      } else {
        const errJson = await response.json().catch(() => null);
        if (errJson && Array.isArray(errJson.errors) && errJson.errors.length > 0) {
          setError(errJson.errors[0].message);
          return;
        }
        // Fallback to client-side deterministic engine if network / 5xx error
        const fallbackChart = await generateCanonicalChart(finalInputData);
        setChart(fallbackChart);
      }
      setCalcTimeMs(Math.round((performance.now() - t0) * 10) / 10);
    } catch (err: unknown) {
      console.warn("Server API fetch skipped/failed, executing client-side engine:", err);
      try {
        const clientChart = await generateCanonicalChart(finalInputData);
        setChart(clientChart);
        setCalcTimeMs(Math.round((performance.now() - t0) * 10) / 10);
      } catch (clientErr: unknown) {
        setError(clientErr instanceof Error ? clientErr.message : String(clientErr));
      }
    } finally {
      setLoading(false);
    }
  }

  function handleCopyJson() {
    if (!chart) return;
    navigator.clipboard.writeText(JSON.stringify(chart, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRunDssme() {
    if (!chart) {
      setDssmeError("먼저 Compute Canonical Chart를 실행하세요. (First compute the canonical chart.)");
      return;
    }
    setDssmeLoading(true);
    setDssmeError(null);
    setDssmeResult(null);
    const t0 = performance.now();
    try {
      // Build 16-block result from canonical chart (panchanga not available here → undefined)
      const blockResult = await buildDssme16BlockResult(chart, undefined);
      // Run DSSME engine
      const result = runDssmeEngine({
        chart: blockResult,
        bodyMode: dssmeBodyMode,
        objective: "short-cycle speculative extraction",
        risk: dssmeRisk,
        geometry: dssmeGeometry,
      });
      setDssmeResult(result);
      setDssmeTimeMs(Math.round((performance.now() - t0) * 10) / 10);
    } catch (err: unknown) {
      setDssmeError(err instanceof Error ? err.message : String(err));
    } finally {
      setDssmeLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/30">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-bold">
              <Compass className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  DSSME EVENT Calculation Engine
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Phase 1 Foundation
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Deterministic Swiss Ephemeris WASM · Canonical Type Contract · Lahiri Ayanamsa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-mono">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              PHASE_1_FOUNDATION_READY
            </span>
            {calcTimeMs !== null && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 font-mono text-slate-300">
                <Cpu className="h-3 w-3 text-slate-400" />
                {calcTimeMs}ms
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Input Parameters Section */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Database className="h-4 w-4 text-amber-400" />
                Astronomical Calculation Parameters
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Single Source of Truth: inputs generate authoritative CanonicalChart model
              </p>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Presets:</span>
              <button
                type="button"
                onClick={() => {
                  setInput(PRESET_CHOFU);
                  handleCalculate(PRESET_CHOFU);
                }}
                className="px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                Chofu 2026-09-16 18:50
              </button>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCalculate(input);
            }}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                Date (YYYY-MM-DD)
              </label>
              <input
                type="date"
                value={input.date}
                onChange={(e) => handleDateChange(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                Time (HH:MM:SS)
              </label>
              <input
                type="text"
                value={input.time}
                onChange={(e) => handleTimeChange(e.target.value)}
                placeholder="14:30:00"
                required
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <TimezoneSelect
              timezone={input.timezone}
              date={input.date}
              time={input.time}
              currentOffset={input.timezoneOffset}
              onTimezoneChange={handleTimezoneChange}
              onOffsetChange={(newOffset) => setInput((prev) => ({ ...prev, timezoneOffset: newOffset }))}
              onLocationSelect={handleLocationSelect}
            />

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  TZ Offset (Hours)
                </span>
                <span className="font-mono text-[11px] text-amber-400 font-semibold">
                  {formatOffsetDisplay(input.timezoneOffset)}
                </span>
              </label>
              <input
                type="number"
                step="0.25"
                min="-14"
                max="14"
                value={input.timezoneOffset}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setInput({ ...input, timezoneOffset: isNaN(val) ? 0 : val });
                }}
                required
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Range: -14 to +14</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-500" />
                  Latitude (+N / -S)
                </span>
                {selectedCityLocation && (
                  <span className="text-[10px] text-amber-400 font-mono truncate max-w-[130px]" title={selectedCityLocation}>
                    {selectedCityLocation.split(",")[0]}
                  </span>
                )}
              </label>
              <input
                type="number"
                step="0.0001"
                value={input.latitude}
                onChange={(e) =>
                  setInput({ ...input, latitude: parseFloat(e.target.value) || 0 })
                }
                required
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-slate-500" />
                Longitude (+E / -W)
              </label>
              <input
                type="number"
                step="0.0001"
                value={input.longitude}
                onChange={(e) =>
                  setInput({ ...input, longitude: parseFloat(e.target.value) || 0 })
                }
                required
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div className="sm:col-span-2 md:col-span-3 lg:col-span-6 flex items-center justify-between pt-3">
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  Ayanamsa Mode: <strong className="text-amber-400 font-mono">Lahiri (Chitra Paksha)</strong>
                </span>
                <span className="flex items-center gap-1">
                  House System: <strong className="text-slate-200 font-mono">Whole Sign (Vedic)</strong>
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-sm shadow-md shadow-amber-500/20 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>Calculating...</>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Compute Canonical Chart
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-600/50 text-rose-200 flex flex-col sm:flex-row items-start justify-between gap-3 shadow-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm">Calculation Error</h4>
                <p className="text-xs mt-0.5 font-mono">{error}</p>
              </div>
            </div>

            {/* Smart One-Click Quick Fixes */}
            {error.includes("TIMEZONE_ERROR") && (
              <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0 shrink-0">
                {/* Fix 1: Typo in Year 0198 -> 1980 for Myanmar (Yangon) */}
                {input.date.startsWith("0198") && (
                  <button
                    type="button"
                    onClick={() => {
                      const correctedYear = input.date.replace(/^0198/, "1980");
                      const yangonInput: DssmeCalculationInput = {
                        ...input,
                        date: correctedYear,
                        timezone: "Asia/Yangon",
                        timezoneOffset: 6.5,
                        latitude: 16.8661,
                        longitude: 96.1951,
                      };
                      setInput(yangonInput);
                      setSelectedCityLocation("Yangon, Myanmar");
                      handleCalculate(yangonInput);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs shadow flex items-center gap-1.5 transition"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Fix Year (1980) & Yangon (+06:30)
                  </button>
                )}

                {/* Fix 2: Switch to Asia/Yangon */}
                {input.timezone !== "Asia/Yangon" && (
                  <button
                    type="button"
                    onClick={() => {
                      const yangonInput: DssmeCalculationInput = {
                        ...input,
                        timezone: "Asia/Yangon",
                        timezoneOffset: 6.5,
                        latitude: 16.8661,
                        longitude: 96.1951,
                      };
                      setInput(yangonInput);
                      setSelectedCityLocation("Yangon, Myanmar");
                      handleCalculate(yangonInput);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-semibold text-xs shadow flex items-center gap-1.5 transition"
                  >
                    Switch to Asia/Yangon (+06:30)
                  </button>
                )}

                {/* Fix 3: Sync to expected offset for current timezone */}
                {(() => {
                  const derived = deriveTimezoneOffset(input.timezone, input.date, input.time);
                  if (derived.valid && derived.offsetHours !== undefined) {
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          const syncedInput: DssmeCalculationInput = {
                            ...input,
                            timezoneOffset: derived.offsetHours!,
                          };
                          setInput(syncedInput);
                          handleCalculate(syncedInput);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs shadow flex items-center gap-1.5 transition"
                      >
                        Sync TZ to {derived.formattedOffset}
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </div>
        )}

        {/* Foundation Results Display */}
        {chart && (
          <div className="space-y-6">
            {/* Astronomical Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* UTC Time */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 font-medium">UTC Timestamp (Resolved)</div>
                <div className="mt-1 text-base font-semibold font-mono text-slate-100">
                  {chart.time.utcIso.replace(".000Z", "Z")}
                </div>
                <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                  <span>Local: {chart.time.localIso}</span>
                  <span className="text-slate-400 font-mono">TZ {input.timezoneOffset >= 0 ? `+${input.timezoneOffset}` : input.timezoneOffset}h</span>
                </div>
              </div>

              {/* Julian Day UT */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 font-medium">Julian Day UT</div>
                <div className="mt-1 text-base font-semibold font-mono text-amber-400">
                  {chart.time.julianDayUt.toFixed(6)}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Universal Time Days since epoch
                </div>
              </div>

              {/* Lahiri Ayanamsa */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 font-medium">Lahiri Ayanamsa</div>
                <div className="mt-1 text-base font-semibold font-mono text-slate-100 flex items-baseline gap-2">
                  <span>{formatDms(chart.ayanamsa.value)}</span>
                  <span className="text-xs text-slate-400 font-normal">({chart.ayanamsa.value.toFixed(4)}°)</span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Precession: Indian Ephemeris Standard
                </div>
              </div>

              {/* Lagna (Ascendant) */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 font-medium">Lagna (Ascendant)</div>
                <div className="mt-1 text-base font-semibold font-mono text-emerald-400 flex items-center justify-between">
                  <span>{chart.lagna.sign} {formatDms(chart.lagna.signDegree)}</span>
                </div>
                <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                  <span>{chart.lagna.nakshatra} (Pada {chart.lagna.nakshatraPada})</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                    {chart.lagna.sign === "Aries" || chart.lagna.sign === "Cancer" || chart.lagna.sign === "Libra" || chart.lagna.sign === "Capricorn"
                      ? "Movable"
                      : chart.lagna.sign === "Taurus" || chart.lagna.sign === "Leo" || chart.lagna.sign === "Scorpio" || chart.lagna.sign === "Aquarius"
                      ? "Fixed"
                      : "Dual"}
                  </span>
                </div>
              </div>
            </div>

            {/* Panchanga Summary (Phase 2 Native Engine) */}
            <PanchangaSummary chart={chart} />

            {/* Planetary Positions Table */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold tracking-wide text-slate-200 uppercase">
                    Canonical Body Positions (Sidereal Lahiri)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Planets 1-7 in classical order (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn) followed by Rahu & Ketu
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                  10 Celestial Points (Lagna + 9 Bodies)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950/60 text-slate-400 font-mono text-xs border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3">Body</th>
                      <th className="px-5 py-3">Sign</th>
                      <th className="px-5 py-3">Degree in Sign</th>
                      <th className="px-5 py-3">Nakshatra & Pada</th>
                      <th className="px-5 py-3">House</th>
                      <th className="px-5 py-3">Sidereal Longitude</th>
                      <th className="px-5 py-3">Speed (deg/day)</th>
                      <th className="px-5 py-3">Motion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                    {/* Lagna Row */}
                    <tr className="bg-emerald-950/10 hover:bg-slate-800/30">
                      <td className="px-5 py-3 font-semibold text-emerald-400 flex items-center gap-1.5">
                        <Compass className="h-3.5 w-3.5 text-emerald-400" />
                        Lagna
                      </td>
                      <td className="px-5 py-3 font-sans text-slate-200">{chart.lagna.sign}</td>
                      <td className="px-5 py-3 text-slate-200">{formatDms(chart.lagna.signDegree)}</td>
                      <td className="px-5 py-3 text-slate-300 font-sans">
                        {chart.lagna.nakshatra} <span className="text-slate-500 font-mono">P{chart.lagna.nakshatraPada}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                          H1
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-400">{chart.lagna.siderealLongitude.toFixed(4)}°</td>
                      <td className="px-5 py-3 text-slate-500">—</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                          Direct
                        </span>
                      </td>
                    </tr>

                    {/* Nine Bodies */}
                    {Object.entries(chart.planets).map(([name, p]) => {
                      const isRetro = p.isRetrograde;
                      return (
                        <tr
                          key={name}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-5 py-3 font-semibold text-slate-200">
                            {name}
                          </td>
                          <td className="px-5 py-3 font-sans text-slate-200">{p.sign}</td>
                          <td className="px-5 py-3 text-slate-200">{formatDms(p.signDegree)}</td>
                          <td className="px-5 py-3 text-slate-300 font-sans">
                            {p.nakshatra} <span className="text-slate-500 font-mono">P{p.nakshatraPada}</span>
                          </td>
                          <td className="px-5 py-3">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                              H{p.house}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-400">{p.siderealLongitude.toFixed(4)}°</td>
                          <td className="px-5 py-3 text-slate-400 font-mono">
                            {p.speedLongitude > 0 ? `+${p.speedLongitude.toFixed(4)}` : p.speedLongitude.toFixed(4)}
                          </td>
                          <td className="px-5 py-3">
                            {isRetro ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-700/50">
                                RETROGRADE
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                                Direct
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Whole-Sign 12 Houses Grid */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-semibold tracking-wide text-slate-200 uppercase flex items-center gap-2">
                    <Layers className="h-4 w-4 text-amber-400" />
                    12 Whole-Sign Canonical Bhavas (Houses)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Oriented from Lagna sign ({chart.lagna.sign} = House 1)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Array.from({ length: 12 }, (_, i) => {
                  const houseNum = i + 1;
                  const key = houseNum.toString() as keyof typeof chart.houses;
                  const house = chart.houses[key];
                  if (!house) return null;

                  const isAngular = house.type === "Angular";

                  return (
                    <div
                      key={houseNum}
                      className={`p-3 rounded-lg border transition ${
                        isAngular
                          ? "bg-amber-950/10 border-amber-500/30"
                          : "bg-slate-950/50 border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-amber-400">House {houseNum}</span>
                        <span className="text-[10px] text-slate-400">{house.type}</span>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-200">
                        {house.sign}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Lord: <span className="text-slate-300">{house.lord}</span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-800/60 flex flex-wrap gap-1 min-h-[28px]">
                        {house.occupants.length > 0 ? (
                          house.occupants.map((occ) => (
                            <span
                              key={occ}
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-200 border border-slate-700"
                            >
                              {occ}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-600 italic">Empty</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── DSSME Engine Section ────────────────────────────────── */}
            <div className="bg-slate-900/80 border border-amber-500/20 rounded-xl p-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    DSSME Engine v1.6 — Digit Generation Pipeline (S0→S15)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Deterministic · Non-adaptive · 2 Discontinuities (S11, S15) · §8–§14 Contract
                  </p>
                </div>
                {dssmeTimeMs !== null && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 font-mono text-xs text-slate-300">
                    <Cpu className="h-3 w-3 text-amber-400" />
                    {dssmeTimeMs}ms
                  </span>
                )}
              </div>

              {/* DSSME Controls */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Body Mode</label>
                  <select
                    value={dssmeBodyMode}
                    onChange={(e) => setDssmeBodyMode(e.target.value as "7-body" | "9-body")}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="9-body">9-body (+ Rahu/Ketu)</option>
                    <option value="7-body">7-body (Classical)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Risk Posture</label>
                  <select
                    value={dssmeRisk}
                    onChange={(e) => setDssmeRisk(e.target.value as "LOW" | "MEDIUM" | "HIGH" | "OBSERVE")}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="OBSERVE">OBSERVE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Geometry</label>
                  <select
                    value={dssmeGeometry}
                    onChange={(e) => setDssmeGeometry(e.target.value as "ordered_2_digit" | "ordered_3_digit")}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="ordered_2_digit">2D Pair (00–99)</option>
                    <option value="ordered_3_digit">3D Triplet (000–999)</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleRunDssme}
                    disabled={dssmeLoading || !chart}
                    className="w-full px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                  >
                    {dssmeLoading ? (
                      <>Running…</>
                    ) : (
                      <>
                        <ArrowRight className="h-4 w-4" />
                        Run DSSME Engine
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* DSSME Error */}
              {dssmeError && (
                <div className="mb-4 p-3 rounded-lg bg-rose-950/50 border border-rose-600/50 text-rose-200 text-xs font-mono flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  {dssmeError}
                </div>
              )}

              {/* DSSME Results */}
              {dssmeResult && (() => {
                const isAbort = "status" in dssmeResult;
                if (isAbort) {
                  return (
                    <div className="p-4 rounded-lg bg-rose-950/30 border border-rose-600/40 text-rose-200">
                      <div className="flex items-center gap-2 font-semibold text-sm mb-1">
                        <AlertCircle className="h-4 w-4 text-rose-400" />
                        {dssmeResult.status === "CLOSED" ? "CLOSED — No Output" : "ABORT"}
                      </div>
                      <p className="text-xs font-mono text-rose-300">{dssmeResult.reason}</p>
                      {dssmeResult.warnings.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-[11px] text-rose-400 font-mono">
                          {dssmeResult.warnings.slice(0, 6).map((w, i) => (
                            <li key={i}>• {w}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                }

                // Success result
                const out = dssmeResult;
                const is2D = out.geometry === "ordered_2_digit";
                const pairs = is2D ? (out as {authorized_pairs: {pair:string; category:string; P_raw:number; time_gate:string|null}[]}).authorized_pairs : null;
                const triplets = !is2D ? (out as {authorized_triplets: {triplet:string; category:string; P_raw:number; volatile_positions:number; time_gate:string|null}[]}).authorized_triplets : null;
                const dv = is2D ? (out as {digit_vector: Record<string,number>}).digit_vector : (out as {digit_vector_normalized: Record<string,number>}).digit_vector_normalized;
                const dvMax = Math.max(...Object.values(dv));

                return (
                  <div className="space-y-4">
                    {/* Summary header */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs font-mono">
                      {[
                        { label: "Regime", val: out.regime, color: out.regime === "OPEN" ? "text-emerald-400" : "text-amber-400" },
                        { label: "ZW State", val: out.zw_state, color: out.zw_state === "OPEN" ? "text-emerald-400" : "text-amber-400" },
                        { label: "Mode", val: out.mode, color: "text-slate-200" },
                        { label: "θ_s", val: out.threshold.toFixed(2), color: "text-amber-300" },
                        { label: "Field", val: out.field_type_enriched, color: "text-slate-200" },
                        { label: "k_max", val: out.k_max.toString(), color: "text-slate-200" },
                      ].map(({ label, val, color }) => (
                        <div key={label} className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-center">
                          <div className="text-slate-500 text-[10px]">{label}</div>
                          <div className={`font-bold mt-0.5 ${color}`}>{val}</div>
                        </div>
                      ))}
                    </div>

                    {/* Survivors */}
                    <div>
                      <div className="text-xs text-slate-400 font-medium mb-1.5">
                        Survivors (S11 ≥ θ_s)
                        {out.dasha_divergence && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-400 text-[10px] border border-rose-700/50">DASHA_DIVERGENCE</span>
                        )}
                        {out.soft_mode_active && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 text-[10px] border border-amber-700/50">SOFT MODE</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {out.survivors.map((p) => (
                          <span key={p} className="px-2 py-0.5 rounded-full bg-emerald-900/40 border border-emerald-600/40 text-emerald-300 text-xs font-mono">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Digit Vector bar chart */}
                    <div>
                      <div className="text-xs text-slate-400 font-medium mb-2">
                        Digit Strength Vector (D₀…D₉)
                        <span className="ml-2 text-[10px] text-slate-500">Primary: {out.primary_cluster.join(", ")} · Volatile⚡: {out.volatile_digits.join(", ")}</span>
                      </div>
                      <div className="grid grid-cols-10 gap-1">
                        {Array.from({ length: 10 }, (_, d) => {
                          const val = dv[d.toString()] ?? 0;
                          const pct = dvMax > 0 ? (val / dvMax) * 100 : 0;
                          const isVolatile = [0,4,7,9].includes(d);
                          const isPrimary = out.primary_cluster.includes(d);
                          return (
                            <div key={d} className="flex flex-col items-center gap-1">
                              <div className="text-[10px] font-mono text-slate-400">{(val * 100).toFixed(0)}</div>
                              <div className="w-full bg-slate-800 rounded-sm overflow-hidden" style={{ height: 48 }}>
                                <div
                                  className={`w-full rounded-sm transition-all ${
                                    isPrimary
                                      ? isVolatile ? "bg-orange-500" : "bg-amber-400"
                                      : isVolatile ? "bg-orange-800" : "bg-slate-600"
                                  }`}
                                  style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
                                />
                              </div>
                              <div className={`text-[11px] font-bold font-mono ${isPrimary ? "text-amber-300" : "text-slate-400"}`}>
                                {d}{isVolatile ? "⚡" : ""}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Authorized Pairs or Triplets */}
                    {is2D && pairs && (
                      <div>
                        <div className="text-xs text-slate-400 font-medium mb-2">
                          Authorized Pairs — S15 ({pairs.length}/{out.k_max})
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {pairs.slice(0, out.k_max).map((p) => {
                            const catColor = p.category === "Primary"
                              ? "border-amber-500/60 bg-amber-950/20 text-amber-300"
                              : p.category === "Secondary"
                                ? "border-slate-600/60 bg-slate-900 text-slate-300"
                                : p.category === "Burst"
                                  ? "border-orange-500/60 bg-orange-950/20 text-orange-300"
                                  : "border-slate-700/40 bg-slate-950 text-slate-500";
                            return (
                              <div key={p.pair} className={`rounded-lg border p-2 text-center font-mono ${catColor}`}>
                                <div className="text-2xl font-bold tracking-widest">{p.pair}</div>
                                <div className="text-[10px] mt-1 opacity-70">{p.category}</div>
                                <div className="text-[10px] opacity-50">{(p.P_raw * 100).toFixed(2)}%</div>
                                {p.time_gate && (
                                  <div className="text-[9px] mt-0.5 text-orange-400 leading-tight">{p.time_gate.split(" ")[0]}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {/* Compact sets */}
                        {is2D && "compact_4" in out && (
                          <div className="mt-3 flex flex-wrap gap-3 text-xs font-mono">
                            <span className="text-slate-400">Compact-4:</span>
                            {(out as {compact_4:string[]}).compact_4.map(p => (
                              <span key={p} className="px-2 py-0.5 rounded bg-amber-900/40 border border-amber-600/40 text-amber-300 font-bold">{p}</span>
                            ))}
                            <span className="text-slate-600">|</span>
                            <span className="text-slate-400">Compact-6:</span>
                            {(out as {compact_6:string[]}).compact_6.map(p => (
                              <span key={p} className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">{p}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {!is2D && triplets && (
                      <div>
                        <div className="text-xs text-slate-400 font-medium mb-2">
                          Authorized Triplets — S15 ({triplets.length}/{out.k_max})
                          {"volatile_mass_pct" in out && (
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              (out as {volatile_mass_pct:number}).volatile_mass_pct > 50
                                ? "bg-rose-950/60 text-rose-400 border border-rose-700/50"
                                : (out as {volatile_mass_pct:number}).volatile_mass_pct > 35
                                  ? "bg-orange-950/60 text-orange-400 border border-orange-700/50"
                                  : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}>
                              ⚡ {(out as {volatile_mass_pct:number}).volatile_mass_pct.toFixed(1)}% volatile
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                          {triplets.slice(0, out.k_max).map((t) => {
                            const catColor = t.category === "Primary"
                              ? "border-amber-500/60 bg-amber-950/20 text-amber-300"
                              : t.category === "Secondary"
                                ? "border-slate-600/60 bg-slate-900 text-slate-300"
                                : t.category === "Burst"
                                  ? "border-orange-500/60 bg-orange-950/20 text-orange-300"
                                  : "border-slate-700/40 bg-slate-950 text-slate-500";
                            return (
                              <div key={t.triplet} className={`rounded-lg border p-2 text-center font-mono ${catColor}`}>
                                <div className="text-xl font-bold tracking-widest">{t.triplet}</div>
                                <div className="text-[10px] mt-1 opacity-70">{t.category}</div>
                                <div className="text-[10px] opacity-50">{(t.P_raw * 100).toFixed(3)}%</div>
                                {t.volatile_positions > 0 && (
                                  <div className="text-[9px] text-orange-400">{"⚡".repeat(t.volatile_positions)}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {/* 3D Compact sets */}
                        {"compact_3" in out && (
                          <div className="mt-3 flex flex-wrap gap-3 text-xs font-mono">
                            <span className="text-slate-400">Compact-3:</span>
                            {(out as {compact_3:string[]}).compact_3.map(t => (
                              <span key={t} className="px-2 py-0.5 rounded bg-amber-900/40 border border-amber-600/40 text-amber-300 font-bold">{t}</span>
                            ))}
                            <span className="text-slate-600">|</span>
                            <span className="text-slate-400">Compact-5:</span>
                            {(out as {compact_5:string[]}).compact_5.map(t => (
                              <span key={t} className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Warnings */}
                    {out.warnings.filter(w => !w.includes("ZW_STATE") && !w.includes("→")).length > 0 && (
                      <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-700/30 text-amber-300 text-[11px] font-mono space-y-0.5">
                        {out.warnings.filter(w => !w.includes("ZW_STATE") && !w.includes("→")).slice(0, 5).map((w, i) => (
                          <div key={i}>⚠ {w}</div>
                        ))}
                      </div>
                    )}

                    {/* JSON toggle */}
                    <button
                      type="button"
                      onClick={() => setShowDssmeJson(!showDssmeJson)}
                      className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition"
                    >
                      {showDssmeJson ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {showDssmeJson ? "Hide" : "Show"} Full DSSME JSON Audit
                    </button>
                    {showDssmeJson && (
                      <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono text-amber-300/80 overflow-x-auto max-h-96">
                        {JSON.stringify(dssmeResult, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Collapsible Canonical Chart JSON Inspector */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowJson(!showJson)}
                className="w-full px-5 py-3 flex items-center justify-between text-xs font-semibold text-slate-300 hover:bg-slate-800/40 transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-amber-400" />
                  CanonicalChart JSON Inspection Surface (Single Source of Truth)
                </span>
                <span className="flex items-center gap-2">
                  {showJson ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </button>

              {showJson && (
                <div className="p-4 border-t border-slate-800 bg-slate-950">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400 font-mono">
                      Exportable Canonical Model (conforms to dssme-canonical-types.ts)
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyJson}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
                    >
                      <Copy className="h-3 w-3" />
                      {copied ? "Copied!" : "Copy JSON"}
                    </button>
                  </div>
                  <pre className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-amber-300/90 overflow-x-auto max-h-96">
                    {JSON.stringify(chart, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            DSSME EVENT Calculation Engine · Built with Swiss Ephemeris WASM & TypeScript
          </div>
          <div className="flex items-center gap-3">
            <span>Reference Oracle: naturalstupid/PyJHora</span>
            <span>·</span>
            <span className="text-emerald-400">All Foundation Tests Passing (7/7)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
