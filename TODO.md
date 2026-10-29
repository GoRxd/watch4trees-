# 📋 Watch4Trees – Production Checklist & Backlog (TODO.md)

This document outlines the deployment, architectural, and optimization roadmap prior to public production release.

---

## 🔐 1. Secrets & Production Cryptographic Security

To ensure full integrity of session verification and anti-fraud mechanics in production:

- [ ] **Enforce Runtime `EDGE_FUNCTION_SECRET`:**
  - Remove reliance on the fallback signing key (`DEFAULT_SECRET`) in `supabase/functions/_shared/crypto.ts` when running in production.
  - Require `EDGE_FUNCTION_SECRET` to be configured directly within Supabase Dashboard Secrets, failing immediately on startup if missing.
- [ ] **Rotate Production Service Keys:**
  - Ensure `SUPABASE_SERVICE_ROLE_KEY` is loaded strictly from environment secrets and never bundled into client applications.

---

## 🛡️ 2. Network Security & Cloudflare WAF (Zero-Invocation Shield)

To eliminate unwanted invocations on Supabase (*Edge Function Invocations*) during bot bursts or DDoS attempts:

- [ ] **Connect Production Domain to Cloudflare:**
  - Configure DNS records on Cloudflare for production domains (`watch4trees.org` and `api.watch4trees.org`).
- [ ] **Cloudflare WAF Rate Limiting Rules:**
  - Set up rule in *Cloudflare > Security > WAF > Rate limiting rules*:
    - **Path:** `/functions/v1/*`
    - **Limit:** Max 60 requests / minute per IP.
    - **Action:** `Block` (returns `429 Too Many Requests` directly from Cloudflare edge servers).
- [ ] **Bot Fight Mode & DDoS Shield:**
  - Enable *Cloudflare Bot Fight Mode* to automatically filter known scrapers, crawlers, and automated abuse tools.
- [ ] **Cloudflare Turnstile CAPTCHA for Supabase Auth:**
  - Enable Cloudflare Turnstile in *Supabase > Authentication > Bot Protection (Captcha)*.
  - Protect registration and sign-in flows against rotating residential proxy attacks without UX friction.
- [ ] **Hide Direct Supabase Host (`.supabase.co`):**
  - Route all API traffic via custom domain proxy (`api.watch4trees.org/functions/v1/...`) to prevent direct targeting of the project host.

---

## 🎮 3. Monetization & Play-to-Plant Offerwalls

- [ ] **`offerwall-postback` Edge Function:**
  - Build dedicated server-to-server (S2S) postback endpoint for Offerwall networks (*adjoe / Playtime SDK, Tapjoy, Unity*).
  - Verify HMAC cryptographic provider signatures before accepting rewards.
  - Atomically credit water rewards to `water_drop_transactions` under source `GAMEPLAY_OFFERWALL`.
- [ ] **Play-to-Plant View in Angular:**
  - Dedicated gaming catalog page displaying partner game cards and water drop conversion rates.

---

## 🌳 4. Tree Registry & Eco-Certificates (Open Impact Ledger)

- [ ] **Dynamic PDF Certificate Generator:**
  - High-resolution SVG/PDF certificate renderer featuring a unique QR code, certified forestry plot coordinates, and verified CO2 absorption metrics.
- [ ] **Forestry Partner API Integrations:**
  - Automated webhooks with verified planting partners (*Posadzimy.pl*, *One Tree Planted*) to trigger physical seedling orders upon batch milestones.
- [ ] **Interactive Reforestation Map:**
  - Interactive map module (Leaflet / MapLibre) displaying actual GPS coordinates and photo documentation of planted forest plots.

---

## ⏱️ 5. Automation & CRON Schedulers

- [ ] **Daily Streak & Limit Reset CRON:**
  - Configure `pg_cron` in Supabase to evaluate daily user engagement, resetting streaks if inactive for >36 hours.
- [ ] **Automated ESG Impact Reports:**
  - Monthly automated aggregate reporting for corporate sponsors and ESG auditors.
