/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LIVE_WS_URL?: string;
  /** Local-dev HUD unlock (default on unless "false") */
  readonly VITE_DEV_UNLOCK?: string;
  /** Optional R3F VisualCore orbit (`r3f`); default AudioReactiveAIOrbit */
  readonly VITE_VISUAL_CORE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
