export interface PlanetState {
  totalLongitude: number;
  speedLongitude?: number;
  latitude?: number;
  isRetrograde?: boolean;
  [key: string]: any;
}
