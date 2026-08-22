import { corsHeaders } from '../_shared/cors.ts';
import { verifySessionToken } from '../_shared/crypto.ts';
import { enforceGlobalIpRateLimit, enforceRateLimit } from '../_shared/rate-limiter.ts';
import { getSupabaseAdmin, getSupabaseUserClient } from '../_shared/supabase-admin.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Global IP Flood Protection (max 60 req/min per IP)
    const globalRateLimitResponse = await enforceGlobalIpRateLimit(req, supabaseAdmin, 60, 60);
    if (globalRateLimitResponse) {
      return globalRateLimitResponse;
    }

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

    // 2. User Endpoint Rate Limiting (max 1 claim attempt / 15 seconds)
    const endpointRateLimitResponse = await enforceRateLimit(req, supabaseAdmin, {
      action: 'ad_session_claim',
      userId: user.id,
      maxRequests: 1,
      windowSeconds: 15,
      errorMessage: 'Zbyt częste próby zatwierdzania nagrody. Odczekaj chwilę.',
    });
    if (endpointRateLimitResponse) {
      return endpointRateLimitResponse;
    }

    const body = await req.json().catch(() => ({}));
    const { sessionToken, selectedOptionId } = body;

    if (!sessionToken || !selectedOptionId) {
      return new Response(JSON.stringify({ error: 'Missing sessionToken or selectedOptionId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Cryptographic token verification (HMAC-SHA256 signature)
    const payload = await verifySessionToken(sessionToken);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid, corrupted, or forged session token.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. User ownership verification
    if (payload.userId !== user.id) {
      return new Response(JSON.stringify({ error: 'Session token does not belong to the authenticated user.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Timing / Anti-Speedhack & TTL Expiration verification
    const now = Date.now();
    const elapsedMs = now - payload.startedAt;
    const minRequiredMs = (payload.durationSeconds - 1.5) * 1000; // 1.5s network tolerance
    const maxAllowedMs = (payload.durationSeconds + 300) * 1000; // 5 minutes grace period for quiz completion

    if (elapsedMs < minRequiredMs) {
      return new Response(JSON.stringify({
        error: 'FraudDetected: Session completed too quickly. Reward rejected.',
        elapsedSeconds: (elapsedMs / 1000).toFixed(1),
        requiredSeconds: payload.durationSeconds
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (elapsedMs > maxAllowedMs) {
      return new Response(JSON.stringify({
        error: 'SessionExpired: Session token has expired. Quiz must be completed within 5 minutes.',
        elapsedSeconds: (elapsedMs / 1000).toFixed(1),
        maxAllowedSeconds: payload.durationSeconds + 300
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Server-Side Quiz verification
    if (selectedOptionId !== payload.correctOptionId) {
      return new Response(JSON.stringify({
        error: 'Incorrect quiz answer. Human presence not verified.',
        quizVerified: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --------------------------------------------------------------------------
    // 5. Anti-Replay & Double-Spend Prevention:
    // Atomic insert into water_drop_transactions with unique nonce index.
    // If concurrent requests attempt to claim the same nonce, only ONE insert
    // will succeed; all others are rejected immediately by Postgres Unique Index.
    // --------------------------------------------------------------------------
    const { error: insertTxError } = await supabaseAdmin
      .from('water_drop_transactions')
      .insert({
        user_id: user.id,
        amount: payload.waterReward,
        source: 'AD_REWARD',
        metadata: {
          sessionId: payload.sessionId,
          nonce: payload.nonce,
          sessionType: payload.sessionType,
          adCount: payload.adCount,
          durationSeconds: payload.durationSeconds,
          claimedAt: new Date().toISOString()
        }
      });

    if (insertTxError) {
      // Error code 23505 = unique_violation in PostgreSQL
      if (insertTxError.code === '23505' || insertTxError.message?.includes('duplicate key') || insertTxError.message?.includes('nonce')) {
        return new Response(JSON.stringify({ error: 'Reward already claimed for this session token (Replay detected).' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.error('[ad-session-claim] Error inserting transaction:', insertTxError);
      return new Response(JSON.stringify({ error: 'Failed to record transaction' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Fetch Profile & Balance to apply updates
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const { data: balance } = await supabaseAdmin
      .from('user_balance')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!profile || !balance) {
      return new Response(JSON.stringify({ error: 'User record not found in database' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const isNewDay = profile.last_watch_date !== today;
    const currentDaily = isNewDay ? 0 : profile.daily_watched_count;

    if (currentDaily + payload.adCount > 15) {
      return new Response(JSON.stringify({ error: 'Daily limit exceeded (max 15/day).' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate streak
    let newStreak = profile.streak_days;
    if (isNewDay) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      newStreak = profile.last_watch_date === yesterday ? profile.streak_days + 1 : 1;
    }

    const newDailyCount = currentDaily + payload.adCount;
    const newCurrentDrops = balance.current_drops + payload.waterReward;
    const newTotalDrops = balance.total_drops_earned + payload.waterReward;
    const newEcoPoints = balance.eco_points + payload.pointsReward;

    // 7. Execute database updates (also clear active session lock)
    await supabaseAdmin
      .from('profiles')
      .update({
        daily_watched_count: newDailyCount,
        last_watch_date: today,
        streak_days: newStreak,
        active_session_until: null, // Session successfully finished and claimed!
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    await supabaseAdmin
      .from('user_balance')
      .update({
        current_drops: newCurrentDrops,
        total_drops_earned: newTotalDrops,
        eco_points: newEcoPoints,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    return new Response(JSON.stringify({
      success: true,
      current_drops: newCurrentDrops,
      active_tree_drops: balance.active_tree_drops,
      eco_points: newEcoPoints,
      total_drops_earned: newTotalDrops,
      daily_watched_count: newDailyCount,
      dailyLimitRemaining: Math.max(0, 15 - newDailyCount),
      streak_days: newStreak
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[ad-session-claim] Internal Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
