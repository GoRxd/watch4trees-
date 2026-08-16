export type Language = 'pl' | 'en';

export type TransactionSource =
  | 'AD_REWARD'
  | 'GAMEPLAY_OFFERWALL'
  | 'STREAK_BONUS'
  | 'TREE_CONVERSION'
  | 'ADMIN_ADJUSTMENT';

export type TreeStatus = 'PLANNED' | 'PLANTED' | 'CERTIFIED';

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  daily_watched_count: number;
  last_watch_date: string;
  streak_days: number;
  created_at: string;
  updated_at: string;
}

export interface UserBalance {
  user_id: string;
  current_drops: number;
  active_tree_drops: number;
  eco_points: number;
  total_drops_earned: number;
  total_trees_planted: number;
  total_co2_offset_kg: number;
  updated_at: string;
}

export type UserWaterBalance = UserBalance;

export interface WaterDropTransaction {
  id: string;
  user_id: string;
  amount: number;
  source: TransactionSource;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export interface EcoProject {
  id: string;
  name: string;
  organization: string;
  region: string;
  country_code: string;
  tree_species: string;
  co2_absorption_kg_year: number;
  is_active: boolean;
  created_at: string;
}

export interface PlantedTree {
  id: string;
  user_id: string;
  project_id: string;
  status: TreeStatus;
  tree_number: string;
  latitude: number | null;
  longitude: number | null;
  planted_at: string | null;
  created_at: string;
  project?: EcoProject;
  certificate?: TreeCertificate;
}

export interface TreeCertificate {
  id: string;
  tree_id: string;
  certificate_number: string;
  verified_by: string;
  pdf_url: string | null;
  batch_id: string | null;
  issued_at: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon_name: string;
  required_trees: number;
  required_streak: number;
}

export interface UserAchievement {
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  achievement?: Achievement;
}

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

