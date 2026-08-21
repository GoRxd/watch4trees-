-- ==============================================================================
-- Watch4Trees - Migration: Automatic Achievements Evaluation Triggers
-- ==============================================================================

-- 1. Function: Evaluate Balance & Planted Tree Achievements
-- Triggers on: user_balance (AFTER UPDATE)
CREATE OR REPLACE FUNCTION public.trg_evaluate_balance_achievements()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- A. First Seed (Zdobądź pierwszą kroplę wody - total_drops_earned >= 1)
  IF NEW.total_drops_earned >= 1 THEN
    INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
    VALUES (NEW.user_id, 'first_seed', now())
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  -- B. Water Master (Zdobądź 10 kropel lub podlewaj drzewo - total_drops_earned >= 10 OR current_drops >= 10)
  IF NEW.total_drops_earned >= 10 OR NEW.current_drops >= 10 THEN
    INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
    VALUES (NEW.user_id, 'water_master', now())
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  -- C. Forest Guardian (Zasadź co najmniej 10 prawdziwych drzew)
  IF NEW.total_trees_planted >= 10 THEN
    INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
    VALUES (NEW.user_id, 'forest_guardian', now())
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_balance_achievements ON public.user_balance;
CREATE TRIGGER trg_balance_achievements
  AFTER UPDATE OF total_drops_earned, current_drops, total_trees_planted
  ON public.user_balance
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_evaluate_balance_achievements();


-- 2. Function: Evaluate Streak Achievements
-- Triggers on: profiles (AFTER UPDATE of streak_days)
CREATE OR REPLACE FUNCTION public.trg_evaluate_profile_achievements()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- D. Eco Hero Month (Utrzymaj 30-dniowy streak aktywności)
  IF NEW.streak_days >= 30 THEN
    INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
    VALUES (NEW.id, 'eco_hero_month', now())
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_achievements ON public.profiles;
CREATE TRIGGER trg_profile_achievements
  AFTER UPDATE OF streak_days
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_evaluate_profile_achievements();


-- 3. Function: Evaluate Transaction Source Achievements (e.g. Partner Games / Offerwall)
-- Triggers on: water_drop_transactions (AFTER INSERT)
CREATE OR REPLACE FUNCTION public.trg_evaluate_transaction_achievements()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- E. Green Player (Poświęć czas w grze partnerskiej - source = GAMEPLAY_OFFERWALL)
  IF NEW.source = 'GAMEPLAY_OFFERWALL' THEN
    INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
    VALUES (NEW.user_id, 'green_player', now())
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transaction_achievements ON public.water_drop_transactions;
CREATE TRIGGER trg_transaction_achievements
  AFTER INSERT
  ON public.water_drop_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_evaluate_transaction_achievements();
