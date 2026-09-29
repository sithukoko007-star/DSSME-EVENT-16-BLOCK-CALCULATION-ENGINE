import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Globe,
  Search,
  Check,
  ChevronDown,
  Clock,
  Sparkles,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  deriveTimezoneOffset,
  isValidIanaTimezone,
  formatOffsetDisplay,
} from "../utils/timezoneHelper.ts";

interface TimezoneSelectProps {
  timezone: string;
  date: string;
  time: string;
  currentOffset: number;
  onTimezoneChange: (newTz: string, autoDerivedOffset?: number) => void;
  onOffsetChange?: (newOffset: number) => void;
}

/**
 * Array of ~50 common IANA timezone identifiers covering
 * all major global regions, including core standards:
 * UTC, Asia/Tokyo, America/New_York, Europe/London, Pacific/Auckland.
 */
export const COMMON_IANA_TIMEZONES: readonly string[] = [
  // Universal
  "UTC",

  // Asia & Middle East
  "Asia/Tokyo",
  "Asia/Yangon",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Bangkok",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Seoul",
  "Asia/Taipei",
  "Asia/Jakarta",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Asia/Karachi",
  "Asia/Manila",
  "Asia/Jerusalem",
  "Asia/Riyadh",

  // Americas - North
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",

  // Americas - South
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",

  // Europe
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Zurich",
  "Europe/Vienna",
  "Europe/Warsaw",
  "Europe/Athens",
  "Europe/Dublin",
  "Europe/Stockholm",
  "Europe/Helsinki",
  "Europe/Lisbon",
  "Europe/Moscow",

  // Pacific & Australasia
  "Pacific/Auckland",
  "Pacific/Honolulu",
  "Pacific/Fiji",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Perth",

  // Africa
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Nairobi",
  "Africa/Lagos",
  "Africa/Casablanca",
] as const;

/**
 * Quick access shortcuts for the most frequently used standards
 */
const QUICK_SHORTCUTS = [
  { label: "UTC", tz: "UTC" },
  { label: "Tokyo", tz: "Asia/Tokyo" },
  { label: "New York", tz: "America/New_York" },
  { label: "London", tz: "Europe/London" },
  { label: "Auckland", tz: "Pacific/Auckland" },
  { label: "Yangon", tz: "Asia/Yangon" },
];

/**
 * Helper to display human-friendly city/region names alongside IANA identifiers
 */
function formatTimezoneDescriptor(tz: string): string {
  if (tz === "UTC") return "Coordinated Universal Time";
  const parts = tz.split("/");
  const city = parts[parts.length - 1]?.replace(/_/g, " ") || tz;
  const region = parts[0] || "";
  return `${city} (${region})`;
}

export const TimezoneSelect: React.FC<TimezoneSelectProps> = ({
  timezone,
  date,
  time,
  currentOffset,
  onTimezoneChange,
  onOffsetChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState(timezone);
  const [isTyping, setIsTyping] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  // Sync internal filter query when parent timezone updates from outside
  useEffect(() => {
    setFilterText(timezone);
    setIsTyping(false);
  }, [timezone]);

  // Derive offset for current civil datetime
  const offsetValidation = useMemo(() => {
    return deriveTimezoneOffset(timezone, date, time);
  }, [timezone, date, time]);

  // Filter ~50 common IANA timezone options as the user types
  const filteredOptions = useMemo(() => {
    const raw = filterText.trim().toLowerCase();
    // If query is empty or unchanged from active selection (and user is not actively typing), show all options
    if (!raw || (!isTyping && raw === timezone.toLowerCase())) {
      return COMMON_IANA_TIMEZONES;
    }

    const underscore = raw.replace(/\s+/g, "_");
    const space = raw.replace(/_/g, " ");

    return COMMON_IANA_TIMEZONES.filter((tz) => {
      const lower = tz.toLowerCase();
      const spaced = lower.replace(/_/g, " ");
      const city = lower.split("/").pop() || "";
      const citySpaced = city.replace(/_/g, " ");

      return (
        lower.includes(raw) ||
        lower.includes(underscore) ||
        spaced.includes(space) ||
        city.includes(raw) ||
        citySpaced.includes(space)
      );
    });
  }, [filterText, isTyping, timezone]);

  // Highlight selected timezone when dropdown opens
  useEffect(() => {
    if (isOpen) {
      const idx = filteredOptions.findIndex((opt) => opt === timezone);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsTyping(false);
        if (timezone) {
          setFilterText(timezone);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [timezone]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listboxRef.current) {
      const activeEl = listboxRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  /**
   * Select a timezone value and trigger the offset derivation logic
   */
  const selectTimezone = (selectedTz: string) => {
    setFilterText(selectedTz);
    setIsTyping(false);
    setIsOpen(false);

    // Derive astronomical UTC offset for current date and time
    const result = deriveTimezoneOffset(selectedTz, date, time);
    const derivedOffset =
      result.valid && result.offsetHours !== undefined ? result.offsetHours : undefined;

    // Trigger parent callback to update timezone and offset
    onTimezoneChange(selectedTz, derivedOffset);
    if (onOffsetChange && derivedOffset !== undefined) {
      onOffsetChange(derivedOffset);
    }
  };

  /**
   * Handle user typing in the combobox input
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFilterText(val);
    setIsTyping(true);
    setIsOpen(true);
    setHighlightedIndex(0);

    // If typed value is an exact valid IANA identifier, trigger callback immediately
    if (isValidIanaTimezone(val.trim())) {
      const result = deriveTimezoneOffset(val.trim(), date, time);
      const derived =
        result.valid && result.offsetHours !== undefined ? result.offsetHours : undefined;
      onTimezoneChange(val.trim(), derived);
      if (onOffsetChange && derived !== undefined) {
        onOffsetChange(derived);
      }
    }
  };

  /**
   * Handle focus on input
   */
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsOpen(true);
    e.target.select();
  };

  /**
   * Handle keyboard navigation within the combobox
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        setIsOpen(true);
        return;
      }
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 < filteredOptions.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredOptions.length > 0 && highlightedIndex < filteredOptions.length) {
        selectTimezone(filteredOptions[highlightedIndex]);
      } else if (isValidIanaTimezone(filterText.trim())) {
        selectTimezone(filterText.trim());
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setIsTyping(false);
      setFilterText(timezone);
    } else if (e.key === "Tab") {
      if (isOpen && filteredOptions.length > 0) {
        selectTimezone(filteredOptions[highlightedIndex]);
      }
    }
  };

  const isExactValid = isValidIanaTimezone(timezone);

  return (
    <div id="timezone-input-container" ref={containerRef} className="relative">
      {/* Label and Live Offset Indicator */}
      <label
        htmlFor="timezone-input"
        className="block text-xs font-medium text-slate-400 mb-1 flex items-center justify-between"
      >
        <span className="flex items-center gap-1">
          <Globe className="h-3.5 w-3.5 text-slate-500" />
          Timezone Name (IANA)
        </span>
        {offsetValidation.valid && offsetValidation.formattedOffset && (
          <span className="font-mono text-[11px] text-amber-400 font-semibold flex items-center gap-1">
            <Clock className="h-3 w-3 text-amber-400" />
            {offsetValidation.formattedOffset}
          </span>
        )}
      </label>

      {/* Searchable Combobox Input */}
      <div className="relative">
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
          <Search className="h-3.5 w-3.5" />
        </div>

        <input
          ref={inputRef}
          id="timezone-input"
          data-testid="timezone-input"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="timezone-dropdown"
          type="text"
          value={filterText}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="Search e.g. UTC, Asia/Tokyo, America/New_York..."
          autoComplete="off"
          spellCheck={false}
          className={`w-full pl-8 pr-16 py-1.5 bg-slate-950 border rounded-lg text-sm text-slate-100 focus:outline-none font-mono transition ${
            !isExactValid && filterText.trim() !== ""
              ? "border-rose-500/80 focus:border-rose-400"
              : isExactValid
              ? "border-emerald-600/70 focus:border-emerald-400"
              : "border-slate-800 focus:border-amber-500"
          }`}
        />

        {/* Clear & Dropdown Toggle Actions */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {filterText && (
            <button
              type="button"
              onClick={() => {
                setFilterText("");
                setIsTyping(true);
                onTimezoneChange("");
                inputRef.current?.focus();
                setIsOpen(true);
              }}
              className="p-1 text-slate-500 hover:text-slate-300 transition"
              title="Clear input"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsOpen((prev) => !prev);
              if (!isOpen) {
                inputRef.current?.focus();
              }
            }}
            className="p-1 text-slate-500 hover:text-slate-300 transition"
            title="Toggle timezone options"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                isOpen ? "rotate-180 text-amber-400" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Validation Status & Manual Offset Sync */}
      <div className="mt-1 flex items-center justify-between text-[11px]">
        {isExactValid ? (
          <span className="text-emerald-400 flex items-center gap-1 font-mono">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            Valid IANA · Auto-synced
          </span>
        ) : filterText.trim() === "" ? (
          <span className="text-slate-500">Select or search an IANA timezone</span>
        ) : (
          <span className="text-rose-400 flex items-center gap-1 font-mono">
            <AlertCircle className="h-3 w-3 text-rose-400" />
            Unrecognized IANA zone
          </span>
        )}

        {offsetValidation.valid &&
          offsetValidation.offsetHours !== undefined &&
          Math.abs(offsetValidation.offsetHours - currentOffset) > 0.001 && (
            <button
              type="button"
              onClick={() => {
                if (offsetValidation.offsetHours !== undefined) {
                  onTimezoneChange(timezone, offsetValidation.offsetHours);
                  if (onOffsetChange) {
                    onOffsetChange(offsetValidation.offsetHours);
                  }
                }
              }}
              className="text-amber-400 hover:text-amber-300 underline font-mono flex items-center gap-1"
              title="Click to sync numeric offset"
            >
              <Sparkles className="h-3 w-3" />
              Sync offset ({offsetValidation.formattedOffset})
            </button>
          )}
      </div>

      {/* Quick Curated Shortcuts */}
      <div className="mt-1.5 flex flex-wrap gap-1 items-center">
        {QUICK_SHORTCUTS.map((p) => (
          <button
            key={p.tz}
            type="button"
            onClick={() => selectTimezone(p.tz)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition border ${
              timezone === p.tz
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                : "bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Searchable Dropdown Options List */}
      {isOpen && (
        <div className="absolute left-0 min-w-[320px] sm:min-w-[420px] max-w-[480px] top-full mt-1.5 z-50 bg-slate-900 border border-slate-700/80 rounded-lg shadow-2xl overflow-hidden backdrop-blur-xl">
          {/* Listbox Header */}
          <div className="px-3 py-1.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1 text-slate-300">
              <Globe className="h-3 w-3 text-amber-400" />
              Common IANA Timezones ({COMMON_IANA_TIMEZONES.length})
            </span>
            <span className="text-amber-400/90 font-medium">
              {filteredOptions.length} match{filteredOptions.length === 1 ? "" : "es"}
            </span>
          </div>

          {/* Options List */}
          <ul
            ref={listboxRef}
            id="timezone-dropdown"
            data-testid="timezone-dropdown"
            role="listbox"
            className="max-h-64 overflow-y-auto divide-y divide-slate-800/50 text-xs font-mono"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-5 text-center text-slate-500">
                No common timezones match "{filterText}"
                <div className="text-[11px] text-slate-400 mt-1">
                  Press Enter to apply "{filterText}" directly if it's a valid IANA zone.
                </div>
              </li>
            ) : (
              filteredOptions.map((tz, index) => {
                const isHighlighted = index === highlightedIndex;
                const isSelected = timezone === tz;
                const preview = deriveTimezoneOffset(tz, date, time);
                const descriptor = formatTimezoneDescriptor(tz);

                return (
                  <li
                    key={tz}
                    role="option"
                    data-testid="timezone-option"
                    data-value={tz}
                    aria-selected={isSelected}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectTimezone(tz);
                    }}
                    onClick={() => selectTimezone(tz)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-3 py-2 cursor-pointer flex items-center justify-between transition ${
                      isHighlighted
                        ? "bg-amber-500/15 text-white"
                        : isSelected
                        ? "bg-slate-800/60 text-amber-300"
                        : "text-slate-300 hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                        {isSelected && <Check className="h-3 w-3 text-amber-400 flex-shrink-0" />}
                        <span>{tz}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{descriptor}</span>
                    </div>

                    <div className="text-right flex-shrink-0 ml-3">
                      {preview.valid && preview.formattedOffset ? (
                        <span className="text-amber-400 font-mono text-[11px] font-medium">
                          {preview.formattedOffset}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">—</span>
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          {/* Keyboard Hints Footer */}
          <div className="px-3 py-1.5 border-t border-slate-800 bg-slate-950/80 text-[10px] text-slate-500 flex justify-between items-center font-mono">
            <span>↑↓ Navigate · ↵ Select · Esc Close</span>
            <span className="text-slate-400">Updates offset automatically</span>
          </div>
        </div>
      )}
    </div>
  );
};
