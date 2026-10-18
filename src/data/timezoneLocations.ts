/**
 * Offline Client-Side City & Timezone Coordinates Database
 * Provides deterministic mapping of standard IANA timezones and global/regional
 * cities to precise geographic coordinates (latitude and longitude in decimal degrees).
 */

export interface CityLocation {
  readonly city: string;
  readonly country: string;
  readonly timezone: string; // IANA identifier (e.g., "Asia/Yangon", "Asia/Tokyo")
  readonly latitude: number; // Decimal degrees (+N / -S)
  readonly longitude: number; // Decimal degrees (+E / -W)
}

const TIMEZONE_ALIASES: Record<string, string> = {
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Europe/Kiev": "Europe/Kyiv",
};

export function normalizeTimezoneAlias(tz: string): string {
  if (!tz) return tz;
  const trimmed = tz.trim();
  return TIMEZONE_ALIASES[trimmed] || trimmed;
}

export const DEFAULT_TIMEZONE_LOCATIONS: Record<string, CityLocation> = {
  UTC: { city: "Greenwich", country: "United Kingdom", timezone: "UTC", latitude: 51.4826, longitude: 0.0 },
  "Asia/Tokyo": { city: "Tokyo/Chofu", country: "Japan", timezone: "Asia/Tokyo", latitude: 35.65, longitude: 139.54 },
  "Asia/Yangon": { city: "Yangon", country: "Myanmar", timezone: "Asia/Yangon", latitude: 16.8661, longitude: 96.1951 },
  "Asia/Kolkata": { city: "New Delhi", country: "India", timezone: "Asia/Kolkata", latitude: 28.6139, longitude: 77.209 },
  "Asia/Dubai": { city: "Dubai", country: "United Arab Emirates", timezone: "Asia/Dubai", latitude: 25.2048, longitude: 55.2708 },
  "Asia/Singapore": { city: "Singapore", country: "Singapore", timezone: "Asia/Singapore", latitude: 1.3521, longitude: 103.8198 },
  "Asia/Bangkok": { city: "Bangkok", country: "Thailand", timezone: "Asia/Bangkok", latitude: 13.7563, longitude: 100.5018 },
  "Asia/Hong_Kong": { city: "Hong Kong", country: "Hong Kong", timezone: "Asia/Hong_Kong", latitude: 22.3193, longitude: 114.1694 },
  "Asia/Shanghai": { city: "Shanghai", country: "China", timezone: "Asia/Shanghai", latitude: 31.2304, longitude: 121.4737 },
  "Asia/Seoul": { city: "Seoul", country: "South Korea", timezone: "Asia/Seoul", latitude: 37.5665, longitude: 126.978 },
  "Asia/Taipei": { city: "Taipei", country: "Taiwan", timezone: "Asia/Taipei", latitude: 25.033, longitude: 121.5654 },
  "Asia/Jakarta": { city: "Jakarta", country: "Indonesia", timezone: "Asia/Jakarta", latitude: -6.2088, longitude: 106.8456 },
  "Asia/Kathmandu": { city: "Kathmandu", country: "Nepal", timezone: "Asia/Kathmandu", latitude: 27.7172, longitude: 85.324 },
  "Asia/Dhaka": { city: "Dhaka", country: "Bangladesh", timezone: "Asia/Dhaka", latitude: 23.8103, longitude: 90.4125 },
  "Asia/Karachi": { city: "Karachi", country: "Pakistan", timezone: "Asia/Karachi", latitude: 24.8607, longitude: 67.0011 },
  "Asia/Manila": { city: "Manila", country: "Philippines", timezone: "Asia/Manila", latitude: 14.5995, longitude: 120.9842 },
  "Asia/Jerusalem": { city: "Jerusalem", country: "Israel", timezone: "Asia/Jerusalem", latitude: 31.7683, longitude: 35.2137 },
  "Asia/Riyadh": { city: "Riyadh", country: "Saudi Arabia", timezone: "Asia/Riyadh", latitude: 24.7136, longitude: 46.6753 },
  "Asia/Colombo": { city: "Colombo", country: "Sri Lanka", timezone: "Asia/Colombo", latitude: 6.9271, longitude: 79.8612 },
  "Asia/Kuala_Lumpur": { city: "Kuala Lumpur", country: "Malaysia", timezone: "Asia/Kuala_Lumpur", latitude: 3.139, longitude: 101.6869 },
  "America/New_York": { city: "New York", country: "United States", timezone: "America/New_York", latitude: 40.7128, longitude: -74.006 },
  "America/Chicago": { city: "Chicago", country: "United States", timezone: "America/Chicago", latitude: 41.8781, longitude: -87.6298 },
  "America/Denver": { city: "Denver", country: "United States", timezone: "America/Denver", latitude: 39.7392, longitude: -104.9903 },
  "America/Los_Angeles": { city: "Los Angeles", country: "United States", timezone: "America/Los_Angeles", latitude: 34.0522, longitude: -118.2437 },
  "America/Phoenix": { city: "Phoenix", country: "United States", timezone: "America/Phoenix", latitude: 33.4484, longitude: -112.074 },
  "America/Anchorage": { city: "Anchorage", country: "United States", timezone: "America/Anchorage", latitude: 61.2181, longitude: -149.9003 },
  "America/Toronto": { city: "Toronto", country: "Canada", timezone: "America/Toronto", latitude: 43.6532, longitude: -79.3832 },
  "America/Vancouver": { city: "Vancouver", country: "Canada", timezone: "America/Vancouver", latitude: 49.2827, longitude: -123.1207 },
  "America/Mexico_City": { city: "Mexico City", country: "Mexico", timezone: "America/Mexico_City", latitude: 19.4326, longitude: -99.1332 },
  "America/Sao_Paulo": { city: "São Paulo", country: "Brazil", timezone: "America/Sao_Paulo", latitude: -23.5505, longitude: -46.6333 },
  "America/Buenos_Aires": { city: "Buenos Aires", country: "Argentina", timezone: "America/Buenos_Aires", latitude: -34.6037, longitude: -58.3816 },
  "Europe/London": { city: "London", country: "United Kingdom", timezone: "Europe/London", latitude: 51.5074, longitude: -0.1278 },
  "Europe/Paris": { city: "Paris", country: "France", timezone: "Europe/Paris", latitude: 48.8566, longitude: 2.3522 },
  "Europe/Berlin": { city: "Berlin", country: "Germany", timezone: "Europe/Berlin", latitude: 52.52, longitude: 13.405 },
  "Europe/Rome": { city: "Rome", country: "Italy", timezone: "Europe/Rome", latitude: 41.9028, longitude: 12.4964 },
  "Europe/Madrid": { city: "Madrid", country: "Spain", timezone: "Europe/Madrid", latitude: 40.4168, longitude: -3.7038 },
  "Europe/Amsterdam": { city: "Amsterdam", country: "Netherlands", timezone: "Europe/Amsterdam", latitude: 52.3676, longitude: 4.9041 },
  "Pacific/Auckland": { city: "Auckland", country: "New Zealand", timezone: "Pacific/Auckland", latitude: -36.8485, longitude: 174.7633 },
  "Pacific/Honolulu": { city: "Honolulu", country: "United States", timezone: "Pacific/Honolulu", latitude: 21.3069, longitude: -157.8583 },
  "Pacific/Fiji": { city: "Suva", country: "Fiji", timezone: "Pacific/Fiji", latitude: -18.1416, longitude: 178.4419 },
  "Australia/Sydney": { city: "Sydney", country: "Australia", timezone: "Australia/Sydney", latitude: -33.8688, longitude: 151.2093 },
  "Australia/Melbourne": { city: "Melbourne", country: "Australia", timezone: "Australia/Melbourne", latitude: -37.8136, longitude: 144.9631 },
  "Africa/Cairo": { city: "Cairo", country: "Egypt", timezone: "Africa/Cairo", latitude: 30.0444, longitude: 31.2357 },
  "Africa/Johannesburg": { city: "Johannesburg", country: "South Africa", timezone: "Africa/Johannesburg", latitude: -26.2041, longitude: 28.0473 },
};

export const ALL_CITY_LOCATIONS: readonly CityLocation[] = [
  // Myanmar (Asia/Yangon)
  { city: "Yangon", country: "Myanmar", timezone: "Asia/Yangon", latitude: 16.8661, longitude: 96.1951 },
  { city: "Mandalay", country: "Myanmar", timezone: "Asia/Yangon", latitude: 21.9588, longitude: 96.0891 },
  { city: "Naypyidaw", country: "Myanmar", timezone: "Asia/Yangon", latitude: 19.7633, longitude: 96.0785 },
  { city: "Bago", country: "Myanmar", timezone: "Asia/Yangon", latitude: 17.3221, longitude: 96.466 },
  { city: "Mawlamyine", country: "Myanmar", timezone: "Asia/Yangon", latitude: 16.4905, longitude: 97.6282 },
  { city: "Taunggyi", country: "Myanmar", timezone: "Asia/Yangon", latitude: 20.7831, longitude: 97.0378 },
  { city: "Pathein", country: "Myanmar", timezone: "Asia/Yangon", latitude: 16.7792, longitude: 94.7325 },
  { city: "Monywa", country: "Myanmar", timezone: "Asia/Yangon", latitude: 22.1086, longitude: 95.1358 },

  // Japan (Asia/Tokyo)
  { city: "Tokyo/Chofu", country: "Japan", timezone: "Asia/Tokyo", latitude: 35.65, longitude: 139.54 },
  { city: "Osaka", country: "Japan", timezone: "Asia/Tokyo", latitude: 34.6937, longitude: 135.5023 },
  { city: "Kyoto", country: "Japan", timezone: "Asia/Tokyo", latitude: 35.0116, longitude: 135.7681 },
  { city: "Sapporo", country: "Japan", timezone: "Asia/Tokyo", latitude: 43.0618, longitude: 141.3545 },
  { city: "Fukuoka", country: "Japan", timezone: "Asia/Tokyo", latitude: 33.5902, longitude: 130.4017 },

  // India (Asia/Kolkata)
  { city: "New Delhi", country: "India", timezone: "Asia/Kolkata", latitude: 28.6139, longitude: 77.209 },
  { city: "Mumbai", country: "India", timezone: "Asia/Kolkata", latitude: 19.076, longitude: 72.8777 },
  { city: "Kolkata", country: "India", timezone: "Asia/Kolkata", latitude: 22.5726, longitude: 88.3639 },
  { city: "Chennai", country: "India", timezone: "Asia/Kolkata", latitude: 13.0827, longitude: 80.2707 },
  { city: "Bengaluru", country: "India", timezone: "Asia/Kolkata", latitude: 12.9716, longitude: 77.5946 },
  { city: "Varanasi", country: "India", timezone: "Asia/Kolkata", latitude: 25.3176, longitude: 82.9739 },
  { city: "Ujjain", country: "India", timezone: "Asia/Kolkata", latitude: 23.1765, longitude: 75.7885 },

  // Regional Standards
  { city: "Bangkok", country: "Thailand", timezone: "Asia/Bangkok", latitude: 13.7563, longitude: 100.5018 },
  { city: "Chiang Mai", country: "Thailand", timezone: "Asia/Bangkok", latitude: 18.7883, longitude: 98.9853 },
  { city: "Singapore", country: "Singapore", timezone: "Asia/Singapore", latitude: 1.3521, longitude: 103.8198 },
  { city: "Greenwich", country: "United Kingdom", timezone: "UTC", latitude: 51.4826, longitude: 0.0 },
  { city: "London", country: "United Kingdom", timezone: "Europe/London", latitude: 51.5074, longitude: -0.1278 },
  { city: "Paris", country: "France", timezone: "Europe/Paris", latitude: 48.8566, longitude: 2.3522 },
  { city: "New York", country: "United States", timezone: "America/New_York", latitude: 40.7128, longitude: -74.006 },
  { city: "Los Angeles", country: "United States", timezone: "America/Los_Angeles", latitude: 34.0522, longitude: -118.2437 },
];

export function getDefaultLocationForTimezone(ianaTz: string): CityLocation | null {
  if (!ianaTz || typeof ianaTz !== "string") return null;
  const trimmed = ianaTz.trim();
  if (!trimmed) return null;
  if (DEFAULT_TIMEZONE_LOCATIONS[trimmed]) return DEFAULT_TIMEZONE_LOCATIONS[trimmed];
  const aliasNormalized = normalizeTimezoneAlias(trimmed);
  if (aliasNormalized !== trimmed && DEFAULT_TIMEZONE_LOCATIONS[aliasNormalized]) {
    return DEFAULT_TIMEZONE_LOCATIONS[aliasNormalized];
  }
  const lower = trimmed.toLowerCase();
  for (const [key, loc] of Object.entries(DEFAULT_TIMEZONE_LOCATIONS)) {
    if (key.toLowerCase() === lower) return loc;
  }
  const inAll = ALL_CITY_LOCATIONS.find(
    (loc) => loc.timezone.toLowerCase() === lower || loc.timezone.toLowerCase() === aliasNormalized.toLowerCase()
  );
  return inAll ?? null;
}

export function searchLocations(query: string): CityLocation[] {
  if (!query || typeof query !== "string") return [];
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qUnderscore = q.replace(/\s+/g, "_");
  const qSpace = q.replace(/_/g, " ");
  const results: CityLocation[] = [];
  const seen = new Set<string>();

  for (const loc of ALL_CITY_LOCATIONS) {
    const key = `${loc.city}|${loc.country}|${loc.timezone}`;
    if (seen.has(key)) continue;
    const cityLower = loc.city.toLowerCase();
    const countryLower = loc.country.toLowerCase();
    const tzLower = loc.timezone.toLowerCase();

    if (
      cityLower.includes(q) || cityLower.includes(qSpace) ||
      countryLower.includes(q) || countryLower.includes(qSpace) ||
      tzLower.includes(q) || tzLower.includes(qUnderscore)
    ) {
      seen.add(key);
      results.push(loc);
    }
  }
  return results;
}

export function getLocationsForTimezone(ianaTz: string): CityLocation[] {
  if (!ianaTz || typeof ianaTz !== "string") return [];
  const trimmed = ianaTz.trim().toLowerCase();
  const normalized = normalizeTimezoneAlias(ianaTz.trim()).toLowerCase();
  return ALL_CITY_LOCATIONS.filter((loc) => {
    const tzLower = loc.timezone.toLowerCase();
    return tzLower === trimmed || tzLower === normalized;
  });
}
