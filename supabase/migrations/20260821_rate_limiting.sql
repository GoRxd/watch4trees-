-- ==============================================================================
-- Watch4Trees - Server-Side Auth Rate Limiting & Persistent Penalty Escalation
-- ==============================================================================

-- 1. Table for tracking all rate limits & persistent penalties
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_request_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  violation_count INT NOT NULL DEFAULT 0,
  last_violation_at TIMESTAMPTZ,
  blocked_until TIMESTAMPTZ
);

-- Index for cleanup of stale records
CREATE INDEX IF NOT EXISTS idx_rate_limits_last_request 
  ON public.rate_limits(last_request_at);

-- Row Level Security: Strictly for service_role only (no public/client direct access)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- 2. Stored Procedure for Generic Sliding Window Rate Checks
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_max_requests INT,
  p_window_seconds INT
)
RETURNS TABLE (
  allowed BOOLEAN,
  current_count INT,
  remaining INT,
  reset_after_seconds INT
)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_row public.rate_limits%ROWTYPE;
  v_window_interval INTERVAL := (p_window_seconds || ' seconds')::INTERVAL;
  v_reoffense_interval INTERVAL := INTERVAL '30 minutes';
  v_new_count INT;
  v_violations INT;
  v_base_reset_sec INT;
  v_penalty_sec INT;
  v_multiplier INT;
BEGIN
  -- Opportunistic cleanup of stale rate limits
  IF random() < 0.05 THEN
    DELETE FROM public.rate_limits WHERE last_request_at < (v_now - INTERVAL '2 hours');
  END IF;

  SELECT * INTO v_row
  FROM public.rate_limits
  WHERE key = p_key
  FOR UPDATE;

  -- If currently under an active server-side block, enforce it immediately
  IF FOUND AND v_row.blocked_until IS NOT NULL AND v_row.blocked_until > v_now THEN
    RETURN QUERY SELECT
      FALSE AS allowed,
      v_row.count AS current_count,
      0 AS remaining,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_row.blocked_until - v_now)))::INT) AS reset_after_seconds;
    RETURN;
  END IF;

  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (key, count, window_start, last_request_at, violation_count, last_violation_at, blocked_until)
    VALUES (p_key, 1, v_now, v_now, 0, NULL, NULL);

    RETURN QUERY SELECT
      TRUE AS allowed,
      1 AS current_count,
      GREATEST(0, p_max_requests - 1) AS remaining,
      p_window_seconds AS reset_after_seconds;
    RETURN;
  END IF;

  -- Reset violation memory if 30 minutes elapsed since last offense
  IF v_row.last_violation_at IS NOT NULL AND (v_now - v_row.last_violation_at) >= v_reoffense_interval THEN
    v_row.violation_count := 0;
  END IF;

  -- Check if counting window expired
  IF (v_now - v_row.window_start) >= v_window_interval THEN
    UPDATE public.rate_limits
    SET count = 1,
        window_start = v_now,
        last_request_at = v_now,
        violation_count = v_row.violation_count,
        blocked_until = NULL
    WHERE key = p_key;

    RETURN QUERY SELECT
      TRUE AS allowed,
      1 AS current_count,
      GREATEST(0, p_max_requests - 1) AS remaining,
      p_window_seconds AS reset_after_seconds;
    RETURN;
  ELSE
    v_base_reset_sec := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_row.window_start + v_window_interval - v_now)))::INT);

    IF v_row.count >= p_max_requests THEN
      v_violations := v_row.violation_count + 1;

      -- Escalation ladder: 1st: 1x, 2nd: 4x, 3rd: 20x (5 min), 4th: 60x (15 min), 5+: max 1800s (30 min)
      IF v_violations = 1 THEN v_multiplier := 1;
      ELSIF v_violations = 2 THEN v_multiplier := 4;
      ELSIF v_violations = 3 THEN v_multiplier := 20;
      ELSIF v_violations = 4 THEN v_multiplier := 60;
      ELSE v_multiplier := 120;
      END IF;

      v_penalty_sec := LEAST(1800, v_base_reset_sec * v_multiplier);

      UPDATE public.rate_limits
      SET last_request_at = v_now,
          violation_count = v_violations,
          last_violation_at = v_now,
          blocked_until = v_now + (v_penalty_sec || ' seconds')::INTERVAL
      WHERE key = p_key;

      RETURN QUERY SELECT
        FALSE AS allowed,
        v_row.count AS current_count,
        0 AS remaining,
        v_penalty_sec AS reset_after_seconds;
      RETURN;
    ELSE
      v_new_count := v_row.count + 1;
      UPDATE public.rate_limits
      SET count = v_new_count,
          last_request_at = v_now
      WHERE key = p_key;

      RETURN QUERY SELECT
        TRUE AS allowed,
        v_new_count AS current_count,
        GREATEST(0, p_max_requests - v_new_count) AS remaining,
        v_base_reset_sec AS reset_after_seconds;
      RETURN;
    END IF;
  END IF;
END;
$$;

-- 3. Stored Procedure specifically for Auth Attempt Evaluation & Server-Side Enforcement
CREATE OR REPLACE FUNCTION public.evaluate_auth_attempt(
  p_identifier TEXT,
  p_is_success BOOLEAN
)
RETURNS TABLE (
  allowed BOOLEAN,
  failed_attempts INT,
  lockout_remaining_seconds INT
)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_key TEXT := 'auth:lockout:' || p_identifier;
  v_row public.rate_limits%ROWTYPE;
  v_violations INT;
  v_penalty_sec INT;
  v_multiplier INT;
BEGIN
  SELECT * INTO v_row
  FROM public.rate_limits
  WHERE key = v_key
  FOR UPDATE;

  -- 1. Check if currently blocked
  IF FOUND AND v_row.blocked_until IS NOT NULL AND v_row.blocked_until > v_now THEN
    RETURN QUERY SELECT
      FALSE AS allowed,
      v_row.count AS failed_attempts,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_row.blocked_until - v_now)))::INT) AS lockout_remaining_seconds;
    RETURN;
  END IF;

  -- 2. If successful login, wipe out lockout and reset state
  IF p_is_success THEN
    IF FOUND THEN
      DELETE FROM public.rate_limits WHERE key = v_key;
    END IF;
    RETURN QUERY SELECT TRUE AS allowed, 0 AS failed_attempts, 0 AS lockout_remaining_seconds;
    RETURN;
  END IF;

  -- 3. Handle Failed Attempt on Server
  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (key, count, window_start, last_request_at, violation_count, last_violation_at, blocked_until)
    VALUES (v_key, 1, v_now, v_now, 0, NULL, NULL);

    RETURN QUERY SELECT TRUE AS allowed, 1 AS failed_attempts, 0 AS lockout_remaining_seconds;
    RETURN;
  END IF;

  -- Check if previous block expired (clean up failed count for fresh 3 attempts)
  IF v_row.blocked_until IS NOT NULL AND v_row.blocked_until <= v_now THEN
    v_row.count := 0;
  END IF;

  -- Reset violation level if 30 min passed
  IF v_row.last_violation_at IS NOT NULL AND (v_now - v_row.last_violation_at) >= INTERVAL '30 minutes' THEN
    v_row.violation_count := 0;
  END IF;

  v_row.count := v_row.count + 1;

  -- If 3 or more failed attempts -> lock out on server
  IF v_row.count >= 3 THEN
    v_violations := v_row.violation_count + 1;

    IF v_violations = 1 THEN v_penalty_sec := 15;
    ELSIF v_violations = 2 THEN v_penalty_sec := 60;
    ELSIF v_violations = 3 THEN v_penalty_sec := 300;
    ELSIF v_violations = 4 THEN v_penalty_sec := 900;
    ELSE v_penalty_sec := 1800;
    END IF;

    UPDATE public.rate_limits
    SET count = v_row.count,
        last_request_at = v_now,
        violation_count = v_violations,
        last_violation_at = v_now,
        blocked_until = v_now + (v_penalty_sec || ' seconds')::INTERVAL
    WHERE key = v_key;

    RETURN QUERY SELECT
      FALSE AS allowed,
      v_row.count AS failed_attempts,
      v_penalty_sec AS lockout_remaining_seconds;
    RETURN;
  ELSE
    UPDATE public.rate_limits
    SET count = v_row.count,
        last_request_at = v_now
    WHERE key = v_key;

    RETURN QUERY SELECT
      TRUE AS allowed,
      v_row.count AS failed_attempts,
      0 AS lockout_remaining_seconds;
    RETURN;
  END IF;
END;
$$;
