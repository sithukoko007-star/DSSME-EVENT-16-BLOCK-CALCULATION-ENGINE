/**
 * ============================================================================
 * DSSME Native 16-Block Calculation Engine — Canonical Type Contracts
 * ============================================================================
 *
 * Sources reconciled here:
 *   - DSSME_Extraction_Prompt_JSON_v1_4.md  §11   (the ORIGINAL v1.4 output schema)
 *   - DSSME_CHART_2026-09-16_Chofu.json           (a real chart under that schema)
 *   - "DSSME NATIVE 16-BLOCK CALCULATION ENGINE"  (this native-engine architecture spec)
 *   - naturalstupid/PyJHora @ 48e57d29b47a3143519910a24866758116467485 (commit
 *     message "V4.9.3" — this IS the current HEAD of the repo; there is no git
 *     tag literally named "V4.9.3", just a commit whose message says that)
 *
 * OPEN QUESTIONS:
 *   1. Output key casing/shape: this file follows the ORIGINAL v1.4 schema
 *      (UPPER_SNAKE_CASE, 16 separate top-level blocks, Block 13's six
 *      composite attributes as six separate keys).
 *   2. ASPECTS_BHAVAS.aspects: v1.4 schema nests {score, fraction} per planet;
 *      the real Chofu chart flattens it to a bare score number. Defaulted here
 *      to the richer {score, fraction} shape (BhavaAspectDetail) since the
 *      native engine computes the fraction anyway.
 *   3. PLANETS.Rahu/Ketu.sb_ratio / sb_rank: schema template defaults to null;
 *      the real chart populates both at 1 / 4 (a placeholder pattern, not an
 *      obviously computed Shadbala). Typed as `number | null` pending call.
 *   4. SHADBALA's five "_pct" siblings (sthana_pct, dig_pct, kaala_pct,
 *      chesta_pct, drig_pct): confirmed NOT present anywhere in PyJHora's
 *      strength.py — there is no per-component percent-of-max concept there,
 *      only the overall percent_required (= total_virupas / minimum_required).
 *      Left optional here.
 *   5. SHADBALA.minimum_required[Sun]: existing schema/example uses 390
 *      virupas (6.5 rupas) — the standard classical figure.
 *      PyJHora's own `const.shad_bala_factors` (const.py:1379) gives Sun
 *      5 rupas = 300 virupas. Flagged as an open decision.
 *   6. SIGN_CLUSTERS: one entry per occupied sign per extraction prompt rule 10.
 */

// ============================================================================
// Shared literal unions
// ============================================================================

export type ZodiacSign =
  | "Aries" | "Taurus" | "Gemini" | "Cancer" | "Leo" | "Virgo"
  | "Libra" | "Scorpio" | "Sagittarius" | "Capricorn" | "Aquarius" | "Pisces";

/** Fixed Aries-first order used by every 12-length sign array in this file (BAV, SAV, _signs, etc). */
export const ZODIAC_SIGNS_ARIES_FIRST: readonly ZodiacSign[] = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

/**
 * Verified against PyJHora const.py:137-143 — SUN_ID=0 .. SATURN_ID=6 in this
 * exact order. Not swapped.
 */
export type ClassicalPlanet =
  | "Sun" | "Moon" | "Mars" | "Mercury" | "Jupiter" | "Venus" | "Saturn";

export const CLASSICAL_PLANETS_ORDER: readonly ClassicalPlanet[] = [
  "Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn",
] as const;

export type NineBody = ClassicalPlanet | "Rahu" | "Ketu";
export type ChartBody = NineBody | "Lagna";

export type Dignity =
  | "Exalted" | "Own" | "Moolatrikona" | "Grt.Friend" | "Friend"
  | "Neutral" | "Enemy" | "Grt.Enemy" | "Debilitated" | "—";

export type HouseType = "Angular" | "Succedent" | "Cadent";
export type LagnaType = "Movable" | "Fixed" | "Dual";
export type Paksha = "Shukla" | "Krishna";
export type CombustSeverity = "Mild" | "Severe" | null;
export type StressLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH";
export type YogaType = "spec_positive" | "spec_negative" | "neutral";

export type HouseKey = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12";

// ============================================================================
// SECTION 1 — Input contract (spec §6). New: no prior structured input existed.
// ============================================================================

export interface DssmeCalculationInput {
  date: string;               // "YYYY-MM-DD", local civil date
  time: string;                // "HH:MM:SS", local civil time
  latitude: number;            // decimal degrees, +N / -S
  longitude: number;           // decimal degrees, +E / -W
  timezone: string;            // IANA name where available, e.g. "Asia/Tokyo"
  timezoneOffset: number;      // UTC offset in hours at this date/time, e.g. 9

  ayanamsa: "Lahiri";

  // Session parameters (extraction-prompt §2 Rule 13 / native spec §6) — these
  // are declared by whoever runs the pipeline, never calculated. Passed straight
  // through to IDENTITY.body_mode / .objective / .risk / .geometry.
  chartMode?: string;
  bodyMode?: string;
  objective?: string;
  risk?: string;
  geometry?: string;
}

// ============================================================================
// SECTION 2 — Canonical internal chart model (spec §11). New: the single
// source of astronomical/geometric truth every Block 04-16 calculator reads
// from (spec §12) — nothing downstream re-derives planetary longitude.
// ============================================================================

export interface CanonicalBodyPosition {
  body: ChartBody;
  siderealLongitude: number;   // decimal degrees, 0-360, Lahiri
  tropicalLongitude: number;
  eclipticLatitude?: number;
  speedLongitude: number;      // deg/day; sign gives direct/retrograde
  isRetrograde: boolean;
  sign: ZodiacSign;
  signDegree: number;          // 0-30 within the sign
  nakshatra: string;
  nakshatraPada: 1 | 2 | 3 | 4;
  house: number;               // 1-12
  provenance: "swisseph-wasm" | "fallback";
}

export interface CanonicalHouse {
  houseNumber: number;
  sign: ZodiacSign;
  lord: ClassicalPlanet;
  cuspLongitude?: number;      // bhava madhya, decimal degrees, where the house system needs it
  occupants: NineBody[];
  type: HouseType;
}

export interface ChartProvenance {
  ephemeris: "swisseph-wasm" | "fallback" | "mixed";
  isDegraded: boolean;
  sources: {
    ayanamsa: "swisseph-wasm" | "fallback";
    lagna: "swisseph-wasm" | "fallback";
    planets: Record<NineBody, "swisseph-wasm" | "fallback">;
  };
  runtime: {
    node: string;
    platform: string;
    icu?: string;
    tzdata?: string;
  };
}

export interface CanonicalChart {
  input: DssmeCalculationInput;

  time: {
    localIso: string;
    utcIso: string;
    julianDayUt: number;
    timezoneOffsetHours: number;
  };

  location: {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
  };

  ayanamsa: {
    name: "Lahiri";
    value: number;             // decimal degrees
  };

  lagna: CanonicalBodyPosition;
  planets: Record<NineBody, CanonicalBodyPosition>;
  houses: Record<HouseKey, CanonicalHouse>;
  provenance: ChartProvenance;
}

// ============================================================================
// SECTION 3 — The 16-block OUTPUT ("the DSSME chart JSON"). Preserves the
// EXISTING v1.4 schema field names / casing / nesting exactly.
// ============================================================================

export interface IdentityBlock {
  date: string;
  day: string;
  time: string;
  timezone: string;
  location_city: string;
  location_country: string;
  latitude: string;
  longitude: string;
  ayanamsa_name: "Lahiri";
  ayanamsa_value: string;
  lagna_sign: ZodiacSign;
  lagna_degree: string;
  lagna_type: LagnaType;
  // Session parameters, passed through from DssmeCalculationInput — never calculated.
  body_mode: string;
  objective: string;
  risk: string;
  geometry: string;
  engine_version: string;
}

export interface PanchangaBlock {
  paksha: Paksha;
  tithi_name: string;
  tithi_at_birth: string;
  nakshatra_name: string;
  nakshatra_pada: number;
  nak_at_birth: string;
  yoga_at_birth: string;
  karana_at_birth: string;
  weekday_lord: ClassicalPlanet;
  sunrise_time: string;
  sunrise_degree: string;
  sunset_time: string;
  sun_degree: string;
  moon_nak_entry: string;
  moon_nak_exit: string;
  eclipse_proximity: boolean;
  gandanta_active: boolean;
  ingress_stacking: boolean;
  amavasya_zone: boolean;
  purnima_zone: boolean;
}

export interface DashaEntry {
  planet: NineBody;
  start: string;  // "DD-MM-YYYY"
  end: string;
}

export interface DashaBlock {
  mahadasha_planet: NineBody;
  antardasha_planet: NineBody;
  pratyantara: NineBody;
  dasha_string: string;
  upcoming_ad: DashaEntry[];
  next_mahadasha_planet: NineBody;
}

export interface ClassicalPlanetEntry {
  sign: ZodiacSign;
  degree: string;              // "XX°XX'XX\""
  nakshatra: string;
  pada: 1 | 2 | 3 | 4;
  house: number;
  retro: "Y" | "N";
  combust: "Y" | "N";
  dispositor: ClassicalPlanet;
  dignity: Dignity;
  sb_ratio: number;
  sb_rank: number;
}

export interface NodeEntry {
  sign: ZodiacSign;
  degree: string;
  nakshatra: string;
  pada: 1 | 2 | 3 | 4;
  house: number;
  retro: "R";
  combust: "N";
  dispositor: ClassicalPlanet;
  dignity: "—";
  sb_ratio: number | null;
  sb_rank: number | null;
}

export interface LagnaEntry {
  sign: ZodiacSign;
  degree: string;
  nakshatra: string;
  pada: 1 | 2 | 3 | 4;
  house: 1;
  retro: "N";
  combust: "N";
  dispositor: ClassicalPlanet;
  dignity: "—";
}

export interface PlanetsBlock {
  Sun: ClassicalPlanetEntry;
  Moon: ClassicalPlanetEntry;
  Mars: ClassicalPlanetEntry;
  Mercury: ClassicalPlanetEntry;
  Jupiter: ClassicalPlanetEntry;
  Venus: ClassicalPlanetEntry;
  Saturn: ClassicalPlanetEntry;
  Rahu: NodeEntry;
  Ketu: NodeEntry;
  Lagna: LagnaEntry;
}

export interface HouseEntry {
  sign: ZodiacSign;
  lord: ClassicalPlanet;
  occupants: NineBody[];
  type: HouseType;
}

export type HousesBlock = Record<HouseKey, HouseEntry>;

export interface ShadbalaBlock {
  _columns: ClassicalPlanet[];        // length 7, fixed order above
  minimum_required: number[];          // length 7
  total_virupas: number[];
  percent_required: number[];          // = total_virupas / minimum_required * 100
  rank: number[];                      // ordinal by total_virupas, descending
  sthana_total: number[];
  sthana_pct?: number[];
  dig_bala: number[];
  dig_pct?: number[];
  kaala_total: number[];
  kaala_pct: number[];
  chesta_bala: number[];
  chesta_pct?: number[];
  naisargika_bala: number[];
  drig_bala: number[];
  drig_pct?: number[];
}

export interface KaalaBalaComponents {
  nathonnatha: number[];
  paksha: number[];
  tribhaga: number[];
  abda: number[];
  masa: number[];
  vaara: number[];
  hora: number[];
  ayana: number[];
  yuddha: number[];
}

export interface BhavaBalaEntry {
  sign: ZodiacSign;
  lord_contrib?: number;
  drishti?: number;
  total: number;
}

export type BhavaBalaBlock = Record<HouseKey, BhavaBalaEntry>;

export interface BavBlock {
  Sun: number[];      // length 12, Aries-first
  Moon: number[];
  Mars: number[];
  Mercury: number[];
  Jupiter: number[];
  Venus: number[];
  Saturn: number[];
  Lagna: number[];
  _signs: ZodiacSign[];  // length 12, canonical Aries-first order
}

export interface SavSpecHouse {
  sign: ZodiacSign;
  sav: number;
  occupant: NineBody | "None" | "EMPTY";
}

export interface SavBlock {
  values: number[];  // length 12
  grand_total: number;
  spec_houses: {
    H2: SavSpecHouse;
    H5: SavSpecHouse;
    H8: SavSpecHouse;
    H11: SavSpecHouse;
  };
  spec_sum: number;
  spec_triangle: number;
}

export interface BavCurrentSignEntry {
  sign: ZodiacSign;
  bav: number;
  _note?: string;
}

export interface BavCurrentSignBlock {
  Sun: BavCurrentSignEntry;
  Moon: BavCurrentSignEntry;
  Mars: BavCurrentSignEntry;
  Mercury: BavCurrentSignEntry;
  Jupiter: BavCurrentSignEntry;
  Venus: BavCurrentSignEntry;
  Saturn: BavCurrentSignEntry;
  Rahu: BavCurrentSignEntry;
  Ketu: BavCurrentSignEntry;
}

export interface PlanetAspect {
  from: NineBody;
  to: NineBody;
  fraction: string;  // "X/4"
  score: number;
}

export type AspectsPlanetsBlock = PlanetAspect[];

export interface BhavaAspectDetail {
  score: number;
  fraction: string;
}

export interface BhavaAspectEntry {
  degree: number;
  aspects: Partial<Record<NineBody, BhavaAspectDetail>>;
}

export type AspectsBhavasBlock = Record<HouseKey, BhavaAspectEntry>;

export type DignityBlock = Record<NineBody, Dignity>;
export type RetrogradeBlock = Record<NineBody, boolean>;

export interface CombustEntry {
  combust: boolean;
  sep_deg: number | null;
  severity: CombustSeverity;
}

export type CombustBlock = Record<ClassicalPlanet, CombustEntry>;

export interface HousePositionEntry {
  house: number;
  type: HouseType;
}

export type HousePositionsBlock = Record<NineBody, HousePositionEntry>;

export interface SignClusterEntry {
  sign: ZodiacSign;
  sign_index: number;   // 0-11, Aries-first
  planets: NineBody[];
  sav: number;
}

export type SignClustersBlock = SignClusterEntry[];

export interface HoraBlock {
  planet: ClassicalPlanet;
  hora_number: number;
  start_time: string;
  end_time: string;
}

export interface PhaseStressBlock {
  new_moon_proximity_hrs: number;
  full_moon_proximity_hrs: number;
  ingress_within_24h: NineBody[];
  sign_boundary_planets: NineBody[];
  stress_level: StressLevel;
}

export interface NavamshaEntry {
  sign: ZodiacSign;
  dignity: Dignity;
  is_vargottama: boolean;
  is_pushkara: boolean;
}

export interface NavamshaBlock {
  _available: boolean;
  Sun: NavamshaEntry;
  Moon: NavamshaEntry;
  Mars: NavamshaEntry;
  Mercury: NavamshaEntry;
  Jupiter: NavamshaEntry;
  Venus: NavamshaEntry;
  Saturn: NavamshaEntry;
  Rahu: NavamshaEntry;
  Ketu: NavamshaEntry;
}

export interface YogaEntry {
  name: string;
  type: YogaType;
  planets_involved: NineBody[];
  active: boolean;
  description: string;
}

export type YogaListBlock = YogaEntry[];

export interface NativeMeta {
  engine: "DSSME";
  engineVersion: string;
  calculationMode: "NATIVE";
  ephemeris: string;
  ayanamsa: "Lahiri";
  generatedAt: string;  // ISO 8601
  deterministic: true;
  pyjhoraReference: {
    repository: "https://github.com/naturalstupid/PyJHora";
    commit: string;
    tag: string;
  };
}

export interface Dssme16BlockResult {
  IDENTITY: IdentityBlock;
  PANCHANGA: PanchangaBlock;
  DASHA: DashaBlock;
  PLANETS: PlanetsBlock;
  HOUSES: HousesBlock;
  SHADBALA: ShadbalaBlock;
  BHAVA_BALA: BhavaBalaBlock;
  BAV: BavBlock;
  SAV: SavBlock;
  BAV_CURRENT_SIGN: BavCurrentSignBlock;
  ASPECTS_PLANETS: AspectsPlanetsBlock;
  ASPECTS_BHAVAS: AspectsBhavasBlock;
  DIGNITY: DignityBlock;
  RETROGRADE: RetrogradeBlock;
  COMBUST: CombustBlock;
  HOUSE_POSITIONS: HousePositionsBlock;
  SIGN_CLUSTERS: SignClustersBlock;
  HORA: HoraBlock;
  PHASE_STRESS: PhaseStressBlock;
  NAVAMSHA: NavamshaBlock;
  YOGA_LIST: YogaListBlock;
  _meta: NativeMeta;
}

// ============================================================================
// SECTION 4 — API envelope (spec §47)
// ============================================================================

export type DssmeErrorCode =
  | "INVALID_INPUT" | "TIMEZONE_ERROR" | "EPHEMERIS_ERROR" | "LAGNA_ERROR"
  | "HOUSE_ERROR" | "PANCHANGA_ERROR" | "DASHA_ERROR" | "SHADBALA_ERROR"
  | "BHAVA_BALA_ERROR" | "ASHTAKAVARGA_ERROR" | "ASPECT_ERROR"
  | "NAVAMSHA_ERROR" | "YOGA_ERROR" | "VALIDATION_ERROR";

export interface DssmeApiError {
  code: DssmeErrorCode;
  message: string;
}

export interface DssmeApiResponseSuccess {
  success: true;
  data: Dssme16BlockResult;
  meta: { engine: "DSSME"; mode: "NATIVE"; version: string };
  errors: [];
}

export interface DssmeApiResponseFailure {
  success: false;
  data: null;
  meta: Record<string, never>;
  errors: DssmeApiError[];
}

export type DssmeApiResponse = DssmeApiResponseSuccess | DssmeApiResponseFailure;
