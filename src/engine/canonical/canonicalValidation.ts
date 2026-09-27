/**
 * Canonical Validation Module
 * Validates calculation inputs and canonical chart schemas
 * Conforms to DSSME Canonical Architecture
 */

import {
  CanonicalChart,
  DssmeCalculationInput,
  HouseKey,
  NineBody,
  ZODIAC_SIGNS_ARIES_FIRST,
} from "../../types/dssme-canonical-types.ts";
import { NINE_BODIES_ORDER } from "../astronomy/planetaryPositions.ts";

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

/**
 * Validates DssmeCalculationInput.
 * Throws explicit errors with canonical error codes.
 */
export function validateCalculationInput(input: unknown): DssmeCalculationInput {
  if (!input || typeof input !== "object") {
    throw new Error("INVALID_INPUT: Input must be a valid JSON object");
  }

  const obj = input as Partial<DssmeCalculationInput>;

  if (typeof obj.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(obj.date.trim())) {
    throw new Error(`INVALID_INPUT: "date" must be a string in YYYY-MM-DD format, received: ${obj.date}`);
  }

  if (typeof obj.time !== "string" || !/^\d{1,2}:\d{2}(?::\d{2})?$/.test(obj.time.trim())) {
    throw new Error(`INVALID_INPUT: "time" must be a string in HH:MM:SS format, received: ${obj.time}`);
  }

  if (typeof obj.latitude !== "number" || isNaN(obj.latitude) || obj.latitude < -90 || obj.latitude > 90) {
    throw new Error(`INVALID_INPUT: "latitude" must be a number between -90 and +90, received: ${obj.latitude}`);
  }

  if (typeof obj.longitude !== "number" || isNaN(obj.longitude) || obj.longitude < -180 || obj.longitude > 180) {
    throw new Error(`INVALID_INPUT: "longitude" must be a number between -180 and +180, received: ${obj.longitude}`);
  }

  if (
    typeof obj.timezoneOffset !== "number" ||
    isNaN(obj.timezoneOffset) ||
    obj.timezoneOffset < -14 ||
    obj.timezoneOffset > 14
  ) {
    throw new Error(
      `TIMEZONE_ERROR: "timezoneOffset" must be a number between -14 and +14, received: ${obj.timezoneOffset}`
    );
  }

  if (typeof obj.timezone !== "string" || !obj.timezone.trim()) {
    throw new Error(`TIMEZONE_ERROR: "timezone" must be a non-empty string, received: ${obj.timezone}`);
  }

  if (obj.ayanamsa !== "Lahiri") {
    throw new Error(`INVALID_INPUT: "ayanamsa" must be "Lahiri", received: ${obj.ayanamsa}`);
  }

  return {
    date: obj.date.trim(),
    time: obj.time.trim(),
    latitude: obj.latitude,
    longitude: obj.longitude,
    timezone: obj.timezone.trim(),
    timezoneOffset: obj.timezoneOffset,
    ayanamsa: "Lahiri",
    chartMode: obj.chartMode,
    bodyMode: obj.bodyMode,
    objective: obj.objective,
    risk: obj.risk,
    geometry: obj.geometry,
  };
}

/**
 * Validates a CanonicalChart object against the canonical type contract.
 */
export function validateCanonicalChart(chart: CanonicalChart): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!chart.time || typeof chart.time.julianDayUt !== "number" || chart.time.julianDayUt <= 0) {
    issues.push({ field: "time.julianDayUt", message: "Invalid Julian Day UT" });
  }

  if (!chart.ayanamsa || chart.ayanamsa.name !== "Lahiri" || typeof chart.ayanamsa.value !== "number") {
    issues.push({ field: "ayanamsa", message: "Invalid Lahiri ayanamsa" });
  }

  // Lagna validation
  if (!chart.lagna || chart.lagna.body !== "Lagna") {
    issues.push({ field: "lagna", message: "Missing or invalid Lagna position" });
  } else {
    if (chart.lagna.siderealLongitude < 0 || chart.lagna.siderealLongitude >= 360) {
      issues.push({ field: "lagna.siderealLongitude", message: "Lagna longitude outside [0, 360)" });
    }
    if (!ZODIAC_SIGNS_ARIES_FIRST.includes(chart.lagna.sign)) {
      issues.push({ field: "lagna.sign", message: "Invalid Lagna zodiac sign" });
    }
    if (chart.lagna.house !== 1) {
      issues.push({ field: "lagna.house", message: "Lagna house must be 1" });
    }
  }

  // Planets validation
  if (!chart.planets) {
    issues.push({ field: "planets", message: "Missing planets collection" });
  } else {
    for (const body of NINE_BODIES_ORDER) {
      const p = chart.planets[body];
      if (!p) {
        issues.push({ field: `planets.${body}`, message: `Missing planet ${body}` });
      } else {
        if (p.siderealLongitude < 0 || p.siderealLongitude >= 360) {
          issues.push({ field: `planets.${body}.siderealLongitude`, message: "Longitude outside [0, 360)" });
        }
        if (p.house < 1 || p.house > 12) {
          issues.push({ field: `planets.${body}.house`, message: "House must be 1-12" });
        }
      }
    }
  }

  // Houses validation
  if (!chart.houses) {
    issues.push({ field: "houses", message: "Missing houses collection" });
  } else {
    for (let h = 1; h <= 12; h++) {
      const key = h.toString() as HouseKey;
      const house = chart.houses[key];
      if (!house) {
        issues.push({ field: `houses.${key}`, message: `Missing house ${key}` });
      } else {
        if (house.houseNumber !== h) {
          issues.push({ field: `houses.${key}.houseNumber`, message: `House number mismatch` });
        }
        if (!ZODIAC_SIGNS_ARIES_FIRST.includes(house.sign)) {
          issues.push({ field: `houses.${key}.sign`, message: "Invalid house sign" });
        }
      }
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
