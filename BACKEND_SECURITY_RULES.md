# 🛡️ Watch4Trees – Backend Security & Architecture Guidelines

This document establishes the **security principles and architectural rules** governing the backend infrastructure (Supabase Edge Functions, PostgreSQL RLS) and Frontend ↔ Backend contract for **Watch4Trees**.

---

## 🏛️ 1. Golden Rule: Zero Client Trust

> **"The client (browser / mobile web / DevTools console) is an environment fully controlled by the user and susceptible to tampering. We never trust input arriving from the frontend."**

1. **100% Server-Authoritative Business Logic:**
   - Computation of rewards (water drops, eco points, bonus drops, CO2 absorption).
   - Tree completion triggers (10 drops = 1 tree).
   - Minting certificates and forestry passport numbers (`W4T-PL-...`, `CERT-...`).
   - Computing and resetting daily view quotas and activity streaks.
   - Evaluation of gamification and achievement milestones.

2. **Minimal Input Surface:**
   - The frontend transmits **strictly necessary identifiers and action intents** (e.g., `{ sessionType: 'quick' }`, `{ sessionToken, selectedOptionId }`, `{ drops: 1 }`).
   - The frontend **never** submits reward amounts or state claims (e.g., `rewardAmount`, `pointsToAdd`, `isTreeCompleted`).

---

## 🔐 2. Information Disclosure Prevention

The backend **never returns sensitive state** that could allow bypassing client checks or automating fraud:

| Surface | Security Policy |
|---|---|
| **Eco-Quizzes (Attention Check)** | `correctOptionId` remains **strictly on the server / inside the HMAC payload**. The client receives shuffled options **without any correctness metadata**. |
| **Session Tokens (`sessionToken`)** | Contains session parameters sealed with an **HMAC-SHA256** cryptographic signature. Any manipulation of timestamps, duration, or rewards immediately invalidates the signature. |
| **Private Keys & Secrets** | `SUPABASE_SERVICE_ROLE_KEY` and session signing secrets are accessible exclusively via Deno runtime environment variables and **never leak into the client bundle**. |
| **Internal Identifiers** | Only public, verified certificate hashes and project references are exposed to clients. |

---

## ⏱️ 3. Anti-Cheat & Anti-Fraud Mechanisms

### A. Anti-Speedhack & Timing Verification
- Every rewarded session is bound to an exact duration (`durationSeconds`).
- At redemption (`ad-session-claim`), the backend validates mathematically:  
  `Date.now() - payload.startedAt >= (payload.durationSeconds - 1.5s)`
- Premature requests sent immediately from developer consoles are rejected with `400 FraudDetected: Session completed too quickly`.

### B. Single Active Session Lock
- A user may participate in **at most one active video session simultaneously**.
- Upon invoking `ad-session-start`, the backend writes a timestamp lock to the user profile (`active_session_until = now + durationSeconds`).
- Concurrent attempts across tabs or via script loops fail with **`429 Too Many Requests (ActiveSessionInProgress)`**.

### C. Anti-Replay Protection
- Every session generates a cryptographically random `nonce` (UUIDv4) embedded in the signed token.
- Before disbursing rewards, the backend checks the `water_drop_transactions` ledger to verify the `nonce` was never redeemed.
- Each session token can be claimed **strictly once**.

### D. Daily Rate Limiting
- The 15 daily ad allowance is enforced at the database and Edge Function tier based on `last_watch_date` and `daily_watched_count`.

---

## 🗄️ 4. Database & Row Level Security (RLS)

All database tables operate under **Strict Read-Only Policies for Clients**:

1. **Sensitive Tables (`user_balance`, `water_drop_transactions`, `planted_trees`):**
   - Grants for role `authenticated`: **`SELECT` only** (scoped to `auth.uid() = user_id`).
   - Grants for `INSERT` and `UPDATE`: **Exclusively `service_role` (Edge Functions)**.
   - Any client calling `supabase.from('user_balance').update(...)` from DevTools receives `403 Permission Denied` directly from PostgreSQL.

2. **Open Impact Ledger (`planted_trees`, `eco_projects`):**
   - Public tables: `SELECT` is globally queryable for transparency.
   - Insertion of new planted tree records: restricted to authorized `tree-water` function execution.

3. **User Profiles (`profiles`):**
   - Users may only update **cosmetic preferences** (`username`, `full_name`, `avatar_url`).
   - System columns (`daily_watched_count`, `streak_days`, `active_session_until`) are mutable only by backend services.

---

## 📋 5. New Endpoint Security Checklist

Before deploying any new backend function, confirm:
- [ ] Endpoint validates user session JWT (`supabaseUser.auth.getUser()`).
- [ ] Request parameters are validated, sanitized, and constrained.
- [ ] All balance and state transitions are performed server-side with `service_role`.
- [ ] JSON responses contain no leaks of keys, hashes, or other users' private records.
- [ ] Financial and drop transactions are atomically recorded in `water_drop_transactions`.
