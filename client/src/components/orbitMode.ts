/**
 * Persisted HUD orbit visual mode — classic layered vs advanced single-mesh.
 */

export type OrbitVisualMode = "classic" | "advanced-mesh";

export const ORBIT_MODE_STORAGE_KEY = "aether-orbit-mode";

export const ORBIT_VISUAL_MODES: readonly OrbitVisualMode[] = ["classic", "advanced-mesh"];

const DEFAULT_MODE: OrbitVisualMode = "advanced-mesh";

export function isOrbitVisualMode(value: string | null | undefined): value is OrbitVisualMode {
  return value === "classic" || value === "advanced-mesh";
}

export function loadOrbitVisualMode(): OrbitVisualMode {
  try {
    const stored = window.localStorage.getItem(ORBIT_MODE_STORAGE_KEY);
    if (isOrbitVisualMode(stored)) return stored;
  } catch {
    /* private mode / blocked storage */
  }
  return DEFAULT_MODE;
}

export function saveOrbitVisualMode(mode: OrbitVisualMode): void {
  try {
    window.localStorage.setItem(ORBIT_MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore quota / private mode */
  }
}
