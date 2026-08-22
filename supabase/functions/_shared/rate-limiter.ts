import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from './cors.ts';

export interface RateLimitResult {
  allowed: boolean;
  current_count: number;
  remaining: number;
  reset_after_seconds: number;
}

export interface RateLimitOptions {
  action: string;
  userId?: string | null;
  maxRequests: number;
  windowSeconds: number;
  errorMessage?: string;
}

/**
 * Extracts the real client IP from Cloudflare or standard proxy headers.
 */
export function getClientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const xRealIp = req.headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();

  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0];
    if (firstIp) return firstIp.trim();
  }

  return '127.0.0.1';
}

/**
 * Executes atomic PostgreSQL stored procedure to evaluate sliding window rate limit.
 */
export async function evaluateRateLimit(
  supabaseAdmin: SupabaseClient,
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
    p_key: key,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });

  if (error || !data || data.length === 0) {
    console.error('[RateLimiter] Database RPC Error or fallback:', error);
    // Fail-open in case of unexpected DB error, but log it
    return {
      allowed: true,
      current_count: 1,
      remaining: maxRequests - 1,
      reset_after_seconds: windowSeconds,
    };
  }

  const res = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(res.allowed),
    current_count: Number(res.current_count),
    remaining: Number(res.remaining),
    reset_after_seconds: Number(res.reset_after_seconds),
  };
}

/**
 * Enforces rate limiting on a request.
 * Returns a 429 Response if rate limit is exceeded, or null if request is permitted.
 */
export async function enforceRateLimit(
  req: Request,
  supabaseAdmin: SupabaseClient,
  options: RateLimitOptions
): Promise<Response | null> {
  const clientIp = getClientIp(req);
  const identifier = options.userId ? `user:${options.userId}` : `ip:${clientIp}`;
  const rateKey = `${identifier}:${options.action}`;

  const result = await evaluateRateLimit(
    supabaseAdmin,
    rateKey,
    options.maxRequests,
    options.windowSeconds
  );

  if (!result.allowed) {
    const retryAfter = result.reset_after_seconds.toString();
    const errorMsg = options.errorMessage ||
      `Rate limit exceeded: Please wait ${retryAfter}s before retrying this action.`;

    return new Response(
      JSON.stringify({
        error: 'TooManyRequests',
        message: errorMsg,
        retryAfterSeconds: result.reset_after_seconds,
        limit: options.maxRequests,
        remaining: 0,
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': retryAfter,
          'X-RateLimit-Limit': options.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': retryAfter,
        },
      }
    );
  }

  return null;
}

/**
 * Checks global IP flood protection (e.g., max 60 req/min).
 */
export async function enforceGlobalIpRateLimit(
  req: Request,
  supabaseAdmin: SupabaseClient,
  maxRequests = 30,
  windowSeconds = 60
): Promise<Response | null> {
  const clientIp = getClientIp(req);
  return enforceRateLimit(req, supabaseAdmin, {
    action: 'global_flood_protection',
    userId: null, // enforces on IP
    maxRequests,
    windowSeconds,
    errorMessage: 'Zbyt wiele zapytań z Twojego adresu IP. Poczekaj chwilę przed kolejną próbą.',
  });
}
