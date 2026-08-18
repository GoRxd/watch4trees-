-- ==============================================================================
-- Watch4Trees - PostgreSQL Schema & Strict RLS (Supabase Migration)
-- ==============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Custom Enum Types
-- ------------------------------------------------------------------------------
CREATE TYPE transaction_source AS ENUM (
  'AD_REWARD',
  'GAMEPLAY_OFFERWALL',
  'STREAK_BONUS',
  'TREE_CONVERSION',
  'ADMIN_ADJUSTMENT'
);

CREATE TYPE tree_status AS ENUM (
  'PLANNED',
  'PLANTED',
  'CERTIFIED'
);

-- ------------------------------------------------------------------------------
-- 2. Profiles Table (Linked to auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(100),
  avatar_url TEXT,
  daily_watched_count SMALLINT DEFAULT 0 NOT NULL,
  last_watch_date DATE DEFAULT CURRENT_DATE NOT NULL,
  streak_days SMALLINT DEFAULT 1 NOT NULL,
  active_session_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------------
-- 3. User Balance Table (1-to-1 with Profiles)
-- ------------------------------------------------------------------------------
CREATE TABLE public.user_balance (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_drops INT DEFAULT 0 NOT NULL CHECK (current_drops >= 0),
  active_tree_drops SMALLINT DEFAULT 0 NOT NULL CHECK (active_tree_drops >= 0 AND active_tree_drops <= 10),
  eco_points INT DEFAULT 0 NOT NULL CHECK (eco_points >= 0),
  total_drops_earned INT DEFAULT 0 NOT NULL,
  total_trees_planted INT DEFAULT 0 NOT NULL,
  total_co2_offset_kg NUMERIC(10,2) DEFAULT 0.00 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------------
-- 4. Water Drop Transactions Table (Immutable Ledger)
-- ------------------------------------------------------------------------------
CREATE TABLE public.water_drop_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount SMALLINT NOT NULL,
  source transaction_source NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_water_transactions_user_created ON public.water_drop_transactions(user_id, created_at DESC);
CREATE UNIQUE INDEX idx_water_transactions_nonce_unique ON public.water_drop_transactions ((metadata->>'nonce')) WHERE (metadata->>'nonce') IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 5. Eco Projects Table
-- ------------------------------------------------------------------------------
CREATE TABLE public.eco_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  organization VARCHAR(100) NOT NULL,
  region VARCHAR(100) NOT NULL,
  country_code CHAR(2) NOT NULL,
  tree_species VARCHAR(100) NOT NULL,
  co2_absorption_kg_year NUMERIC(5,2) DEFAULT 22.00 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------------
-- 6. Planted Trees Table (Open Impact Ledger)
-- ------------------------------------------------------------------------------
CREATE TABLE public.planted_trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.eco_projects(id) ON DELETE RESTRICT,
  status tree_status DEFAULT 'CERTIFIED' NOT NULL,
  tree_number VARCHAR(40) UNIQUE NOT NULL,
  certificate_number VARCHAR(60) UNIQUE NOT NULL,
  verified_by VARCHAR(100) NOT NULL,
  pdf_url TEXT,
  batch_id VARCHAR(50),
  latitude NUMERIC(8,5),
  longitude NUMERIC(8,5),
  planted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_planted_trees_user_created ON public.planted_trees(user_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 7. Gamification: Achievements Definitions Table
-- ------------------------------------------------------------------------------
CREATE TABLE public.achievements (
  id VARCHAR(40) PRIMARY KEY,
  title VARCHAR(80) NOT NULL,
  description VARCHAR(150) NOT NULL,
  icon_name VARCHAR(40) NOT NULL,
  category VARCHAR(40) DEFAULT 'general',
  criteria_type VARCHAR(40) DEFAULT 'custom',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------------
-- 8. Gamification: User Achievements Table
-- ------------------------------------------------------------------------------
CREATE TABLE public.user_achievements (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id VARCHAR(40) NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON public.user_achievements(user_id);

-- ==============================================================================
-- 9. Automatic Profile & Balance Initialization (Auth Trigger)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'eco_hero_' || substring(NEW.id::text, 1, 8)),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(EXCLUDED.username, public.profiles.username),
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url);

  INSERT INTO public.user_balance (user_id, current_drops, total_drops_earned, total_trees_planted, total_co2_offset_kg)
  VALUES (NEW.id, 0, 0, 0, 0.00)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 10. Row Level Security (RLS) Policies (Strict Read-Only + Safe Profile Update)
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_drop_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planted_trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Profiles: Public read, user can update only personal details
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- User Balance: Read-only for owner (modifications strictly through Edge Functions / service_role)
CREATE POLICY "Users can view own balance" ON public.user_balance
  FOR SELECT USING (auth.uid() = user_id);

-- Water Drop Transactions: Read-only for owner (insertions strictly through Edge Functions / service_role)
CREATE POLICY "Users can view own transactions" ON public.water_drop_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Eco Projects: Public read
CREATE POLICY "Eco projects are viewable by everyone" ON public.eco_projects
  FOR SELECT USING (true);

-- Planted Trees: Public read (Open Impact Ledger)
CREATE POLICY "Planted trees are viewable by everyone" ON public.planted_trees
  FOR SELECT USING (true);

-- Achievements: Public read
CREATE POLICY "Achievements are viewable by everyone" ON public.achievements
  FOR SELECT USING (true);

-- User Achievements: Read-only for owner (unlocked by system / Edge Functions)
CREATE POLICY "Users can view own achievements" ON public.user_achievements
  FOR SELECT USING (auth.uid() = user_id);

-- ==============================================================================
-- 11. Role Grants & Permissions
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT UPDATE (username, full_name, avatar_url) ON public.profiles TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
