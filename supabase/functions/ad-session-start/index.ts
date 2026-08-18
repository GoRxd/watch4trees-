import { corsHeaders } from '../_shared/cors.ts';
import { signSessionToken } from '../_shared/crypto.ts';
import { getRandomQuiz } from '../_shared/quizzes.ts';
import { getSupabaseAdmin, getSupabaseUserClient } from '../_shared/supabase-admin.ts';

const SESSION_CONFIGS = {
  quick: { durationSeconds: 15, adCount: 1, waterReward: 1, pointsReward: 25 },
  focus: { durationSeconds: 30, adCount: 2, waterReward: 3, pointsReward: 80 },
  deep: { durationSeconds: 60, adCount: 4, waterReward: 6, pointsReward: 180 },
} as const;

type SessionType = keyof typeof SESSION_CONFIGS;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUser = getSupabaseUserClient(authHeader);
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const sessionType: SessionType = (body.sessionType in SESSION_CONFIGS) ? body.sessionType : 'quick';
    const config = SESSION_CONFIGS[sessionType];

    const supabaseAdmin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('daily_watched_count, last_watch_date, streak_days, active_session_until')
      .eq('id', user.id)
      .single();

    console.log('[ad-session-start] user.id:', user.id, 'profileError:', profileError, 'profile:', profile);

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'User profile not found', details: profileError }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const isNewDay = profile.last_watch_date !== today;
    const currentDailyCount = isNewDay ? 0 : profile.daily_watched_count;

    if (currentDailyCount + config.adCount > 15) {
      return new Response(JSON.stringify({
        error: 'Daily limit reached: Maximum 15 rewarded ads per day allowed.',
        dailyLimitRemaining: Math.max(0, 15 - currentDailyCount)
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --------------------------------------------------------------------------
    // Atomic Single Active Session Lock Enforcement:
    // Only acquires lock if active_session_until is null or already expired (<= now).
    // Concurrently fired requests will fail atomically (0 rows modified).
    // --------------------------------------------------------------------------
    const nowIso = new Date().toISOString();
    const sessionExpiresAt = new Date(Date.now() + (config.durationSeconds * 1000)).toISOString();

    const { data: lockedProfile, error: lockError } = await supabaseAdmin
      .from('profiles')
      .update({ active_session_until: sessionExpiresAt })
      .eq('id', user.id)
      .or(`active_session_until.is.null,active_session_until.lte.${nowIso}`)
      .select('id, active_session_until')
      .maybeSingle();

    if (lockError || !lockedProfile) {
      const activeUntilTime = profile.active_session_until ? new Date(profile.active_session_until).getTime() : 0;
      const remainingSeconds = Math.max(1, Math.ceil((activeUntilTime - Date.now()) / 1000));

      return new Response(JSON.stringify({
        error: `ActiveSessionInProgress: Trwa już aktywna sesja. Pozostało: ${remainingSeconds}s.`,
        remainingSeconds
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    // Generate random quiz for attention verification
    const quiz = getRandomQuiz();
    const sessionId = crypto.randomUUID();
    const nonce = crypto.randomUUID();

    // Create cryptographically signed session token with HMAC-SHA256
    const sessionToken = await signSessionToken({
      userId: user.id,
      sessionId,
      sessionType,
      durationSeconds: config.durationSeconds,
      waterReward: config.waterReward,
      pointsReward: config.pointsReward,
      adCount: config.adCount,
      startedAt: Date.now(),
      nonce,
      quizId: quiz.id,
      correctOptionId: quiz.correctOptionId,
    });

    // Return sanitized quiz to client (WITHOUT revealing correctOptionId!)
    return new Response(JSON.stringify({
      success: true,
      sessionToken,
      sessionType,
      durationSeconds: config.durationSeconds,
      waterReward: config.waterReward,
      pointsReward: config.pointsReward,
      adCount: config.adCount,
      quiz: {
        id: quiz.id,
        questionPl: quiz.questionPl,
        questionEn: quiz.questionEn,
        options: quiz.options,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[ad-session-start] Internal Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
