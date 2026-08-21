-- ==============================================================================
-- Watch4Trees - Migration: Enable Realtime for User Achievements
-- ==============================================================================

-- Enable Replication Publication on user_achievements table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_achievements;
