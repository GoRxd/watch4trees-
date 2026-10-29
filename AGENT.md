# 🤖 AGENT.md – Developer & AI Engineering Standards for Watch4Trees

This document outlines the non-negotiable architectural, technical, and code quality standards for any AI agent or software engineer contributing to the **Watch4Trees** repository.  
**Review and adhere to these guidelines prior to creating or modifying any codebase files.**

---

## 1. 🚫 STRICT CONTROL FLOW BAN (Angular 19 Control Flow Only)

- **ABSOLUTE BAN** on legacy micro-syntax directives: `*ngIf`, `*ngFor`, `*ngSwitch`.
- **Requirement:** Exclusively use modern, native Angular Control Flow:
  - `@if (condition) { ... } @else if (...) { ... } @else { ... }`
  - `@if (observable$ | async; as data) { ... }` or `@if (signal(); as val) { ... }`
  - `@for (item of items; track item.id) { ... } @empty { ... }` (always provide a unique `track` key)

---

## 2. 📁 COMPONENT STRUCTURE & FILE ISOLATION (Dedicated Directory per Component)

- **Dedicated Directory per Component:** Every component (in `src/app/pages/` as well as `src/app/components/`) **must** reside in its own dedicated subfolder matching the component name (e.g. `src/app/components/brand-logo/`, `src/app/pages/dashboard/`).
- **Required 3-File Separation:**
  1. `[name].component.ts` – class declaration, `@Component({ standalone: true, templateUrl: './[name].component.html', styleUrls: ['./[name].component.scss'] })`, dependency injection, and clean state logic.
  2. `[name].component.html` – semantic HTML template using Angular Control Flow and i18n pipes.
  3. `[name].component.scss` – component-scoped SCSS stylesheet.
  4. `[name].component.spec.ts` – unit test suite.
- **STRICT PROHIBITIONS:**
  - Never place loose component files in the parent directory without their own folder.
  - Never inline templates (`template: '...'`) or styles (`styles: [...]`) inside `.ts` files.

---

## 3. ⚡ PERFORMANCE & LAZY LOADING (@defer & loadComponent)

- **Routing:** All route endpoints in `app.routes.ts` **must** use dynamic lazy loading: `loadComponent: () => import(...)`. Eager page imports are prohibited.
- **HTML Templates (@defer):**
  - Use `@defer (on viewport)` for heavy computation widgets, dynamic charts, certificate visualizers, etc.
  - **PROHIBITION:** Do not wrap pure static text content or landing page headers in `@defer` with empty height placeholders to prevent Cumulative Layout Shift (CLS) and scroll calculation jitter.
- **Anti-Lag & 60/120 FPS Motion Standards:**
  - **NO** `background-attachment: fixed` on elements with CSS gradients (forces full-viewport repaint on scroll).
  - **NO** large CSS blur filters (`filter: blur(50px+)`) inside continuous animation loops. Use pure radial gradients (`radial-gradient(...)`) for lighting glows.
  - Animate **strictly** GPU-accelerated properties (`transform`, `opacity`).
  - Use `transform: translateZ(0)` or `will-change: transform` on floating/animated elements, alongside `contain: content` or `contain: paint` on layout containers.

---

## 4. 🎯 DRY PRINCIPLE (CSS Styles, Methods, and Constants)

### A. CSS / SCSS Styles
- **Do not redefine global styles locally:**
  - Page layouts: use the global `.page-wrapper` rather than creating local `min-height: 100vh; padding-bottom: 4rem;`.
  - Navigation bars: use `.top-bar-left`, `.top-bar-right`, `.top-bar-center`, and `.app-top-bar`.
  - Glassmorphism panels: use `.glass-panel` and `.glass-panel-glow`.
  - Buttons & badges: use `.btn-eco-primary`, `.btn-eco-secondary`, `.badge-eco`, `.badge-verified`, `.badge-danger`, `.badge-web3`.
  - Micro-animations: use `.animate-pulse-glow` and `.animate-float` from `src/styles.scss`.
- **HTML Granularity:** Do not unnecessarily split purely static, declarative HTML into micro-components unless reusable across multiple features.

### B. TypeScript Constants & Methods
- **Single Source of Truth for Constants:** All `localStorage` keys and domain metrics (CO2 coefficients, daily limits) **must** reside in `src/app/constants/index.ts` (e.g. `STORAGE_KEYS`, `ECO_METRICS`). **Never** hardcode string keys like `'w4t_user'`, `'w4t_lang'`, or arbitrary numbers in components/services.
- **Service Logic:** Avoid duplicate workflows (e.g. state write + route navigation) across multiple methods; extract dedicated private helper routines.

---

## 5. 📱 RESPONSIVE UI DESIGN (Mobile & Desktop)

- **Mandatory Mobile & Desktop Parity:** Every newly created or modified component **must** be 100% responsive across mobile viewports (320px–768px), tablets, and desktops (1024px–2560px).
- **No Rigid Widths:** Never use rigid `width: 500px+` without `max-width: 100%` – the layout must never trigger horizontal scroll jank.
- **RWD Standards:**
  - CSS Flexbox & Grids must stack gracefully on small screens (`flex-direction: column`, `grid-template-columns: 1fr` inside mobile media queries).
  - Navigation bars and HUDs must provide compact variants (`mode="compact"`) or responsive font/icon scaling.
  - Interactive elements on mobile touchscreens must meet the minimum touch target area of 44x44px.

---

## 6. 🌐 INTERNATIONALIZATION (JSON-based i18n)

- **Strict Text Separation:** No user-facing text (titles, labels, buttons, error messages) may be hardcoded into HTML templates or TypeScript source code.
- All localization strings must be registered in the dictionary files:
  - `public/i18n/pl.json`
  - `public/i18n/en.json`
- In templates, use the translation pipe: `{{ 'section.key' | translate }}`.

---

## 7. 🏷️ MOCKING & PLACEHOLDER CONVENTION (TODO_TEMPLATE)

All views, sections, components, and datasets that serve as placeholders awaiting backend API integration **must** be tagged:

```html
<!-- [TODO_TEMPLATE: Description of planned backend integration] -->
```

or in TypeScript:

```typescript
// [TODO_TEMPLATE: Description of state/logic to be replaced with live API service]
```

---

## 8. 🛡️ BUSINESS LOGIC & PURPOSE-FIRST ALIGNMENT

- **Purpose-First:** No deceptive click incentives (*Watch-to-Plant*, not *Click-to-Earn*).
- **Supported Ad Formats:** Rewarded Video spots and verified corporate ESG partner campaigns.
- **Conversion Ratio:** 10 Water Drops = 1 verified physical tree planted.
- **Anti-Fraud Mechanics:** Mandatory post-video eco-knowledge quiz before token credit, capped at 15 rewarded views per day.

---

## 9. 🚫 PROHIBITION OF UNATTENDED BROWSER AUTOMATION

- **STRICT PROHIBITION** against unauthorized execution of interactive browser automation or headless browser tools unless explicitly requested by the user.

---

## 10. ✅ MANDATORY VERIFICATION GATES

Following any changes, verify:

1. The application builds cleanly with zero compile errors (`ng build`).
2. All unit tests execute and pass (`ng test --watch=false`).
