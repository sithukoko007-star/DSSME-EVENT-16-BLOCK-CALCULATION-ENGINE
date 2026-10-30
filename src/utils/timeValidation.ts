/**
 * DSSME EVENT Calculation Engine
 * Canonical Local Time (HH:MM:SS) Validation & Formatting Utilities
 * Preserves seconds precision without UTC conversion or rounding.
 */

export interface TimeSegments {
  hour: string;   // "00" - "23"
  minute: string; // "00" - "59"
  second: string; // "00" - "59"
}

export interface TimeValidationResult {
  isValid: boolean;
  canonicalValue: string | null;
  errorMessage: string | null;
}

const CANONICAL_TIME_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

/**
 * Validates whether a time string strictly matches 24-hour HH:MM:SS format.
 */
export function validateCanonicalTime(raw: string): TimeValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      isValid: false,
      canonicalValue: null,
      errorMessage: "အချိန်ထည့်သွင်းရန် လိုအပ်ပါသည် (HH:MM:SS)။",
    };
  }

  const parts = trimmed.split(":");
  if (parts.length !== 3) {
    return {
      isValid: false,
      canonicalValue: null,
      errorMessage: "HH:MM:SS ပုံစံအတိုင်း အပြည့်အစုံ ထည့်သွင်းပါ (ဥပမာ - 18:50:00)။",
    };
  }

  const [hStr, mStr, sStr] = parts;
  if (
    !/^\d{1,2}$/.test(hStr) ||
    !/^\d{1,2}$/.test(mStr) ||
    !/^\d{1,2}$/.test(sStr)
  ) {
    return {
      isValid: false,
      canonicalValue: null,
      errorMessage: "နာရီ၊ မိနစ် နှင့် စက္ကန့်တို့တွင် ဂဏန်းသီးသန့်သာ ထည့်သွင်းပါ။",
    };
  }

  const h = Number(hStr);
  const m = Number(mStr);
  const s = Number(sStr);

  if (h < 0 || h > 23) {
    return {
      isValid: false,
      canonicalValue: null,
      errorMessage: "နာရီ (Hour) သည် 00 မှ 23 အတွင်း ဖြစ်ရပါမည်။",
    };
  }
  if (m < 0 || m > 59) {
    return {
      isValid: false,
      canonicalValue: null,
      errorMessage: "မိနစ် (Minute) သည် 00 မှ 59 အတွင်း ဖြစ်ရပါမည်။",
    };
  }
  if (s < 0 || s > 59) {
    return {
      isValid: false,
      canonicalValue: null,
      errorMessage: "စက္ကန့် (Second) သည် 00 မှ 59 အတွင်း ဖြစ်ရပါမည်။",
    };
  }

  const canonical = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  if (!CANONICAL_TIME_REGEX.test(canonical)) {
    return {
      isValid: false,
      canonicalValue: null,
      errorMessage: "အချိန်ပုံစံ မမှန်ကန်ပါ (HH:MM:SS)။",
    };
  }

  return {
    isValid: true,
    canonicalValue: canonical,
    errorMessage: null,
  };
}

/**
 * Normalizes preset strings (e.g., "18:50" -> "18:50:00", "18:50:35" -> "18:50:35")
 * without ever stripping or rounding existing seconds.
 */
export function normalizePresetTime(presetTime: string): string {
  const trimmed = presetTime.trim();
  const parts = trimmed.split(":");
  if (parts.length === 2) {
    const [h, m] = parts;
    return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`;
  }
  return trimmed;
}

/**
 * Parses a canonical or partial time string into 2-digit Hour, Minute, Second segments.
 */
export function parseTimeSegments(value: string): TimeSegments {
  const normalized = normalizePresetTime(value);
  const validation = validateCanonicalTime(normalized);
  if (validation.isValid && validation.canonicalValue) {
    const [hour, minute, second] = validation.canonicalValue.split(":");
    return { hour, minute, second };
  }
  return { hour: "12", minute: "00", second: "00" };
}

/**
 * Formats three numeric or string segments into canonical HH:MM:SS.
 */
export function formatCanonicalTime(segments: TimeSegments): string {
  const h = Math.max(0, Math.min(23, parseInt(segments.hour || "0", 10) || 0));
  const m = Math.max(0, Math.min(59, parseInt(segments.minute || "0", 10) || 0));
  const s = Math.max(0, Math.min(59, parseInt(segments.second || "0", 10) || 0));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
