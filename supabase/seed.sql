-- ==============================================================================
-- Watch4Trees - Seed Data (Supabase Local & Production Seed)
-- ==============================================================================

-- 1. Insert Initial Eco Projects
INSERT INTO public.eco_projects (id, name, organization, region, country_code, tree_species, co2_absorption_kg_year, is_active)
VALUES
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'Nadleśnictwo Lipusz (Kaszuby)', 'Posadzimy.pl', 'Polska', 'PL', 'Dąb Szypułkowy (Quercus robur)', 22.00, true),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'Nadleśnictwo Spychowo (Mazury)', 'Posadzimy.pl', 'Polska', 'PL', 'Sosna Zwyczajna (Pinus sylvestris)', 18.00, true),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'Mahajanga Mangrove Restoration', 'Eden Reforestation Projects', 'Madagaskar', 'MG', 'Namorzyny Czerwone (Rhizophora mangle)', 25.00, true)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Gamification Achievements
INSERT INTO public.achievements (id, title, description, icon_name, required_trees, required_streak)
VALUES
  ('first_seed', 'Pierwsze Nasiono', 'Zdobądź swoją pierwszą kroplę wody i rozpocznij przygodę.', '🌰', 0, 1),
  ('water_master', 'Mistrz Kropel', 'Napełnij konewkę i uzyskaj 10 kropel do zasadzenia drzewa.', '💧', 1, 3),
  ('green_player', 'Gracz Ekolog', 'Poświęć czas w grze partnerskiej, zamieniając zabawę w sadzonki.', '🎮', 1, 1),
  ('forest_guardian', 'Strażnik Puszczy', 'Zasadź co najmniej 10 prawdziwych drzew.', '🌲', 10, 5),
  ('eco_hero_month', 'Eko Bohater Miesiąca', 'Utrzymaj 30-dniowy streak aktywności bez przerwy.', '🏆', 25, 30)
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Demo User in auth.users & auth.identities
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  phone_change,
  phone_change_token,
  email_change_token_current,
  email_change_confirm_status,
  is_sso_user,
  is_anonymous
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '00000000-0000-0000-0000-000000000000',
  'ekolog@watch4trees.org',
  extensions.crypt('demoPassword123!', extensions.gen_salt('bf', 10)),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"damian_eko","full_name":"Damian (Eko-Ogrodnik)","avatar_url":"👨‍🌾"}'::jsonb,
  false,
  now(),
  now(),
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  0,
  false,
  false
) ON CONFLICT (id) DO UPDATE SET
  encrypted_password = extensions.crypt('demoPassword123!', extensions.gen_salt('bf', 10)),
  email_confirmed_at = now(),
  raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
  raw_user_meta_data = '{"username":"damian_eko","full_name":"Damian (Eko-Ogrodnik)","avatar_url":"👨‍🌾"}'::jsonb;


INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  json_build_object('sub', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'email', 'ekolog@watch4trees.org'),
  'email',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  now(),
  now(),
  now()
) ON CONFLICT (provider, provider_id) DO NOTHING;

-- 4. Upsert Profile for Demo User
INSERT INTO public.profiles (id, username, full_name, avatar_url, daily_watched_count, last_watch_date, streak_days, created_at, updated_at)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'damian_eko',
  'Damian (Eko-Ogrodnik)',
  '👨‍🌾',
  3,
  CURRENT_DATE,
  6,
  now(),
  now()
) ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  streak_days = EXCLUDED.streak_days;

-- 5. Upsert User Water Balance
INSERT INTO public.user_water_balance (user_id, current_drops, total_drops_earned, total_trees_planted, total_co2_offset_kg, updated_at)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  6,
  186,
  18,
  396.00,
  now()
) ON CONFLICT (user_id) DO UPDATE SET
  current_drops = EXCLUDED.current_drops,
  total_drops_earned = EXCLUDED.total_drops_earned,
  total_trees_planted = EXCLUDED.total_trees_planted,
  total_co2_offset_kg = EXCLUDED.total_co2_offset_kg;

-- 6. Insert Planted Trees for Demo User
INSERT INTO public.planted_trees (id, user_id, project_id, status, tree_number, latitude, longitude, planted_at, created_at)
VALUES
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'CERTIFIED', 'W4T-PL-2026-0941', 54.01250, 17.82140, '2026-08-12 10:00:00+02', '2026-08-12 09:30:00+02'),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'CERTIFIED', 'W4T-PL-2026-0812', 53.62890, 21.34110, '2026-07-28 14:15:00+02', '2026-07-28 13:00:00+02'),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'CERTIFIED', 'W4T-GL-2026-4401', -15.71670, 46.31670, '2026-07-15 08:45:00+03', '2026-07-15 08:00:00+03')
ON CONFLICT (id) DO NOTHING;

-- 7. Insert Certificates for Planted Trees
INSERT INTO public.tree_certificates (id, tree_id, certificate_number, verified_by, pdf_url, batch_id, issued_at)
VALUES
  ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'CERT-W4T-2026-0941', 'Posadzimy.pl', 'https://watch4trees.org/cert/CERT-W4T-2026-0941.pdf', 'BATCH-LIPUSZ-2026-Q3', '2026-08-12 11:00:00+02'),
  ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380d02', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c02', 'CERT-W4T-2026-0812', 'Posadzimy.pl', 'https://watch4trees.org/cert/CERT-W4T-2026-0812.pdf', 'BATCH-MAZURY-2026-Q3', '2026-07-28 15:00:00+02'),
  ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380d03', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c03', 'CERT-W4T-2026-4401', 'Eden Reforestation Projects', 'https://watch4trees.org/cert/CERT-W4T-2026-4401.pdf', 'BATCH-MG-2026-07', '2026-07-15 09:30:00+03')
ON CONFLICT (id) DO NOTHING;

-- 8. Insert Unlocked Achievements for Demo User
INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'first_seed', now() - INTERVAL '30 days'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'water_master', now() - INTERVAL '20 days'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'forest_guardian', now() - INTERVAL '3 days')
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- 9. Insert Sample Water Drop Transactions
INSERT INTO public.water_drop_transactions (id, user_id, amount, source, metadata, created_at)
VALUES
  ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380e01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1, 'AD_REWARD', '{"session":"quick","provider":"google_admob"}', now() - INTERVAL '2 hours'),
  ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380e02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 3, 'AD_REWARD', '{"session":"focus","provider":"unity_ads"}', now() - INTERVAL '5 hours'),
  ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380e03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 5, 'GAMEPLAY_OFFERWALL', '{"game":"EcoEmpire","level":5}', now() - INTERVAL '1 day'),
  ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380e04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -10, 'TREE_CONVERSION', '{"tree_id":"c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c01"}', now() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;
