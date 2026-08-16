-- ==============================================================================
-- Watch4Trees - Initial PostgreSQL Schema & RLS Policies (Supabase Migration)
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
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------------
-- 3. User Water Balance Table (1-to-1 with Profiles)
-- ------------------------------------------------------------------------------
CREATE TABLE public.user_water_balance (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_drops SMALLINT DEFAULT 0 NOT NULL CHECK (current_drops >= 0 AND current_drops <= 10),
  total_drops_earned INT DEFAULT 0 NOT NULL,
  total_trees_planted INT DEFAULT 0 NOT NULL,
  total_co2_offset_kg NUMERIC(10,2) DEFAULT 0.00 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------------
-- 4. Water Drop Transactions Table (Ledger)
-- ------------------------------------------------------------------------------
CREATE TABLE public.water_drop_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount SMALLINT NOT NULL,
  source transaction_source NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_water_transactions_user_created ON public.water_drop_transactions(user_id, created_at DESC);

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
-- 6. Planted Trees Table
-- ------------------------------------------------------------------------------
CREATE TABLE public.planted_trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.eco_projects(id) ON DELETE RESTRICT,
  status tree_status DEFAULT 'PLANNED' NOT NULL,
  tree_number VARCHAR(40) UNIQUE NOT NULL,
  latitude NUMERIC(8,5),
  longitude NUMERIC(8,5),
  planted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_planted_trees_user_status ON public.planted_trees(user_id, status);

-- ------------------------------------------------------------------------------
-- 7. Tree Certificates Table (Open Impact Ledger)
-- ------------------------------------------------------------------------------
CREATE TABLE public.tree_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID UNIQUE NOT NULL REFERENCES public.planted_trees(id) ON DELETE CASCADE,
  certificate_number VARCHAR(60) UNIQUE NOT NULL,
  verified_by VARCHAR(100) NOT NULL,
  pdf_url TEXT,
  batch_id VARCHAR(50),
  issued_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------------
-- 8. Achievements Table
-- ------------------------------------------------------------------------------
CREATE TABLE public.achievements (
  id VARCHAR(40) PRIMARY KEY,
  title VARCHAR(80) NOT NULL,
  description VARCHAR(150) NOT NULL,
  icon_name VARCHAR(40) NOT NULL,
  required_trees SMALLINT DEFAULT 0 NOT NULL,
  required_streak SMALLINT DEFAULT 0 NOT NULL
);

-- ------------------------------------------------------------------------------
-- 9. User Achievements Table (Composite Primary Key)
-- ------------------------------------------------------------------------------
CREATE TABLE public.user_achievements (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id VARCHAR(40) NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, achievement_id)
);

-- ==============================================================================
-- 10. Automatic Profile & Balance Initialization (Auth Trigger)
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

  INSERT INTO public.user_water_balance (user_id, current_drops, total_drops_earned, total_trees_planted, total_co2_offset_kg)
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
-- 11. Secure Stored Functions (RPC) - Protected Business Logic
-- ==============================================================================

-- Helper: Auto-evaluate and unlock badges for a user
CREATE OR REPLACE FUNCTION public.evaluate_user_achievements(p_user_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance RECORD;
  v_profile RECORD;
BEGIN
  SELECT * INTO v_balance FROM public.user_water_balance WHERE user_id = p_user_id;
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;

  IF v_balance IS NULL OR v_profile IS NULL THEN
    RETURN;
  END IF;

  -- 1. First Seed (at least 1 drop earned)
  IF v_balance.total_drops_earned >= 1 THEN
    INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
    VALUES (p_user_id, 'first_seed', now())
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  -- 2. Water Master (at least 10 drops earned)
  IF v_balance.total_drops_earned >= 10 THEN
    INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
    VALUES (p_user_id, 'water_master', now())
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  -- 3. Forest Guardian (at least 10 trees planted)
  IF v_balance.total_trees_planted >= 10 THEN
    INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
    VALUES (p_user_id, 'forest_guardian', now())
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  -- 4. Eco Hero Month (30 days streak)
  IF v_profile.streak_days >= 30 THEN
    INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
    VALUES (p_user_id, 'eco_hero_month', now())
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;
END;
$$;

-- RPC 1: Claim Ad / Gameplay Reward (Protected with Anti-Fraud Checks)
CREATE OR REPLACE FUNCTION public.claim_ad_reward(
  p_amount INT,
  p_ad_count INT DEFAULT 1,
  p_source transaction_source DEFAULT 'AD_REWARD',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_current_balance RECORD;
  v_profile RECORD;
  v_new_drops INT;
  v_new_total INT;
  v_safe_amount INT;
  v_safe_count INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User must be authenticated to claim rewards';
  END IF;

  -- Sanitize inputs
  v_safe_amount := GREATEST(1, LEAST(10, p_amount));
  v_safe_count := GREATEST(1, LEAST(15, p_ad_count));

  -- 1. Check & increment daily limit in profiles (max 15 ads/day)
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user %', v_user_id;
  END IF;

  IF v_profile.last_watch_date < CURRENT_DATE THEN
    -- Reset daily count for new day
    UPDATE public.profiles
    SET daily_watched_count = v_safe_count,
        last_watch_date = CURRENT_DATE,
        streak_days = CASE WHEN last_watch_date = CURRENT_DATE - INTERVAL '1 day' THEN streak_days + 1 ELSE 1 END,
        updated_at = now()
    WHERE id = v_user_id;
  ELSE
    IF v_profile.daily_watched_count >= 15 THEN
      RAISE EXCEPTION 'Daily limit reached: Maximum 15 rewarded sessions per day allowed.';
    END IF;

    UPDATE public.profiles
    SET daily_watched_count = LEAST(15, daily_watched_count + v_safe_count),
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  -- 2. Lock & update water balance (capped at 10 drops)
  SELECT * INTO v_current_balance FROM public.user_water_balance WHERE user_id = v_user_id FOR UPDATE;
  
  v_new_drops := LEAST(10, GREATEST(0, v_current_balance.current_drops + v_safe_amount));
  v_new_total := v_current_balance.total_drops_earned + v_safe_amount;

  UPDATE public.user_water_balance
  SET current_drops = v_new_drops,
      total_drops_earned = v_new_total,
      updated_at = now()
  WHERE user_id = v_user_id;

  -- 3. Record ledger transaction
  INSERT INTO public.water_drop_transactions (user_id, amount, source, metadata)
  VALUES (v_user_id, v_safe_amount, p_source, p_metadata);

  -- 4. Check achievements
  PERFORM public.evaluate_user_achievements(v_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'current_drops', v_new_drops,
    'total_drops_earned', v_new_total,
    'daily_watched_count', LEAST(15, v_profile.daily_watched_count + v_safe_count)
  );
END;
$$;

-- RPC 2: Water Tree / Plant Tree (Converts 10 drops into a certified tree)
CREATE OR REPLACE FUNCTION public.plant_matured_tree(
  p_project_id UUID DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_selected_project_id UUID := p_project_id;
  v_project RECORD;
  v_tree_id UUID := gen_random_uuid();
  v_cert_id UUID := gen_random_uuid();
  v_tree_num VARCHAR(40);
  v_cert_num VARCHAR(60);
  v_balance RECORD;
  v_co2_kg NUMERIC(10,2);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User must be authenticated to plant a tree';
  END IF;

  -- 1. Select project (default to first active if not provided)
  IF v_selected_project_id IS NULL THEN
    SELECT id INTO v_selected_project_id FROM public.eco_projects WHERE is_active = true LIMIT 1;
  END IF;

  SELECT * INTO v_project FROM public.eco_projects WHERE id = v_selected_project_id;
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Selected eco project not found';
  END IF;

  v_co2_kg := v_project.co2_absorption_kg_year;

  -- 2. Lock & update water balance (reset drops to 0, increment planted trees)
  SELECT * INTO v_balance FROM public.user_water_balance WHERE user_id = v_user_id FOR UPDATE;

  UPDATE public.user_water_balance
  SET current_drops = 0,
      total_trees_planted = v_balance.total_trees_planted + 1,
      total_co2_offset_kg = v_balance.total_co2_offset_kg + v_co2_kg,
      updated_at = now()
  WHERE user_id = v_user_id;

  -- 3. Generate unique serial numbers
  v_tree_num := 'W4T-' || v_project.country_code || '-' || to_char(now(), 'YYYY') || '-' || to_char(floor(1000 + random() * 9000), 'FM9999');
  v_cert_num := 'CERT-' || v_tree_num;

  -- 4. Create planted tree record
  INSERT INTO public.planted_trees (
    id, user_id, project_id, status, tree_number, latitude, longitude, planted_at, created_at
  ) VALUES (
    v_tree_id, v_user_id, v_selected_project_id, 'CERTIFIED', v_tree_num, 54.01250, 17.82140, now(), now()
  );

  -- 5. Create immutable certificate
  INSERT INTO public.tree_certificates (
    id, tree_id, certificate_number, verified_by, pdf_url, batch_id, issued_at
  ) VALUES (
    v_cert_id, v_tree_id, v_cert_num, v_project.organization, 'https://watch4trees.org/cert/' || v_cert_num || '.pdf', 'BATCH-2026-Q3', now()
  );

  -- 6. Record conversion transaction in ledger
  INSERT INTO public.water_drop_transactions (user_id, amount, source, metadata)
  VALUES (v_user_id, -10, 'TREE_CONVERSION', jsonb_build_object('tree_id', v_tree_id, 'tree_number', v_tree_num));

  -- 7. Check achievements
  PERFORM public.evaluate_user_achievements(v_user_id);

  -- 8. Return complete tree and certificate object
  RETURN jsonb_build_object(
    'id', v_tree_id,
    'user_id', v_user_id,
    'project_id', v_selected_project_id,
    'status', 'CERTIFIED',
    'tree_number', v_tree_num,
    'planted_at', now(),
    'created_at', now(),
    'project', row_to_json(v_project),
    'certificate', jsonb_build_object(
      'id', v_cert_id,
      'tree_id', v_tree_id,
      'certificate_number', v_cert_num,
      'verified_by', v_project.organization,
      'pdf_url', 'https://watch4trees.org/cert/' || v_cert_num || '.pdf',
      'batch_id', 'BATCH-2026-Q3',
      'issued_at', now()
    )
  );
END;
$$;

-- RPC 3: Get Complete User Dashboard (Single atomic query)
CREATE OR REPLACE FUNCTION public.get_user_dashboard()
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile JSONB;
  v_balance JSONB;
  v_trees JSONB;
  v_achievements JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT row_to_json(p) INTO v_profile FROM public.profiles p WHERE p.id = v_user_id;
  SELECT row_to_json(b) INTO v_balance FROM public.user_water_balance b WHERE b.user_id = v_user_id;

  SELECT COALESCE(json_agg(
    json_build_object(
      'id', t.id,
      'user_id', t.user_id,
      'project_id', t.project_id,
      'status', t.status,
      'tree_number', t.tree_number,
      'latitude', t.latitude,
      'longitude', t.longitude,
      'planted_at', t.planted_at,
      'created_at', t.created_at,
      'project', row_to_json(p),
      'certificate', row_to_json(c)
    ) ORDER BY t.created_at DESC
  ), '[]'::json) INTO v_trees
  FROM public.planted_trees t
  LEFT JOIN public.eco_projects p ON p.id = t.project_id
  LEFT JOIN public.tree_certificates c ON c.tree_id = t.id
  WHERE t.user_id = v_user_id;

  SELECT COALESCE(json_agg(
    json_build_object(
      'user_id', ua.user_id,
      'achievement_id', ua.achievement_id,
      'unlocked_at', ua.unlocked_at,
      'achievement', row_to_json(a)
    )
  ), '[]'::json) INTO v_achievements
  FROM public.user_achievements ua
  JOIN public.achievements a ON a.id = ua.achievement_id
  WHERE ua.user_id = v_user_id;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'balance', v_balance,
    'planted_trees', v_trees,
    'user_achievements', v_achievements
  );
END;
$$;

-- RPC 4: Update Profile Details
CREATE OR REPLACE FUNCTION public.update_user_profile(
  p_full_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_username TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_updated JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.profiles
  SET full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
      avatar_url = COALESCE(NULLIF(trim(p_avatar_url), ''), avatar_url),
      username = COALESCE(NULLIF(trim(p_username), ''), username),
      updated_at = now()
  WHERE id = v_user_id
  RETURNING row_to_json(profiles.*) INTO v_updated;

  RETURN v_updated;
END;
$$;

-- RPC 5: Public Leaderboard (Safe, No private data leaked)
CREATE OR REPLACE FUNCTION public.get_public_leaderboard(p_limit INT DEFAULT 20)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(json_agg(
    json_build_object(
      'username', p.username,
      'avatar_url', p.avatar_url,
      'streak_days', p.streak_days,
      'total_trees_planted', b.total_trees_planted,
      'total_co2_offset_kg', b.total_co2_offset_kg
    ) ORDER BY b.total_trees_planted DESC, b.total_co2_offset_kg DESC
  ), '[]'::json) INTO v_result
  FROM public.user_water_balance b
  JOIN public.profiles p ON p.id = b.user_id
  LIMIT LEAST(50, GREATEST(1, p_limit));

  RETURN v_result;
END;
$$;

-- ==============================================================================
-- 12. Row Level Security (RLS) Policies (Strict Read-Only + Safe Profile Update)
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_water_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_drop_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planted_trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tree_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Profiles: Public read, user can update only personal details
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- User Water Balance: Read-only for owner (modifications strictly through RPCs)
CREATE POLICY "Users can view own water balance" ON public.user_water_balance
  FOR SELECT USING (auth.uid() = user_id);

-- Water Drop Transactions: Read-only for owner (insertions strictly through RPCs)
CREATE POLICY "Users can view own transactions" ON public.water_drop_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Eco Projects: Public read
CREATE POLICY "Eco projects are viewable by everyone" ON public.eco_projects
  FOR SELECT USING (true);

-- Planted Trees: Public read (Open Impact Ledger)
CREATE POLICY "Planted trees are viewable by everyone" ON public.planted_trees
  FOR SELECT USING (true);

-- Tree Certificates: Owner-only read
CREATE POLICY "Users can view only own tree certificates" ON public.tree_certificates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.planted_trees
      WHERE public.planted_trees.id = public.tree_certificates.tree_id
        AND public.planted_trees.user_id = auth.uid()
    )
  );

-- Achievements: Public read
CREATE POLICY "Achievements are viewable by everyone" ON public.achievements
  FOR SELECT USING (true);

-- User Achievements: Public read
CREATE POLICY "User achievements are viewable by everyone" ON public.user_achievements
  FOR SELECT USING (true);

-- ==============================================================================
-- 13. Role Grants & Function Execution Permissions
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT UPDATE (username, full_name, avatar_url) ON public.profiles TO authenticated;

-- Grant RPC execution to authenticated users
GRANT EXECUTE ON FUNCTION public.claim_ad_reward TO authenticated;
GRANT EXECUTE ON FUNCTION public.plant_matured_tree TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_leaderboard TO anon, authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
