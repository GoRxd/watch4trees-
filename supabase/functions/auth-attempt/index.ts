import { corsHeaders } from '../_shared/cors.ts';
import { getClientIp } from '../_shared/rate-limiter.ts';
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email || '').trim().toLowerCase();
    const action = body.action || 'check'; // 'check' | 'record_failed' | 'record_success'
    
    const clientIp = getClientIp(req);
    // Combine IP with hashed target email to protect against both targeted and distributed floods
    const identifier = `${clientIp}_${email ? btoa(email).slice(0, 20) : 'anon'}`;

    const supabaseAdmin = getSupabaseAdmin();

    let isSuccess = false;
    if (action === 'record_success') {
      isSuccess = true;
    }

    const { data, error } = await supabaseAdmin.rpc('evaluate_auth_attempt', {
      p_identifier: identifier,
      p_is_success: isSuccess
    });

    if (error) {
      console.error('[auth-attempt] Database RPC Error:', error);
      return new Response(JSON.stringify({ allowed: true, lockoutRemainingSeconds: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = Array.isArray(data) ? data[0] : data;
    const allowed = Boolean(res?.allowed ?? true);
    const lockoutSec = Number(res?.lockout_remaining_seconds || 0);

    if (!allowed && lockoutSec > 0) {
      return new Response(JSON.stringify({
        allowed: false,
        lockoutRemainingSeconds: lockoutSec,
        error: 'TooManyRequests',
        message: `Zbyt wiele nieudanych prób logowania. Odczekaj ${lockoutSec}s przed kolejną próbą.`
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': lockoutSec.toString(),
        },
      });
    }

    return new Response(JSON.stringify({
      allowed: true,
      failedAttempts: Number(res?.failed_attempts || 0),
      lockoutRemainingSeconds: 0
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[auth-attempt] Internal Error:', err);
    return new Response(JSON.stringify({ allowed: true, lockoutRemainingSeconds: 0 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
