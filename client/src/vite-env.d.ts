/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LIVE_WS_URL?: string;
  /** Local-dev HUD unlock (default on unless "false") */
  readonly VITE_DEV_UNLOCK?: string;
  /** Optional Supabase Realtime for HUD sync */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
