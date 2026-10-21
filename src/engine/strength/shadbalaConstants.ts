export const SHADBALA_PLANETS = [
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
] as const;

export type ShadbalaPlanet = (typeof SHADBALA_PLANETS)[number];
