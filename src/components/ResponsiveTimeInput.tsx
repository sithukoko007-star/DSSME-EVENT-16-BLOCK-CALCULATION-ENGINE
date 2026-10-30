import React, { useState, useEffect, useRef } from "react";
import { Clock, Keyboard, AlertCircle, Check, X } from "lucide-react";
import {
  validateCanonicalTime,
  parseTimeSegments,
  type TimeSegments,
} from "../utils/timeValidation.ts";

interface ResponsiveTimeInputProps {
  /** Authoritative HH:MM:SS string from CanonicalChart input state */
  value: string;
  /** Updates the single canonical time state in parent without touching Date/TZ/Coords */
  onChange: (newCanonicalTime: string) => void;
  /** Reports validation status to parent so Compute button can be guarded */
  onValidationChange?: (isValid: boolean) => void;
  disabled?: boolean;
}

type ActiveSegment = "hour" | "minute" | "second";

const HOURS_LIST = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0")
);
const MINUTES_SECONDS_LIST = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0")
);

export const ResponsiveTimeInput: React.FC<ResponsiveTimeInputProps> = ({
  value,
  onChange,
  onValidationChange,
  disabled = false,
}) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeSegment, setActiveSegment] = useState<ActiveSegment>("hour");
  const [isDirectKeyboardMode, setIsDirectKeyboardMode] = useState(false);

  // Ephemeral draft segments used ONLY while the mobile bottom sheet is open.
  // Single source of truth remains `value` in parent state.
  const [draft, setDraft] = useState<TimeSegments>(() =>
    parseTimeSegments(value)
  );
  const [sheetError, setSheetError] = useState<string | null>(null);

  const hourInputRef = useRef<HTMLInputElement>(null);
  const minuteInputRef = useRef<HTMLInputElement>(null);
  const secondInputRef = useRef<HTMLInputElement>(null);

  const hourWheelRef = useRef<HTMLDivElement>(null);
  const minuteWheelRef = useRef<HTMLDivElement>(null);
  const secondWheelRef = useRef<HTMLDivElement>(null);

  const validation = validateCanonicalTime(value);

  useEffect(() => {
    onValidationChange?.(validation.isValid);
  }, [validation.isValid, onValidationChange]);

  // Keep draft synced when parent value changes (e.g., when a Preset is clicked)
  useEffect(() => {
    if (!isSheetOpen) {
      setDraft(parseTimeSegments(value));
    }
  }, [value, isSheetOpen]);

  // Scroll wheel columns to active item when bottom sheet opens
  useEffect(() => {
    if (!isSheetOpen || isDirectKeyboardMode) return;
    const scrollWheelTo = (
      container: HTMLDivElement | null,
      index: number
    ) => {
      if (!container) return;
      const itemHeight = 48;
      container.scrollTo({
        top: index * itemHeight,
        behavior: "smooth",
      });
    };

    const timer = window.setTimeout(() => {
      scrollWheelTo(hourWheelRef.current, parseInt(draft.hour, 10) || 0);
      scrollWheelTo(minuteWheelRef.current, parseInt(draft.minute, 10) || 0);
      scrollWheelTo(secondWheelRef.current, parseInt(draft.second, 10) || 0);
    }, 60);

    return () => window.clearTimeout(timer);
  }, [isSheetOpen, isDirectKeyboardMode]);

  // Lock background body scroll while mobile bottom sheet is open
  useEffect(() => {
    if (!isSheetOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isSheetOpen]);

  const openMobilePicker = (initialSegment: ActiveSegment = "hour") => {
    if (disabled) return;
    setDraft(parseTimeSegments(value));
    setActiveSegment(initialSegment);
    setSheetError(null);
    setIsSheetOpen(true);
  };

  const handleCancelSheet = () => {
    setDraft(parseTimeSegments(value));
    setSheetError(null);
    setIsDirectKeyboardMode(false);
    setIsSheetOpen(false);
  };

  const handleConfirmSheet = () => {
    const candidate = `${draft.hour.padStart(2, "0")}:${draft.minute.padStart(
      2,
      "0"
    )}:${draft.second.padStart(2, "0")}`;
    const result = validateCanonicalTime(candidate);

    if (!result.isValid || !result.canonicalValue) {
      setSheetError(
        result.errorMessage ?? "အချိန်တန်ဖိုး မမှန်ကန်ပါ (HH:MM:SS)။"
      );
      return;
    }

    onChange(result.canonicalValue);
    setSheetError(null);
    setIsDirectKeyboardMode(false);
    setIsSheetOpen(false);
  };

  // Auto-advance segment input handler for direct numeric entry
  const handleSegmentKeyInput = (
    segment: ActiveSegment,
    rawInput: string
  ) => {
    const digitsOnly = rawInput.replace(/\D/g, "").slice(0, 2);
    setSheetError(null);

    if (segment === "hour") {
      const num = parseInt(digitsOnly, 10);
      if (digitsOnly.length === 2 && num > 23) {
        setSheetError("နာရီသည် 00 မှ 23 အတွင်းသာ ဖြစ်ရပါမည်။");
        return;
      }
      setDraft((prev) => ({ ...prev, hour: digitsOnly }));
      // Auto-advance to Minute after 2 valid digits
      if (digitsOnly.length === 2) {
        setActiveSegment("minute");
        minuteInputRef.current?.focus();
        minuteInputRef.current?.select();
      }
    } else if (segment === "minute") {
      const num = parseInt(digitsOnly, 10);
      if (digitsOnly.length === 2 && num > 59) {
        setSheetError("မိနစ်သည် 00 မှ 59 အတွင်းသာ ဖြစ်ရပါမည်။");
        return;
      }
      setDraft((prev) => ({ ...prev, minute: digitsOnly }));
      if (digitsOnly.length === 2) {
        setActiveSegment("second");
        secondInputRef.current?.focus();
        secondInputRef.current?.select();
      }
    } else {
      const num = parseInt(digitsOnly, 10);
      if (digitsOnly.length === 2 && num > 59) {
        setSheetError("စက္ကန့်သည် 00 မှ 59 အတွင်းသာ ဖြစ်ရပါမည်။");
        return;
      }
      setDraft((prev) => ({ ...prev, second: digitsOnly }));
    }
  };

  const handleSegmentBlur = (segment: ActiveSegment) => {
    setDraft((prev) => {
      const raw = prev[segment];
      const max = segment === "hour" ? 23 : 59;
      const numeric = Math.max(0, Math.min(max, parseInt(raw || "0", 10) || 0));
      return {
        ...prev,
        [segment]: String(numeric).padStart(2, "0"),
      };
    });
  };

  const handleWheelScroll = (
    segment: ActiveSegment,
    e: React.UIEvent<HTMLDivElement>
  ) => {
    const itemHeight = 48;
    const index = Math.round(e.currentTarget.scrollTop / itemHeight);
    const max = segment === "hour" ? 23 : 59;
    const clamped = Math.max(0, Math.min(max, index));
    const formatted = String(clamped).padStart(2, "0");

    setDraft((prev) =>
      prev[segment] === formatted ? prev : { ...prev, [segment]: formatted }
    );
  };

  const displaySegments = parseTimeSegments(value);

  return (
    <div className="w-full">
      {/* Label matching existing DSSME parameter label style */}
      <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5 font-medium">
        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>Time (HH:MM:SS)</span>
      </label>

      {/* =====================================================================
          1. DESKTOP VIEW (> 768px): Unchanged Canonical Text Input
         ===================================================================== */}
      <div className="hidden md:block">
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="HH:MM:SS"
          aria-label="Time (HH:MM:SS)"
          className={`w-full bg-[#090d16] text-slate-100 font-mono text-sm px-3 py-2.5 rounded-lg border transition-colors focus:outline-none ${
            validation.isValid
              ? "border-slate-800 focus:border-amber-500"
              : "border-rose-500/80 focus:border-rose-500"
          }`}
        />
      </div>

      {/* =====================================================================
          2. MOBILE VIEW (<= 768px): Full-Width 48px+ Touch-Friendly Trigger
         ===================================================================== */}
      <div className="block md:hidden">
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Select Chart Time (HH:MM:SS)"
          onClick={() => openMobilePicker("hour")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openMobilePicker("hour");
            }
          }}
          className={`w-full min-h-[48px] bg-[#090d16] px-3.5 py-2.5 rounded-lg border flex items-center justify-between cursor-pointer select-none active:scale-[0.99] transition-all ${
            isSheetOpen
              ? "border-amber-500 ring-1 ring-amber-500/30"
              : validation.isValid
              ? "border-slate-800 hover:border-amber-500/60"
              : "border-rose-500/80"
          }`}
        >
          <div className="flex items-center gap-1.5 font-mono text-base font-semibold tracking-wider text-slate-100">
            <span
              onClick={(e) => {
                e.stopPropagation();
                openMobilePicker("hour");
              }}
              className="px-2 py-1 rounded bg-slate-900/90 border border-slate-800 text-amber-400"
            >
              {displaySegments.hour}
            </span>
            <span className="text-slate-500 font-bold">:</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                openMobilePicker("minute");
              }}
              className="px-2 py-1 rounded bg-slate-900/90 border border-slate-800 text-amber-400"
            >
              {displaySegments.minute}
            </span>
            <span className="text-slate-500 font-bold">:</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                openMobilePicker("second");
              }}
              className="px-2 py-1 rounded bg-slate-900/90 border border-slate-800 text-cyan-400"
            >
              {displaySegments.second}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
              24H
            </span>
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
        </div>
      </div>

      {/* Inline Validation Message (Both Desktop & Mobile) */}
      {!validation.isValid && validation.errorMessage && (
        <div
          role="alert"
          className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-400 font-medium"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{validation.errorMessage}</span>
        </div>
      )}

      {/* =====================================================================
          3. MOBILE BOTTOM-SHEET INTERFACE (<= 768px)
         ===================================================================== */}
      {isSheetOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity animate-fadeIn"
            onClick={handleCancelSheet}
            aria-hidden="true"
          />

          {/* Bottom Sheet Panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-time-picker-title"
            className="relative z-10 w-full max-w-full bg-[#0b1120] border-t border-slate-800 rounded-t-2xl shadow-2xl px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-slate-100 transition-transform duration-200 ease-out"
          >
            {/* Drag Handle Pill */}
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3" />

            {/* Header: SELECT CHART TIME */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/90">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <h2
                  id="mobile-time-picker-title"
                  className="text-xs font-bold tracking-wider uppercase text-slate-200"
                >
                  SELECT CHART TIME
                </h2>
              </div>

              {/* Toggle Direct Keyboard Entry vs Touch Wheel */}
              <button
                type="button"
                onClick={() => {
                  const nextMode = !isDirectKeyboardMode;
                  setIsDirectKeyboardMode(nextMode);
                  if (nextMode) {
                    window.setTimeout(() => {
                      hourInputRef.current?.focus();
                      hourInputRef.current?.select();
                    }, 50);
                  }
                }}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  isDirectKeyboardMode
                    ? "bg-amber-500/15 border-amber-500 text-amber-300"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>{isDirectKeyboardMode ? "Wheel Mode" : "Keyboard"}</span>
              </button>
            </div>

            {/* Active 24-Hour Time Display Banner (18 : 50 : 00) */}
            <div className="my-4 bg-[#090d16] border border-slate-800/90 rounded-xl p-3 flex flex-col items-center">
              <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-2 font-mono">
                24-Hour Astronomical Local Time
              </div>

              {!isDirectKeyboardMode ? (
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  {/* Hour Segment Button */}
                  <button
                    type="button"
                    onClick={() => setActiveSegment("hour")}
                    className={`min-w-[68px] min-h-[52px] px-3 py-2 rounded-xl font-mono text-2xl font-bold border transition-all ${
                      activeSegment === "hour"
                        ? "bg-amber-500/15 border-amber-500 text-amber-400 shadow-sm shadow-amber-500/10"
                        : "bg-slate-900/80 border-slate-800 text-slate-200"
                    }`}
                  >
                    {draft.hour.padStart(2, "0")}
                    <span className="block text-[10px] font-sans font-normal text-slate-400 mt-0.5">
                      HOUR
                    </span>
                  </button>

                  <span className="text-2xl font-mono font-bold text-slate-500">
                    :
                  </span>

                  {/* Minute Segment Button */}
                  <button
                    type="button"
                    onClick={() => setActiveSegment("minute")}
                    className={`min-w-[68px] min-h-[52px] px-3 py-2 rounded-xl font-mono text-2xl font-bold border transition-all ${
                      activeSegment === "minute"
                        ? "bg-amber-500/15 border-amber-500 text-amber-400 shadow-sm shadow-amber-500/10"
                        : "bg-slate-900/80 border-slate-800 text-slate-200"
                    }`}
                  >
                    {draft.minute.padStart(2, "0")}
                    <span className="block text-[10px] font-sans font-normal text-slate-400 mt-0.5">
                      MIN
                    </span>
                  </button>

                  <span className="text-2xl font-mono font-bold text-slate-500">
                    :
                  </span>

                  {/* Second Segment Button */}
                  <button
                    type="button"
                    onClick={() => setActiveSegment("second")}
                    className={`min-w-[68px] min-h-[52px] px-3 py-2 rounded-xl font-mono text-2xl font-bold border transition-all ${
                      activeSegment === "second"
                        ? "bg-amber-500/15 border-amber-500 text-amber-400 shadow-sm shadow-amber-500/10"
                        : "bg-slate-900/80 border-slate-800 text-cyan-400"
                    }`}
                  >
                    {draft.second.padStart(2, "0")}
                    <span className="block text-[10px] font-sans font-normal text-slate-400 mt-0.5">
                      SEC
                    </span>
                  </button>
                </div>
              ) : (
                /* Direct Numeric Keyboard Inputs with Auto-Advance after 2 digits */
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  <div className="flex flex-col items-center">
                    <input
                      ref={hourInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      value={draft.hour}
                      onFocus={(e) => {
                        setActiveSegment("hour");
                        e.currentTarget.select();
                      }}
                      onChange={(e) =>
                        handleSegmentKeyInput("hour", e.target.value)
                      }
                      onBlur={() => handleSegmentBlur("hour")}
                      className="w-[68px] h-[52px] text-center bg-slate-900 border border-amber-500 rounded-xl font-mono text-2xl font-bold text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                      aria-label="Hour (00-23)"
                    />
                    <span className="text-[10px] text-slate-400 mt-1">
                      HOUR (00–23)
                    </span>
                  </div>

                  <span className="text-2xl font-mono font-bold text-slate-500 -mt-4">
                    :
                  </span>

                  <div className="flex flex-col items-center">
                    <input
                      ref={minuteInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      value={draft.minute}
                      onFocus={(e) => {
                        setActiveSegment("minute");
                        e.currentTarget.select();
                      }}
                      onChange={(e) =>
                        handleSegmentKeyInput("minute", e.target.value)
                      }
                      onBlur={() => handleSegmentBlur("minute")}
                      className="w-[68px] h-[52px] text-center bg-slate-900 border border-amber-500 rounded-xl font-mono text-2xl font-bold text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                      aria-label="Minute (00-59)"
                    />
                    <span className="text-[10px] text-slate-400 mt-1">
                      MIN (00–59)
                    </span>
                  </div>

                  <span className="text-2xl font-mono font-bold text-slate-500 -mt-4">
                    :
                  </span>

                  <div className="flex flex-col items-center">
                    <input
                      ref={secondInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      value={draft.second}
                      onFocus={(e) => {
                        setActiveSegment("second");
                        e.currentTarget.select();
                      }}
                      onChange={(e) =>
                        handleSegmentKeyInput("second", e.target.value)
                      }
                      onBlur={() => handleSegmentBlur("second")}
                      className="w-[68px] h-[52px] text-center bg-slate-900 border border-amber-500 rounded-xl font-mono text-2xl font-bold text-cyan-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                      aria-label="Second (00-59)"
                    />
                    <span className="text-[10px] text-slate-400 mt-1">
                      SEC (00–59)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Three Independently Scrollable & Tappable Columns (Hour / Minute / Second) */}
            {!isDirectKeyboardMode && (
              <div className="relative grid grid-cols-3 gap-2 bg-[#090d16] border border-slate-800 rounded-xl p-2 mb-4">
                {/* Column Headers */}
                <div className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800/80">
                  Hour (00–23)
                </div>
                <div className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800/80">
                  Minute (00–59)
                </div>
                <div className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800/80">
                  Second (00–59)
                </div>

                {/* Hour Scroll Column */}
                <div
                  ref={hourWheelRef}
                  onScroll={(e) => handleWheelScroll("hour", e)}
                  className="h-[192px] overflow-y-auto snap-y snap-mandatory scrollbar-none py-[72px]"
                >
                  {HOURS_LIST.map((h) => {
                    const isSelected = draft.hour.padStart(2, "0") === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => {
                          setActiveSegment("hour");
                          setDraft((prev) => ({ ...prev, hour: h }));
                        }}
                        className={`w-full h-[48px] snap-center flex items-center justify-center font-mono text-lg rounded-lg transition-colors ${
                          isSelected
                            ? "bg-amber-500/20 text-amber-400 font-bold border border-amber-500/50"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>

                {/* Minute Scroll Column */}
                <div
                  ref={minuteWheelRef}
                  onScroll={(e) => handleWheelScroll("minute", e)}
                  className="h-[192px] overflow-y-auto snap-y snap-mandatory scrollbar-none py-[72px]"
                >
                  {MINUTES_SECONDS_LIST.map((m) => {
                    const isSelected = draft.minute.padStart(2, "0") === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setActiveSegment("minute");
                          setDraft((prev) => ({ ...prev, minute: m }));
                        }}
                        className={`w-full h-[48px] snap-center flex items-center justify-center font-mono text-lg rounded-lg transition-colors ${
                          isSelected
                            ? "bg-amber-500/20 text-amber-400 font-bold border border-amber-500/50"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>

                {/* Second Scroll Column */}
                <div
                  ref={secondWheelRef}
                  onScroll={(e) => handleWheelScroll("second", e)}
                  className="h-[192px] overflow-y-auto snap-y snap-mandatory scrollbar-none py-[72px]"
                >
                  {MINUTES_SECONDS_LIST.map((s) => {
                    const isSelected = draft.second.padStart(2, "0") === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setActiveSegment("second");
                          setDraft((prev) => ({ ...prev, second: s }));
                        }}
                        className={`w-full h-[48px] snap-center flex items-center justify-center font-mono text-lg rounded-lg transition-colors ${
                          isSelected
                            ? "bg-amber-500/20 text-cyan-300 font-bold border border-amber-500/50"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sheet Validation Error Banner */}
            {sheetError && (
              <div
                role="alert"
                className="mb-3 px-3 py-2 rounded-lg bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{sheetError}</span>
              </div>
            )}

            {/* Actions: CANCEL & DONE (Minimum 48px Touch Targets) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleCancelSheet}
                className="min-h-[48px] w-full rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors active:scale-[0.99]"
              >
                <X className="w-4 h-4" />
                <span>CANCEL</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmSheet}
                className="min-h-[48px] w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition-colors active:scale-[0.99]"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>DONE</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
