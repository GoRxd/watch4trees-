# 🛡️ Watch4Trees – Backend Security & Architecture Guidelines

Niniejszy dokument definiuje **zasady i standardy bezpieczeństwa** dla architektury backendu (Supabase Edge Functions, PostgreSQL RLS) oraz komunikacji Frontend ↔ Backend w projekcie **Watch4Trees**.

---

## 🏛️ 1. Złota Zasada: Zero Zaufania do Klienta (Zero Client Trust)

> **„Klient (przeglądarka / aplikacja mobilna / konsola DevTools) jest środowiskiem w pełni kontrolowanym przez użytkownika i podatnym na modyfikacje. Nigdy nie ufamy danym przychodzącym z frontendu.”**

1. **100% Logiki Biznesowej na Backendzie:**
   - Wyliczanie nagród (krople wody, punkty eko, bonusy, absorpcja CO2).
   - Warunki ukończenia drzewa (10 kropel = 1 drzewo).
   - Generowanie certyfikatów i numerów paszportów leśnych (`W4T-PL-...`, `CERT-...`).
   - Obliczanie i resetowanie limitów dziennych oraz streaków.
   - Ewaluacja kryteriów osiągnięć (achievements).

2. **Kompaktowe Parametry Żądań (Minimal Input Surface):**
   - Frontend przesyła do API **wyłącznie niezbędne identyfikatory i intencje akcji** (np. `{ sessionType: 'quick' }`, `{ sessionToken, selectedOptionId }`, `{ drops: 1 }`).
   - Frontend **nigdy** nie przesyła pól określających wielkość nagrody (np. `rewardAmount`, `pointsToAdd`, `isTreeCompleted`).

---

## 🔐 2. Ochrona Zwracanych Danych (Information Disclosure Prevention)

Backend **nigdy nie zwraca danych**, które użytkownik mógłby wykorzystać do obejścia zabezpieczeń lub oszustwa:

| Element | Reguła Bezpieczeństwa |
|---|---|
| **Eko-Quizy (Weryfikacja Uwagi)** | `correctOptionId` pozostaje **wyłącznie na serwerze / w zaszyfrowanym tokenie HMAC**. Do klienta trafia obiekt quizu z losowo przetasowanymi opcjami **bez żadnej flagi poprawności**. |
| **Tokeny Sesji (`sessionToken`)** | Zawierają stan sesji zapieczętowany kryptograficznym podpisem **HMAC-SHA256**. Próba manipulacji czasem trwania lub nagrodą natychmiast unieważnia token. |
| **Prywatne Klucze i Sekrety** | `SUPABASE_SERVICE_ROLE_KEY` oraz `SESSION_SIGNING_SECRET` są dostępne wyłącznie w zmiennych środowiskowych Deno runtime Edge Functions i **nigdy nie trafiają do bundle frontendu**. |
| **Numery wewnętrzne i identyfikatory transakcji partnerów** | Zwracamy wyłącznie publiczne, zweryfikowane numery certyfikatów i dane projektu. |

---

## ⏱️ 3. Zabezpieczenia Przed Nadużyciami (Anti-Cheat & Anti-Fraud)

### A. Anti-Speedhack & Timing Verification
- Każda sesja nagradzana ma predefiniowany czas minimalny (`durationSeconds`).
- Backend w momencie odbioru nagrody (`ad-session-claim`) weryfikuje matematycznie:  
  `Date.now() - payload.startedAt >= (payload.durationSeconds - 1.5s)`
- Próby wysłania żądania natychmiast z konsoli są odrzucane z błędem `400 FraudDetected: Session completed too quickly`.

### B. Blokada Sesji Równoległych (Single Active Session Lock)
- Użytkownik może brać udział w **dokładnie jednej aktywnej sesji naraz**.
- Przy wywołaniu `ad-session-start`, backend zapisuje w profilu znacznik czasowy blokady (`active_session_until = now + durationSeconds`).
- Próba odpalenia wielu kart lub pętli API w tej samej sekundzie zostaje zablokowana z kodem **`429 Too Many Requests (ActiveSessionInProgress)`**.

### C. Ochrona Przed Powtórzeniami (Anti-Replay Attack)
- Każda sesja zawiera unikalny, losowy identyfikator `nonce` (UUIDv4) osadzony w podpisanym tokenie.
- Przed przyznaniem nagrody backend weryfikuje w tabeli `water_drop_transactions`, czy dany `nonce` nie został już wykorzystany.
- Jeden token może zostać zrealizowany **dokładnie raz**.

### D. Limit Dzienny (Daily Rate Limiting)
- Limit 15 reklam dziennie jest sprawdzany i egzekwowany po stronie bazy/Edge Functions na podstawie daty `last_watch_date` oraz licznika `daily_watched_count`.

---

## 🗄️ 4. Baza Danych & Row Level Security (RLS)

Wszystkie tabele bazy danych podlegają **Restrykcyjnemu RLS (Strict Read-Only for Clients)**:

1. **Tabele Wrażliwe (`user_balance`, `water_drop_transactions`, `planted_trees`):**
   - Uprawnienia dla roli `authenticated`: **Wyłącznie `SELECT`** (użytkownik może czytać tylko własne rekordy: `auth.uid() = user_id`).
   - Uprawnienia do `INSERT` i `UPDATE`: **Wyłącznie rola `service_role` (Edge Functions)**.
   - Użytkownik wywołujący bezpośrednie `supabase.from('user_balance').update(...)` z konsoli przeglądarki otrzyma od Postgresa odmowę dostępu `403 Permission Denied`.

2. **Otwarty Rejestr Wpływu (`planted_trees`, `eco_projects`):**
   - Tabele publiczne: `SELECT` dostępny dla wszystkich (transparentność zalesiania).
   - Wstawianie nowych drzew: wyłącznie autoryzowana funkcja `tree-water` po zebraniu 10 kropel.

3. **Profil Użytkownika (`profiles`):**
   - Użytkownik może aktualizować **wyłącznie pola kosmetyczne** (`username`, `full_name`, `avatar_url`).
   - Pola systemowe (`daily_watched_count`, `streak_days`, `active_session_until`) mogą być modyfikowane wyłącznie przez backend.

---

## 📋 5. Checklista dla Nowych Endpointów / Funkcji

Przed wdrożeniem nowej funkcji backendowej upewnij się, że:
- [ ] Funkcja weryfikuje JWT użytkownika (`supabaseUser.auth.getUser()`).
- [ ] Parametry wejściowe są zwalidowane, zsanityzowane i ograniczone do minimum.
- [ ] Wszelkie obliczenia stanu portfela/punktów wykonuje serwer z użyciem `service_role`.
- [ ] Odpowiedź JSON nie ujawnia wewnętrznych kluczy, skrótów ani danych innych użytkowników.
- [ ] Wynik operacji finansowej/kroplowej jest atomowo logowany w tabeli transakcji `water_drop_transactions`.
