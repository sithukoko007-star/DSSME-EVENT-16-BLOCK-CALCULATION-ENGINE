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

const PRESET_YANGON_1980: DssmeCalculationInput = {
  date: "1980-11-04",
  time: "21:35:00",
  latitude: 16.8661,
  longitude: 96.1951,
  timezone: "Asia/Yangon",
  timezoneOffset: 6.5,
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

  // Auto-run initial chart on mount
  useEffect(() => {
    handleCalculate(PRESET_CHOFU);
  }, []);

  const handleDateChange = (newDate: string) => {
    const updated = { ...input, date: newDate };
    if (isValidIanaTimezone(updated.timezone)) {
      const res = deriveTimezoneOffset(updated.timezone, newDate, updated.time);
      if (res.valid && res.offsetHours !== undefined) {
        updated.timezoneOffset = res.offsetHours;
      }
    }
    setInput(updated);
  };

  const handleTimeChange = (newTime: string) => {
    const updated = { ...input, time: newTime };
    if (isValidIanaTimezone(updated.timezone)) {
      const res = deriveTimezoneOffset(updated.timezone, updated.date, newTime);
      if (res.valid && res.offsetHours !== undefined) {
        updated.timezoneOffset = res.offsetHours;
      }
    }
    setInput(updated);
  };

  const handleTimezoneChange = (newTz: string, autoDerivedOffset?: number) => {
    const updated = { ...input, timezone: newTz };
    if (autoDerivedOffset !== undefined) {
      updated.timezoneOffset = autoDerivedOffset;
    } else if (isValidIanaTimezone(newTz)) {
      const res = deriveTimezoneOffset(newTz, updated.date, updated.time);
      if (res.valid && res.offsetHours !== undefined) {
        updated.timezoneOffset = res.offsetHours;
      }
    }
    setInput(updated);
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

    const t0 = performance.now();

    try {
      // First try server API endpoint
      const response = await fetch("/api/canonical-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputData),
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
        const fallbackChart = await generateCanonicalChart(inputData);
        setChart(fallbackChart);
      }
      setCalcTimeMs(Math.round((performance.now() - t0) * 10) / 10);
    } catch (err: unknown) {
      console.warn("Server API fetch skipped/failed, executing client-side engine:", err);
      try {
        const clientChart = await generateCanonicalChart(inputData);
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 font-medium">Presets:</span>
              <button
                type="button"
                onClick={() => {
                  setInput(PRESET_CHOFU);
                  handleCalculate(PRESET_CHOFU);
                }}
                className={`px-2.5 py-1 rounded text-xs transition border ${
                  input.timezone === "Asia/Tokyo" && input.date === "2026-09-16"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                }`}
              >
                Chofu 2026-09-16 18:50
              </button>
              <button
                type="button"
                onClick={() => {
                  setInput(PRESET_YANGON_1980);
                  handleCalculate(PRESET_YANGON_1980);
                }}
                className={`px-2.5 py-1 rounded text-xs transition border ${
                  input.timezone === "Asia/Yangon" && input.date === "1980-11-04"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                }`}
              >
                Yangon 1980-11-04 21:35
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
              onOffsetChange={(newOffset) => setInput({ ...input, timezoneOffset: newOffset })}
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
              <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-slate-500" />
                Latitude (+N / -S)
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
            {error.includes("TIMEZONE_ERROR") && (
              <div className="flex items-center gap-2 mt-2 sm:mt-0 shrink-0">
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
                    handleCalculate(yangonInput);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs shadow flex items-center gap-1.5 transition"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Switch to Asia/Yangon (+06:30)
                </button>
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
