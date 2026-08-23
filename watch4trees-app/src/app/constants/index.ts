/**
 * Global Constants & Configurations for Watch4Trees
 */

export const STORAGE_KEYS = {
  USER: 'w4t_user',
  LANG: 'w4t_lang',
  BALANCE_PREFIX: 'w4t_balance_',
  TREES_PREFIX: 'w4t_trees_',
  PROFILES_PREFIX: 'w4t_profile_',
  AUTH_LOCKOUT: 'w4t_auth_lockout',
  PROMO_DISMISSED: 'w4t_promo_dismissed'
} as const;

export const ECO_METRICS = {
  CO2_PER_TREE_KG: 22,
  DEFAULT_TREE_DROPS_NEEDED: 10,
  DEFAULT_DAILY_LIMIT: 15
} as const;

