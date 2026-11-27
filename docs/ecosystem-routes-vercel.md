# Ecosystem routes & Vercel map

One Next.js host (Vercel project **`aether-project`**) serves three products. Internal slugs, public brands, and routes:

| Slug | Brand | Canonical route | App Router group | Legacy |
| --- | --- | --- | --- | --- |
| `quiz-medieval` | ARCANUM • XII | `/` | `app/(medieval)/` | `/arquetipos` → `/` |
| `testlineqi` | TestLineQi | `/teste-qi` | `app/(teste-qi)/teste-qi/` | — (keep 100% intact) |
| `aether-vision` | Aether Vision | `/aether` | `app/(aether)/aether/` | formerly occupied `/` |

**URL conflict:** intent sometimes wants Aether Vision at `/`. Today `/` is Quiz Medieval (live links + `/arquetipos` → `/`), so Aether stays at `/aether` with route-group isolation. Move Medieval only with an explicit redirect plan.

Code constants: `lib/products.ts` in the repo worktree.

Local defaults: port **3010** (`npm run dev` / `npm start`).  
- Quiz Medieval: `http://localhost:3010/`  
- TestLineQi: `http://localhost:3010/teste-qi`  
- Aether Vision: `http://localhost:3010/aether`

---

## 1. Route / folder / API / asset map

### Quiz Medieval (`quiz-medieval`)

**Pages**

| Path | File | Notes |
| --- | --- | --- |
| `/` | `app/(medieval)/page.tsx` | Canonical ARCANUM landing + quiz (lazy `ArchetypeQuizApp`) |
| `/arquetipos` | `app/(medieval)/arquetipos/page.tsx` | Permanent redirect → `/` |
| (layout) | `app/(medieval)/layout.tsx` | Fonts, OG, favicon, `medieval.css` |
| (legacy layout) | `app/(medieval)/arquetipos/layout.tsx` | Legacy segment layout |

**UI**

- `components/arquetipos/*` — landing, quiz flow, paywall, mentor, medieval audio, share card
- `src/data/archetypes.ts`, `behavioralTags.ts`, `diagnosis.ts`, `paywallTeases.ts`, `quizQuestions.ts`, `scoring.ts`
- `src/utils/archetypeUnlock.ts`, `checkoutRedirect.ts`, `quizSession.ts`, `soundEffects.ts`
- Fonts: Cinzel + Lora (page-level)

**APIs**

| API | Role |
| --- | --- |
| `/api/infinitepay/create-link` | Checkout Integrado link (result / mentor / combo) |
| `/api/infinitepay/verify` | Return verification |
| `/api/infinitepay/webhook` | InfinitePay webhook |
| `/api/mentor` | Gemini/OpenAI mentor chat |
| `/api/pagbank/*` | Legacy PagBank Pix (migrated off; keep for rollback) |

**Libs**

- `lib/infinitepay/*`, `lib/mentor/*`, `lib/pagbank/*`, `lib/custom-answer-analyzer.ts`

**Assets**

- `public/images/hero-dragon.jpg`, `sanctuary-runes.jpg`, `public/images/archetypes/*`, `public/images/hof/*`
- `public/audio/dark-and-darker-lobby.mp3`

---

### TestLineQi (`testlineqi`) — keep payment / IA / logo intact

**Pages**

| Path | File | Notes |
| --- | --- | --- |
| `/teste-qi` | `app/(teste-qi)/teste-qi/page.tsx` | IQ assessment app (lazy `IqTestApp`) |
| (layout) | `app/(teste-qi)/teste-qi/layout.tsx` | Exclusive OG + icons; IBM Plex + Outfit; `teste-qi.css` |

**UI** (`src/components/`)

- `IqTestApp`, `IqLanding`, `IqUnlockCard`, `TestLineQiLogo`, `LivingBrainLogo`
- Results / social: `BellCurveChart`, `LeaderboardPanel`, `ShareResultCard`, `ChallengeSharePanel`, `ProfileDoubtAssistant`, …

**Logic** (`src/lib/`, `src/data/`)

- Scoring / banks: `iqCalculator`, `assessmentBank`, `chcCatalog`, `chcTextBank`, `matrixGenerator`, …
- Unlock client: `iqUnlockClient`, `quizStorage`, `challengeInvite`
- Payment server helpers: `lib/iq-payment/*` (amounts, session unlock registry)

**APIs**

| API | Role |
| --- | --- |
| `/api/payment/pix/create` | Create IQ Pix unlock (result / ai_upsell / combo) |
| `/api/payment/pix/status` | Poll / return / simApprove |
| `/api/payment/pix/webhook` | InfinitePay webhook for IQ |
| `/api/payment/infinitepay/*` | IQ InfinitePay create / verify / status / webhook |
| `/api/iq-session` | Persist / restore quiz snapshot across payment return |
| `/api/iq-profile-assistant` | Gemini/OpenAI profile chat after unlock |

**Assets (do not rename casually)**

- `public/testlineqi-logo.png` (+ `.jpg`), `testlineqi-brain-logo.*`, `testlineqi-brain-icon.*`
- `public/logo-tiktok-perfil.png` (+ `.jpg`)
- Local reset helper: `public/iq-reset-local.html`

**Scripts**

- `npm run test:iq` / `simulate:iq`, `smoke:iq*`, `qa:iq-payment`, `audit:iq`

---

### Aether Vision (`aether-vision`)

**Pages**

| Path | File | Notes |
| --- | --- | --- |
| `/aether` | `app/(aether)/aether/page.tsx` | Presale / hardware landing (lazy `HomePage`) |
| (layout) | `app/(aether)/aether/layout.tsx` + `providers.tsx` | i18n + wallet; `SITE_*` metadata; `aether.css` |

**UI** (root `components/`, excluding `arquetipos/`)

- `HomePage`, `Header`, `Footer`, `HardwareShowcase`, `PresaleCheckout`, `CheckoutReceipt`, `LanguageSelector`, `TrustBadges`, `VisionDeliveryNotice`, `WalletNotice`, …

**i18n**

- `locales/en.ts`, `pt.ts`, `es.ts` — Aether Vision copy
- `lib/i18n.tsx`, `lib/site.ts` (`SITE_NAME` = Aether Vision)

**APIs**

| API | Role |
| --- | --- |
| `/api/orders`, `/api/orders/[id]`, `…/sol-paid`, `…/mock-pay` | Presale orders |
| `/api/webhooks/pix`, `/api/webhooks/solana` | Payment webhooks |
| `/api/sol-price`, `/api/solana-rpc`, `/api/supply/total` | Chain / pricing helpers |

**Libs**

- `lib/orders.ts`, `pix.ts`, `solana.ts`, `fulfill-vision.ts`, `vision-pricing.ts`, `presale.ts`, `secret-keypair.ts`, …

**Assets**

- `public/vision-token.png`, `public/token-metadata/aether-vision.json`, `token-metadata/`
- Shared chrome: `public/logo.png`, `favicon.ico`, `og.jpg`, `mark.svg`

**Related stacks (same monorepo, not Next routes)**

- `client/` + `backend/` — Gemini Live HUD (ports 5173 / 8000)
- `mobile/` — hands-free / OS Bridge native scaffold

---

### Shared host shell

| Path | Role |
| --- | --- |
| `app/layout.tsx` | Minimal root: `metadataBase`, brand-neutral title template |
| `app/globals.css` | Tailwind + shared `@theme` tokens only (no product chrome) |
| `app/og/route.tsx` | Aether Vision OG image (`/og`) |
| `app/sitemap.ts` | Indexes `/` + `/aether` only (`/teste-qi` omitted = noindex) |
| `app/robots.ts` | Robots |
| `app/not-found.tsx` | Neutral 404 with links to all three products |
| `vercel.json` | Next framework; `npm run build` / `npm install` |
| `next.config.ts` | Port notes, Solana wallet transpile, Neon external |
| `.vercel/project.json` | Linked project `aether-project` (`prj_jnsyI45VHy76sNbWy7V9Xy0w7y1z`) |

Production URL fallback in code: `https://aether-project-eight.vercel.app`.

---

## 2. Naming conventions (no breaking renames)

| Concept | Prefer | Avoid changing |
| --- | --- | --- |
| Internal slug | `quiz-medieval`, `testlineqi`, `aether-vision` | Renaming public routes |
| Quiz Medieval brand | ARCANUM • XII in UI | Folder `components/arquetipos` (legacy path name OK) |
| IQ product | TestLineQi brand; route `/teste-qi` | Logo filenames `public/testlineqi-*` |
| Vision product | Aether Vision; route `/aether` | `SITE_*` in `lib/site.ts` |

Minimal safe clarifications already applied in-repo: comments on product ownership + `lib/products.ts`. Routes and TestLineQi payment/IA/logo paths were not moved.

---

## 3. Env vars by product

Source of truth in-repo: `.env.example` (section headers match this table).

### Shared (all products on this Next host)

| Variable | Purpose |
| --- | --- |
| `PORT` | Local listen (3010) |
| `NEXT_PUBLIC_APP_URL` | Public origin for redirects / webhooks |
| `NEXT_PUBLIC_SITE_URL` | Optional OG/sitemap canonical (else `VERCEL_URL` / fallback) |
| `DATABASE_URL` | Neon/Postgres — orders + InfinitePay store + IQ unlock registry |
| `INFINITEPAY_HANDLE` | Shared InfiniteTag (Quiz Medieval + TestLineQi) |
| `INFINITEPAY_API_KEY` | Shared Checkout Integrado API key |
| `INFINITEPAY_SIMULATE` | Local sim only; never Production |
| `GEMINI_API_KEY` | Mentor + IQ profile assistant |
| `GEMINI_MENTOR_MODEL` | Optional model override |
| `OPENAI_API_KEY` | Fallback AI |

### TestLineQi only

| Variable | Purpose |
| --- | --- |
| `IQ_UNLOCK_AMOUNT_CENTAVOS` | Stage-1 result unlock (default 100) |
| `IQ_AI_UPSELL_AMOUNT_CENTAVOS` | Stage-2 AI upsell (default 100) |
| `IQ_QA_BASE` | Optional QA script base URL |

### Quiz Medieval only

| Variable | Purpose |
| --- | --- |
| `PAGBANK_TOKEN` / `PAGSEGURO_TOKEN` | Legacy PagBank |
| `PAGBANK_SANDBOX`, `PAGBANK_API_URL`, `PAGBANK_MOCK`, `PAGBANK_ALLOW_SIMULATE` | PagBank modes |

### Aether Vision only

| Variable | Purpose |
| --- | --- |
| `SOLANA_RPC_URL`, `SOLANA_CLUSTER` | RPC |
| `TOKEN_MINT`, `METADATA_URI` | $VISION mint / metadata |
| `MINT_AUTHORITY_KEYPAIR` / `MINT_AUTHORITY_SECRET`, `DISTRIBUTION_SECRET` | Signing |
| `PHANTOM_OWNER`, `ALLOW_MINT_TO_TARGET`, `EXPECTED_UI_SUPPLY` | Audit / restore |
| `VISION_PRICING`, `RAYDIUM_*`, `SOL_USD` | Pricing |
| `RESTORE_PHANTOM_OK`, `RESTORE_EXECUTE` | Restore gate |
| `PIX_KEY`, `PIX_MERCHANT_NAME`, `PIX_MERCHANT_CITY`, `PIX_BRL_PER_USD` | Vision merchant EMV (≠ IQ InfinitePay) |
| `PIX_WEBHOOK_SECRET`, `PIX_ALLOW_MOCK`, `MOCK_PAY_SECRET` | Vision Pix webhooks / mock |
| `SOLANA_WEBHOOK_SECRET` | Solana webhook auth |
| `SOLANA_RPC_PROXY_ENABLED`, `SOLANA_RPC_PROXY_SECRET` | Optional RPC proxy |
| `NEXT_PUBLIC_SOLANA_RPC_URL` / `NEXT_PUBLIC_SOLANA_RPC` / `NEXT_PUBLIC_SOLANA_RPC_PROXY` | Client RPC (never put paid keys in `NEXT_PUBLIC_*`) |

Platform-injected (do not set as secrets): `VERCEL`, `VERCEL_URL`, `VERCEL_ENV`, `NODE_ENV`.

---

## 4. Vercel project / aliases / env checklist

### Project

| Item | Value |
| --- | --- |
| Vercel project name | `aether-project` |
| Linked id (local `.vercel/project.json`) | `prj_jnsyI45VHy76sNbWy7V9Xy0w7y1z` |
| Framework | Next.js (`vercel.json`) |
| Build / install | `npm run build` / `npm install` |
| Known production host | `aether-project-eight.vercel.app` (code fallback) |

### Suggested aliases (configure in Vercel dashboard)

| Alias intent | Path on same deployment |
| --- | --- |
| Quiz Medieval primary | `/` |
| Quiz Medieval legacy | `/arquetipos` → `/` (app redirect) |
| TestLineQi | `/teste-qi` |
| Aether Vision | `/aether` |

If you later split domains (optional; not required today):

| Domain idea | Should resolve to |
| --- | --- |
| Quiz Medieval domain | `/` (or rewrite `/` only) |
| TestLineQi domain | `/teste-qi` (or rewrite `/` → `/teste-qi`) |
| Aether Vision domain | `/aether` |

Until split: one deployment, three path products. Set `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` to the **canonical public origin** used in payment return URLs.

### Production env checklist (Vercel → Project → Settings → Environment Variables)

Mark sensitive values as **Sensitive**. Prefer Production + Preview where webhooks matter.

**Always (shared)**

- [ ] `NEXT_PUBLIC_APP_URL` = production origin (https, no trailing slash)
- [ ] `NEXT_PUBLIC_SITE_URL` = same (or intentional marketing origin)
- [ ] `INFINITEPAY_HANDLE` and/or `INFINITEPAY_API_KEY` (real; no `COLE_AQUI`)
- [ ] `INFINITEPAY_SIMULATE` **unset** or `0` on Production
- [ ] `GEMINI_API_KEY` (and/or `OPENAI_API_KEY`) if mentor / IQ chat must work
- [ ] `DATABASE_URL` (Neon pooler) for durable orders + unlock registry on serverless

**TestLineQi**

- [ ] `IQ_UNLOCK_AMOUNT_CENTAVOS` (e.g. `100`)
- [ ] `IQ_AI_UPSELL_AMOUNT_CENTAVOS` if stage-2 differs from default
- [ ] InfinitePay webhook points at `{NEXT_PUBLIC_APP_URL}/api/payment/pix/webhook`
- [ ] Confirm `/teste-qi` payment return URL stays on same origin

**Quiz Medieval**

- [ ] InfinitePay webhook for archetype checkout: `{NEXT_PUBLIC_APP_URL}/api/infinitepay/webhook`
- [ ] PagBank vars only if still using legacy `/api/pagbank/*`

**Aether Vision**

- [ ] `SOLANA_RPC_URL`, `TOKEN_MINT`, mint/distribution secrets as needed
- [ ] `PIX_*` + `PIX_WEBHOOK_SECRET` / `SOLANA_WEBHOOK_SECRET` if checkout live
- [ ] Never enable `PIX_ALLOW_MOCK` / mock-pay secrets on Production

**Do not put on Vercel Production**

- `INFINITEPAY_SIMULATE=1`
- `PAGBANK_ALLOW_SIMULATE=true` / `PAGBANK_MOCK=true`
- `PIX_ALLOW_MOCK=true`
- Paid RPC API keys in any `NEXT_PUBLIC_*` var

### `vercel.json` / `next.config.ts`

- `vercel.json`: framework Next; no rewrites/redirects beyond app code (`/arquetipos` redirect lives in Next).
- `next.config.ts`: `allowedDevOrigins`, Solana wallet `transpilePackages`, `@neondatabase/serverless` external; documents port 3010 + multi-product host.

---

## 5. Verification commands

From the IQ worktree (or main checkout with the same tip):

```bash
npm run typecheck    # tsc --noEmit
npm run test:iq      # scripts/simulate-iq-scoring.ts
npm run build        # next build
```

Optional payment QA (local server with `INFINITEPAY_SIMULATE=1`): `npm run qa:iq-payment`.
