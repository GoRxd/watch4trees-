# 🤖 AGENT.md – Zasady i Standardy Developerskie Projektu Watch4Trees

Ten dokument definiuje nienegocjowalne reguły techniczne, architektoniczne i jakościowe dla każdego agenta AI oraz programisty pracującego w repozytorium **Watch4Trees**.  
**Przed dokonaniem jakiejkolwiek zmiany lub utworzeniem nowego kodu przeczytaj poniższe zasady i bezwzględnie ich przestrzegaj.**

---

## 1. 🚫 ZAKAZ STARYCH DYREKTYW (Angular 19 Control Flow)

- **BEZWZGLĘDNY ZAKAZ** używania dyrektyw mikro-składniowych `*ngIf`, `*ngFor`, `*ngSwitch`.
- **Wymóg:** Korzystaj **wyłącznie** z natywnego Angular Control Flow:
  - `@if (condition) { ... } @else if (...) { ... } @else { ... }`
  - `@if (observable$ | async; as data) { ... }` lub `@if (signal(); as val) { ... }`
  - `@for (item of items; track item.id) { ... } @empty { ... }` (zawsze z unikalnym `track`)

---

## 2. 📁 STRUKTURA I FOLDERY KOMPONENTÓW (Dedykowany folder i podział na .ts, .html, .scss)

- **Dedykowany folder na każdy komponent:** Każdy komponent w projekcie (zarówno w `src/app/pages/`, jak i w `src/app/components/`) **musi** posiadać swój własny podfolder o nazwie komponentu (np. `src/app/components/brand-logo/`, `src/app/pages/dashboard/`).
- **Obowiązkowy podział na 3 pliki wewnątrz folderu:**
  1. `[nazwa].component.ts` – deklaracja klasy, `@Component({ standalone: true, templateUrl: './[nazwa].component.html', styleUrls: ['./[nazwa].component.scss'] })`, wstrzykiwanie zależności i czysta logika.
  2. `[nazwa].component.html` – semantyczny szablon HTML z Control Flow i pipe'ami i18n.
  3. `[nazwa].component.scss` – dedykowany arkusz styli SCSS komponentu.
  4. `[nazwa].component.spec.ts` – testy jednostkowe (jeśli dotyczy).
- **BEZWZGLĘDNY ZAKAZ:** 
  - Zakaz trzymania plików komponentów luzem w katalogu nadrzędnym `components/` bez dedykowanego podfolderu.
  - Zakaz upychania szablonów w `template: \`...\`` oraz styli w `styles: [\`...\`]` wewnątrz plików `.ts`.

---

## 3. ⚡ WYDAJNOŚĆ I LAZY LOADING (@defer & loadComponent)

- **Routing:** Wszystkie trasy podstron w `app.routes.ts` **muszą** używać dynamicznego `loadComponent: () => import(...)`. Zakaz statycznych, chciwych (_eager_) importów komponentów stron.
- **Szablony HTML (@defer):**
  - Stosuj `@defer (on viewport)` dla ciężkich komponentów logicznych, wykresów, galerii certyfikatów itp.
  - **ZAKAZ** opakowywania w `@defer` z pustym `height: 0` placeholderem czysto statycznych bloków tekstowych strony głównej, aby uniknąć Cumulative Layout Shift (CLS) i błędów w kalkulacji wysokości przy przewijaniu.
- **Zasady Anti-Lag (60/120 FPS):**
  - **ZAKAZ** `background-attachment: fixed` na elementach z gradientami (wymusza pełne przerysowanie klatek przy scrollowaniu).
  - **ZAKAZ** wielkich filtrów `filter: blur(50px+)` w animacjach pętli. Do poświat (_glow_) używaj czystych `radial-gradient(...)`.
  - Animuj **wyłącznie** właściwości akcelerowane przez GPU (`transform`, `opacity`).
  - Stosuj `transform: translateZ(0)` lub `will-change: transform` na elementach pływających/animowanych oraz `contain: content` lub `contain: paint` na kontenerach sekcji.

---

## 4. 🎯 ZASADA DRY (Style CSS, Metody i Stałe)

### A. Style CSS / SCSS

- **Zakaz redefiniowania styli globalnych w lokalnych plikach `.scss` lub `styles: [...]`:**
  - Układy stron: korzystaj z globalnego `.page-wrapper` zamiast tworzyć lokalne `min-height: 100vh; padding-bottom: 4rem;`.
  - Paski nawigacji: korzystaj z `.top-bar-left`, `.top-bar-right`, `.top-bar-center` i `.app-top-bar`.
  - Karty Glassmorphism: korzystaj z `.glass-panel` oraz `.glass-panel-glow`.
  - Przyciski i pigułki/badże: korzystaj z `.btn-eco-primary`, `.btn-eco-secondary`, `.badge-eco`, `.badge-verified`, `.badge-danger`, `.badge-web3`.
  - Animacje: korzystaj z `.animate-pulse-glow` i `.animate-float` ze `src/styles.scss`.
- **Uwaga dotycząca HTML:** Nie dziel na siłę statycznego, deklaratywnego kodu HTML na dziesiątki mikrokomponentów, jeśli nie wnosi to wartości architektonicznej (np. jeśli nie jest reusowany w różnych plikach).

### B. Metody i Stałe w TypeScript

- **Centralne źródło prawdy dla stałych:** Wszystkie klucze `localStorage`, stałe biznesowe (np. przelicznik CO2, domyślne limity) **muszą** znajdować się w `src/app/constants/index.ts` (np. `STORAGE_KEYS`, `ECO_METRICS`). **ZAKAZ** hardcodowania `'w4t_user'`, `'w4t_lang'` czy liczby `22` bezpośrednio w komponentach/serwisach.
- **Logika serwisowa:** Nie powielaj sekwencji operacji (np. zapis stanu + nawigacja routera) w wielu metodach — wydzielaj prywatne metody pomocnicze (np. `authenticate()`).

---

## 5. 📱 RESPONSYWNOŚĆ UI (Mobile & Desktop)

- **Obowiązkowe wersje Mobile i Desktop:** Każdy nowo tworzony lub modyfikowany komponent oraz widok **musi** być w 100% responsywny i zoptymalizowany pod małe ekrany (smartfony 320px–768px), tablety oraz ekrany desktopowe (1024px–2560px).
- **ZAKAZ sztywnych szerokości:** Zakaz stosowania sztywnych wartości `width: 500px+` bez `max-width: 100%` – interfejs nigdy nie może powodować niepożądanego poziomego paska przewijania (_horizontal scroll jank_).
- **Standardy RWD:**
  - Siatki (Grid/Flex) muszą płynnie zwijać się na małych ekranach (`flex-direction: column`, `grid-template-columns: 1fr` w `@media (max-width: 768px)`).
  - Paski nawigacji i HUD-y muszą posiadać wariant kompaktowy (`mode="compact"`) lub responsywne dostosowanie rozmiaru ikon i typografii.
  - Elementy klikalne na urządzeniach mobilnych muszą posiadać wygodny obszar dotykowy (_touch target_ min. 44x44px).

---

## 6. 🌐 WIELOJĘZYCZNOŚĆ (JSON-based i18n)

- **Czysta separacja tekstów:** Żadne widoczne dla użytkownika teksty (nagłówki, etykiety, przyciski, komunikaty błędów) **nie mogą** być wpisane na sztywno w szablonie ani w kodzie TypeScript.
- Wszystkie klucze muszą być zdefiniowane w plikach słowników:
  - `public/i18n/pl.json`
  - `public/i18n/en.json`
- W szablonach używaj pipe'a: `{{ 'sekcja.klucz' | translate }}`.

---

## 7. 🏷️ KONWENCJA OZNACZEŃ MOCKÓW (TODO_TEMPLATE)

Wszystkie sekcje, komponenty, widoki i dane, które na obecnym etapie stanowią szablony/mocki i będą w przyszłości podłączane pod docelowe API backendowe, **muszą** być oznaczone tagiem:

```html
<!-- [TODO_TEMPLATE: Opis planowanego podłączenia do API backendowego] -->
```

lub w TypeScript:

```typescript
// [TODO_TEMPLATE: Opis logiki/stanu do zastąpienia prawdziwym serwisem API]
```

---

## 8. 🛡️ ZGODNOŚĆ Z MECHANIKĄ BIZNESOWĄ

- **Purpose-First:** Brak zachęt do klikania w reklamy (_Watch-to-Plant_, nie _Click-to-Earn_).
- **Formaty:** Wyłącznie _Rewarded Video_ oraz spoty marek ESG.
- **Wymiana:** 10 kropel wody = 1 posadzone drzewo.
- **Anti-Fraud:** Eko-quiz po obejrzeniu wideo przed przyznaniem punktów oraz dzienny limit wyświetleń (15).

---

## 9. 🚫 ZAKAZ SAMOWOLNEGO OTWIERANIA PRZEGLĄDARKI (Browser Agent)

- **BEZWZGLĘDNY ZAKAZ** samowolnego uruchamiania przeglądarki Chrome, narzędzi `browser_subagent` czy automatycznego testowania w oknie przeglądarki.
- Agent **NIE MOŻE** sam z siebie otwierać przeglądarki do weryfikacji zmian.
- **Wyjątek:** Użycie przeglądarki jest dozwolone **WYŁĄCZNIE wtedy, gdy użytkownik wprost i bezpośrednio o to poprosi** w swoim poleceniu.

---

## 10. ✅ KROK OBOWIĄZKOWY PO KAŻDEJ ZMIANIE

Po wykonaniu jakichkolwiek modyfikacji agent **musi** upewnić się, że:

1. Projekt kompiluje się bez błędów (`ng build`).
2. Wszystkie testy jednostkowe przechodzą pomyślnie (`ng test --watch=false`).
