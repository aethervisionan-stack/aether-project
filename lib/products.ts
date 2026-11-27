/**
 * Multi-product host map for this Next.js app.
 *
 * Three products share one Vercel project (`aether-project`) and one repo.
 * Public route paths are stable — do not rename without redirects.
 *
 * Slugs (internal ids) vs public brands vs routes:
 * - `quiz-medieval` → brand ARCANUM • XII → `/` (legacy `/arquetipos` → `/`)
 * - `testlineqi`    → brand TestLineQi    → `/teste-qi` (keep 100% intact)
 * - `aether-vision` → brand Aether Vision → `/aether`
 */

export const PRODUCT_IDS = {
  quizMedieval: "quiz-medieval",
  testlineqi: "testlineqi",
  aetherVision: "aether-vision",
} as const;

export type ProductId = (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS];

export const PRODUCT_ROUTES = {
  /** Quiz Medieval (ARCANUM • XII) — canonical landing */
  quizMedieval: "/",
  /** Legacy Quiz Medieval path — redirects to `/` */
  quizMedievalLegacy: "/arquetipos",
  /** TestLineQi IQ assessment */
  testlineqi: "/teste-qi",
  /** Aether Vision hardware / $VISION presale */
  aetherVision: "/aether",
} as const;

export const PRODUCT_BRANDS = {
  quizMedieval: "ARCANUM • XII",
  testlineqi: "TestLineQi",
  aetherVision: "Aether Vision",
} as const;

/** Folder / package conventions (code ownership, not URL paths). */
export const PRODUCT_CODE_ROOTS = {
  quizMedieval: [
    "app/page.tsx",
    "app/arquetipos/",
    "components/arquetipos/",
    "lib/infinitepay/",
    "lib/mentor/",
    "lib/pagbank/",
    "src/data/{archetypes,behavioralTags,diagnosis,paywallTeases,quizQuestions,scoring}.ts",
    "src/utils/{archetypeUnlock,checkoutRedirect,quizSession,soundEffects}.ts",
    "public/images/",
    "public/audio/",
  ],
  testlineqi: [
    "app/teste-qi/",
    "src/components/",
    "src/lib/",
    "src/data/{assessmentBank,chc*,textQuestions}.ts",
    "lib/iq-payment/",
    "public/testlineqi-*",
    "public/logo-tiktok-perfil.*",
  ],
  aetherVision: [
    "app/aether/",
    "components/{HomePage,Header,Footer,HardwareShowcase,PresaleCheckout,...}.tsx",
    "lib/{site,orders,pix,solana,fulfill-vision,vision-pricing,...}.ts",
    "locales/",
    "public/vision-token.png",
    "public/token-metadata/",
    "client/",
    "backend/",
    "mobile/",
  ],
} as const;
