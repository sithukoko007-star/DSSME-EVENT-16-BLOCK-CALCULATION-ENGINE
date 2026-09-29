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

export interface CommonTimezoneOption {
  tz: string;
  city: string;
  region: string;
}

/**
 * Curated static list of ~50 common IANA timezone identifiers covering
 * all major global regions, including:
 * UTC, Asia/Tokyo, America/New_York, Europe/London, Pacific/Auckland, Asia/Yangon.
 */
export const COMMON_IANA_TIMEZONES: readonly CommonTimezoneOption[] = [
  // Universal
  { tz: "UTC", city: "UTC", region: "Coordinated Universal Time" },

  // Asia & Middle East
  { tz: "Asia/Tokyo", city: "Tokyo", region: "Japan" },
  { tz: "Asia/Yangon", city: "Yangon", region: "Myanmar (Burma)" },
  { tz: "Asia/Kolkata", city: "Kolkata / New Delhi", region: "India" },
  { tz: "Asia/Dubai", city: "Dubai", region: "United Arab Emirates" },
  { tz: "Asia/Singapore", city: "Singapore", region: "Singapore" },
  { tz: "Asia/Bangkok", city: "Bangkok", region: "Thailand / Indochina" },
  { tz: "Asia/Hong_Kong", city: "Hong Kong", region: "Hong Kong" },
  { tz: "Asia/Shanghai", city: "Shanghai / Beijing", region: "China" },
  { tz: "Asia/Seoul", city: "Seoul", region: "South Korea" },
  { tz: "Asia/Taipei", city: "Taipei", region: "Taiwan" },
  { tz: "Asia/Jakarta", city: "Jakarta", region: "Indonesia" },
  { tz: "Asia/Kathmandu", city: "Kathmandu", region: "Nepal" },
  { tz: "Asia/Dhaka", city: "Dhaka", region: "Bangladesh" },
  { tz: "Asia/Karachi", city: "Karachi", region: "Pakistan" },
  { tz: "Asia/Manila", city: "Manila", region: "Philippines" },
  { tz: "Asia/Jerusalem", city: "Jerusalem", region: "Israel" },
  { tz: "Asia/Riyadh", city: "Riyadh", region: "Saudi Arabia" },

  // Americas - North & Central
  { tz: "America/New_York", city: "New York", region: "US Eastern" },
  { tz: "America/Chicago", city: "Chicago", region: "US Central" },
  { tz: "America/Denver", city: "Denver", region: "US Mountain" },
  { tz: "America/Los_Angeles", city: "Los Angeles", region: "US Pacific" },
  { tz: "America/Phoenix", city: "Phoenix", region: "US Mountain (No DST)" },
  { tz: "America/Anchorage", city: "Anchorage", region: "US Alaska" },
  { tz: "America/Toronto", city: "Toronto / Montreal", region: "Canada Eastern" },
  { tz: "America/Vancouver", city: "Vancouver", region: "Canada Pacific" },
  { tz: "America/Mexico_City", city: "Mexico City", region: "Mexico" },

  // Americas - South
  { tz: "America/Sao_Paulo", city: "São Paulo / Rio", region: "Brazil" },
  { tz: "America/Buenos_Aires", city: "Buenos Aires", region: "Argentina" },
  { tz: "America/Bogota", city: "Bogota", region: "Colombia" },
  { tz: "America/Lima", city: "Lima", region: "Peru" },
  { tz: "America/Santiago", city: "Santiago", region: "Chile" },

  // Europe
  { tz: "Europe/London", city: "London", region: "United Kingdom (GMT/BST)" },
  { tz: "Europe/Paris", city: "Paris", region: "France (CET/CEST)" },
  { tz: "Europe/Berlin", city: "Berlin / Frankfurt", region: "Germany (CET/CEST)" },
  { tz: "Europe/Rome", city: "Rome", region: "Italy" },
  { tz: "Europe/Madrid", city: "Madrid / Barcelona", region: "Spain" },
  { tz: "Europe/Amsterdam", city: "Amsterdam", region: "Netherlands" },
  { tz: "Europe/Brussels", city: "Brussels", region: "Belgium" },
  { tz: "Europe/Zurich", city: "Zurich / Geneva", region: "Switzerland" },
  { tz: "Europe/Vienna", city: "Vienna", region: "Austria" },
  { tz: "Europe/Warsaw", city: "Warsaw", region: "Poland" },
  { tz: "Europe/Athens", city: "Athens", region: "Greece" },
  { tz: "Europe/Dublin", city: "Dublin", region: "Ireland" },
  { tz: "Europe/Stockholm", city: "Stockholm", region: "Sweden" },
  { tz: "Europe/Helsinki", city: "Helsinki", region: "Finland" },
  { tz: "Europe/Lisbon", city: "Lisbon", region: "Portugal" },
  { tz: "Europe/Moscow", city: "Moscow", region: "Russia" },

  // Pacific & Australasia
  { tz: "Pacific/Auckland", city: "Auckland / Wellington", region: "New Zealand" },
  { tz: "Pacific/Honolulu", city: "Honolulu", region: "Hawaii" },
  { tz: "Pacific/Fiji", city: "Suva", region: "Fiji" },
  { tz: "Australia/Sydney", city: "Sydney", region: "Australia Eastern" },
  { tz: "Australia/Melbourne", city: "Melbourne", region: "Australia Eastern" },
  { tz: "Australia/Brisbane", city: "Brisbane", region: "Australia (No DST)" },
  { tz: "Australia/Adelaide", city: "Adelaide", region: "Australia Central" },
  { tz: "Australia/Perth", city: "Perth", region: "Australia Western" },

  // Africa
  { tz: "Africa/Cairo", city: "Cairo", region: "Egypt" },
  { tz: "Africa/Johannesburg", city: "Johannesburg", region: "South Africa" },
  { tz: "Africa/Nairobi", city: "Nairobi", region: "Kenya" },
  { tz: "Africa/Lagos", city: "Lagos", region: "Nigeria" },
  { tz: "Africa/Casablanca", city: "Casablanca", region: "Morocco" },
] as const;

const QUICK_PRESETS = [
  { label: "UTC", tz: "UTC" },
  { label: "Tokyo", tz: "Asia/Tokyo" },
  { label: "New York", tz: "America/New_York" },
  { label: "London", tz: "Europe/London" },
  { label: "Auckland", tz: "Pacific/Auckland" },
  { label: "Yangon", tz: "Asia/Yangon" },
];

export const TimezoneSelect: React.FC<TimezoneSelectProps> = ({
  timezone,
  date,
  time,
  currentOffset,
  onTimezoneChange,
  onOffsetChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(timezone);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  // Sync internal display when parent timezone prop changes
  useEffect(() => {
    setSearchQuery(timezone);
    setIsUserTyping(false);
  }, [timezone]);

  // Derive offset for current civil datetime
  const offsetValidation = useMemo(() => {
    return deriveTimezoneOffset(timezone, date, time);
  }, [timezone, date, time]);

  // Filter ~50 common IANA options based on user typing
  const filteredOptions = useMemo(() => {
    // If user hasn't started typing a custom search, or query exactly matches current selection, show all ~50 options
    if (!isUserTyping || !searchQuery.trim() || searchQuery.trim().toLowerCase() === timezone.toLowerCase()) {
      return COMMON_IANA_TIMEZONES;
    }

    const raw = searchQuery.trim().toLowerCase();
    const underscoreQuery = raw.replace(/\s+/g, "_");
    const spaceQuery = raw.replace(/_/g, " ");

    return COMMON_IANA_TIMEZONES.filter((item) => {
      const tzLower = item.tz.toLowerCase();
      const cityLower = item.city.toLowerCase();
      const regionLower = item.region.toLowerCase();

      return (
        tzLower.includes(raw) ||
        tzLower.includes(underscoreQuery) ||
        tzLower.replace(/_/g, " ").includes(spaceQuery) ||
        cityLower.includes(raw) ||
        regionLower.includes(raw)
      );
    });
  }, [searchQuery, isUserTyping, timezone]);

  // Highlight current timezone when combobox opens
  useEffect(() => {
    if (isOpen) {
      const targetIndex = filteredOptions.findIndex((opt) => opt.tz === timezone);
      setHighlightedIndex(targetIndex >= 0 ? targetIndex : 0);
    }
  }, [isOpen]);

  // Close combobox when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsUserTyping(false);
        // Reset query text to current valid timezone if dismissed
        if (timezone) {
          setSearchQuery(timezone);
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
   * Select a timezone option and trigger onTimezoneChange with derived offset
   */
  const handleSelectTimezone = (selectedTz: string) => {
    setSearchQuery(selectedTz);
    setIsUserTyping(false);
    setIsOpen(false);

    // Compute automatic offset for target date/time
    const res = deriveTimezoneOffset(selectedTz, date, time);
    const derivedOffset = res.valid && res.offsetHours !== undefined ? res.offsetHours : undefined;

    // Trigger parent callbacks to ensure both timezone and offset update
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
    setSearchQuery(val);
    setIsUserTyping(true);
    setIsOpen(true);
    setHighlightedIndex(0);

    // If typed value exactly matches a valid IANA identifier, trigger onTimezoneChange immediately
    if (isValidIanaTimezone(val.trim())) {
      const res = deriveTimezoneOffset(val.trim(), date, time);
      const derived = res.valid && res.offsetHours !== undefined ? res.offsetHours : undefined;
      onTimezoneChange(val.trim(), derived);
      if (onOffsetChange && derived !== undefined) {
        onOffsetChange(derived);
      }
    }
  };

  /**
   * Handle focus on input (select all for easy replacement)
   */
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsOpen(true);
    // Select all text so typing immediately filters
    e.target.select();
  };

  /**
   * Handle keyboard navigation within combobox
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
        handleSelectTimezone(filteredOptions[highlightedIndex].tz);
      } else if (isValidIanaTimezone(searchQuery.trim())) {
        handleSelectTimezone(searchQuery.trim());
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setIsUserTyping(false);
      setSearchQuery(timezone);
    } else if (e.key === "Tab") {
      if (isOpen && filteredOptions.length > 0) {
        handleSelectTimezone(filteredOptions[highlightedIndex].tz);
      }
    }
  };

  const isExactValid = isValidIanaTimezone(timezone);

  return (
    <div id="timezone-input-container" ref={containerRef} className="relative">
      {/* Label and Live Offset Indicator */}
      <label
        htmlFor="timezone-combobox-input"
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
          id="timezone-combobox-input"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="timezone-combobox-listbox"
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder="Search e.g. UTC, Asia/Tokyo, America/New_York..."
          autoComplete="off"
          spellCheck={false}
          className={`w-full pl-8 pr-16 py-1.5 bg-slate-950 border rounded-lg text-sm text-slate-100 focus:outline-none font-mono transition ${
            !isExactValid && searchQuery.trim() !== ""
              ? "border-rose-500/80 focus:border-rose-400"
              : isExactValid
              ? "border-emerald-600/70 focus:border-emerald-400"
              : "border-slate-800 focus:border-amber-500"
          }`}
        />

        {/* Clear & Toggle Actions */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setIsUserTyping(true);
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
        ) : searchQuery.trim() === "" ? (
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

      {/* Quick Curated Presets Bar */}
      <div className="mt-1.5 flex flex-wrap gap-1 items-center">
        {QUICK_PRESETS.map((p) => (
          <button
            key={p.tz}
            type="button"
            onClick={() => handleSelectTimezone(p.tz)}
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

      {/* Searchable Combobox Options Listbox */}
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

          {/* Scrollable Options List */}
          <ul
            ref={listboxRef}
            id="timezone-combobox-listbox"
            role="listbox"
            className="max-h-64 overflow-y-auto divide-y divide-slate-800/50 text-xs font-mono"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-5 text-center text-slate-500">
                No common timezones match "{searchQuery}"
                <div className="text-[11px] text-slate-400 mt-1">
                  You can press Enter to apply "{searchQuery}" directly if valid.
                </div>
              </li>
            ) : (
              filteredOptions.map((opt, index) => {
                const isHighlighted = index === highlightedIndex;
                const isSelected = timezone === opt.tz;
                const preview = deriveTimezoneOffset(opt.tz, date, time);

                return (
                  <li
                    key={opt.tz}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectTimezone(opt.tz)}
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
                        <span>{opt.tz}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {opt.city} · {opt.region}
                      </span>
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
