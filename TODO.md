# 📋 Watch4Trees – Production Checklist & Backlog (TODO.md)

Dokument zawiera listę zadań wdrożeniowych, architektonicznych oraz optymalizacyjnych przed publicznym uruchomieniem platformy na produkcji.

---

## 🛡️ 1. Bezpieczeństwo Sieciowe & Cloudflare WAF (Zero-Invocation Shield)

Aby zapobiec naliczaniu wywołań w Supabase (*Edge Function Invocations*) podczas ewentualnych masowych ataków DDoS / botów:

- [ ] **Podpięcie domeny pod Cloudflare:**
  - Skonfigurowanie rekordów DNS w Cloudflare dla domeny produkcyjnej (np. `watch4trees.org` oraz `api.watch4trees.org`).
- [ ] **Cloudflare WAF Rate Limiting Rules:**
  - Utworzenie reguły w panelu *Cloudflare > Security > WAF > Rate limiting rules*:
    - **Ścieżka:** `/functions/v1/*`
    - **Limit:** Max 60 zapytań / minutę per IP.
    - **Akcja:** `Block` (odpowiedź `429 Too Many Requests` bezpośrednio z serwerów brzegowych Cloudflare).
- [ ] **Bot Fight Mode & DDoS Shield:**
  - Włączenie *Cloudflare Bot Fight Mode* (automatyczne wycinanie znanych skryptów scraperów i botnetów).
- [ ] **Cloudflare Turnstile CAPTCHA dla Supabase Auth:**
  - Włączenie widgetu Cloudflare Turnstile w panelu *Supabase > Authentication > Bot Protection (Captcha)*.
  - Ochrona formularza logowania i rejestracji przed botami rotującymi IP bez angażowania człowieka w uciążliwe obrazki.
- [ ] **Ukrycie bezpośredniego adresu Supabase (`.supabase.co`):**
  - Proxy zapytań przez subdomenę API (`api.watch4trees.org/functions/v1/...`), aby napastnicy nie znali bezpośredniego hosta projektu Supabase.

---

## 🎮 2. Monetyzacja & Moduł Gier (Play-to-Plant Offerwalls)

- [ ] **Edge Function `offerwall-postback`:**
  - Utworzenie dedykowanej funkcji odbierającej powiadomienia S2S (Server-to-Server) z sieci Offerwall (*Playtime SDK / adjoe, Tapjoy, Unity*).
  - Weryfikacja sygnatury kryptograficznej HMAC dostawcy gier.
  - Zapisywanie nagród do `water_drop_transactions` ze źródłem `GAMEPLAY_OFFERWALL`.
- [ ] **Widok Play-to-Plant w aplikacji Angular:**
  - Strona z katalogiem gier i banerami ofert dla graczy z przelicznikiem kropel.

---

## 🌳 3. Ewidencja Drzew & Eko-Certyfikaty (Open Impact Ledger)

- [ ] **Generator PDF Certyfikatów:**
  - Szablon graficzny certyfikatu z unikalnym kodem QR, numerem działki leśnej i sumą pochłanianego CO2.
- [ ] **Integracja API z partnerami zalesień:**
  - Webhook / integracja z *Posadzimy.pl* oraz *One Tree Planted* do zautomatyzowanego zamawiania sadzonek.
- [ ] **Mapa Interaktywna Zalesień:**
  - Moduł mapy (np. Leaflet / MapLibre) pokazujący realne lokalizacje posadzonych lasów.

---

## ⏱️ 4. Automatyzacja & Zadania CRON

- [ ] **CRON dla Streaków i Limitów Dobowych:**
  - Skonfigurowanie `pg_cron` w Supabase do codziennego sprawdzania aktywności użytkowników i resetowania serii przy braku aktywności przez >36h.
- [ ] **Raporty ESG:**
  - Automatyczne comiesięczne agregaty statystyk dla sponsorów i partnerów biznesowych.
