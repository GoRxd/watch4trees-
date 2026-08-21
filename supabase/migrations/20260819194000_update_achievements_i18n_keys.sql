-- ==============================================================================
-- Watch4Trees - Migration: Update Achievements to Translation Key Codes
-- ==============================================================================

UPDATE public.achievements
SET 
  title = 'achievements.items.first_seed.title',
  description = 'achievements.items.first_seed.desc'
WHERE id = 'first_seed';

UPDATE public.achievements
SET 
  title = 'achievements.items.water_master.title',
  description = 'achievements.items.water_master.desc'
WHERE id = 'water_master';

UPDATE public.achievements
SET 
  title = 'achievements.items.green_player.title',
  description = 'achievements.items.green_player.desc'
WHERE id = 'green_player';

UPDATE public.achievements
SET 
  title = 'achievements.items.forest_guardian.title',
  description = 'achievements.items.forest_guardian.desc'
WHERE id = 'forest_guardian';

UPDATE public.achievements
SET 
  title = 'achievements.items.eco_hero_month.title',
  description = 'achievements.items.eco_hero_month.desc'
WHERE id = 'eco_hero_month';
