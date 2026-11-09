/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LIVE_WS_URL?: string;
  /** Local-dev HUD unlock (default on unless "false") */
  readonly VITE_DEV_UNLOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
