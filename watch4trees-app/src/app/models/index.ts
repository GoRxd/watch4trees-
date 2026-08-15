export type Language = 'pl' | 'en';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  ecoPoints: number;
  waterDrops: number;
  treesPlanted: number;
  activeStreak: number;
  dailyLimitRemaining: number;
  targetFoundation: string;
}

export interface PlantedTreeCertificate {
  id: string;
  serialNumber: string;
  species: string;
  speciesIcon: string;
  plantedDate: string;
  location: string;
  foundation: string;
  co2PerYearKg: number;
}

export type SessionType = 'quick' | 'focus' | 'deep';

export interface AdSessionConfig {
  id: SessionType;
  titleKey: string;
  durationSeconds: number;
  adCount: number;
  waterReward: number;
  pointsReward: number;
  icon: string;
  badgeKey: string;
}

export interface SponsorInfo {
  name: string;
  tagline: string;
  logo: string;
  esgGoal: string;
}
