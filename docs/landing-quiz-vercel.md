# Arquétipo landing + quiz — local & Vercel

The root route `/` is a static marketing landing with an embedded 12-archetype quiz.
It does **not** require env vars, wallets, or payment providers. Presale remains at `/aether`.

## Localhost

```bash
cd c:\Users\Next\aether-project
npm install
npm run typecheck   # tsc --noEmit
npm run lint
npm run build
npm run dev         # http://127.0.0.1:3000/
```

- `npm run dev` binds `127.0.0.1:3000` (avoids preview/Try Live host mismatches).
- Use `npm run dev:lan` only when you need LAN access (`0.0.0.0:3000`).
- Quiz data lives in `src/data/archetypes.ts` (12 archetypes + questions + scoring).
- Framer Motion UI is client-only (`"use client"` + mount gates) to avoid hydration flicker.

Optional env: see `.env.example` (all optional for `/`).

## Vercel deploy

### Dashboard

1. Import the GitHub repo in [Vercel](https://vercel.com/new).
2. Framework: **Next.js** (see `vercel.json`).
3. Root directory: repo root (this `package.json`).
4. Build: `npm run build` · Install: `npm install`.
5. Env: none required for the quiz landing. Add secrets from `.env.example` only if you need `/aether` + order/webhook APIs.
6. Deploy. Open the production URL — `/` should load the quiz landing.

### CLI

```bash
npm i -g vercel   # or use npx
npx vercel        # preview
npx vercel --prod # production
```

Collaborators: push a PR into the target branch, then merge (or use Vercel Preview deployments on the PR). Production deploy after merge if the project is linked to that branch.

## Routes

| Path | Role |
| --- | --- |
| `/` | Landing + interactive quiz |
| `/arquetipos` | Redirect → `/` |
| `/aether` | Aether Vision presale (optional env) |
