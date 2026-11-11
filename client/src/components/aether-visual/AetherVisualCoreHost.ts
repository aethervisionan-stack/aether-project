/**
 * Vanilla TS host for the AetherVisualCore React island.
 * Mounts into `[data-role=ai-orbit]` and maps OrbitDriveState →
 * isSpeaking + audioIntensity (playback analyser energy 0–1).
 */
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { OrbitDriver } from "../AudioReactiveAIOrbit";
import AetherVisualCore, {
  type VisualCoreDrive,
  type VisualCoreDriveRef,
} from "./AetherVisualCore";

export class AetherVisualCoreHost {
  private host: HTMLElement | null = null;
  private root: Root | null = null;
  private raf = 0;
  private running = false;
  private driver: OrbitDriver | null = null;
  private readonly drive: VisualCoreDrive = {
    isSpeaking: false,
    audioIntensity: 0,
  };
  private readonly driveRef: VisualCoreDriveRef = { current: this.drive };

  mount(host: HTMLElement): void {
    this.dispose();
    this.host = host;
    host.classList.add("ai-orbit-stage");
    host.replaceChildren();

    const mountEl = document.createElement("div");
    mountEl.className = "ai-orbit-react-root";
    host.appendChild(mountEl);

    this.root = createRoot(mountEl);
    this.root.render(createElement(AetherVisualCore, { drive: this.driveRef }));
  }

  /** Begin polling OrbitDriver each rAF; writes mutable drive for the R3F island. */
  start(driver: OrbitDriver): void {
    this.driver = driver;
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      this.sample();
      this.raf = window.requestAnimationFrame(tick);
    };
    this.raf = window.requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    if (this.raf) {
      window.cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  dispose(): void {
    this.stop();
    this.driver = null;
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    if (this.host) {
      this.host.replaceChildren();
      this.host = null;
    }
  }

  private sample(): void {
    if (!this.driver) return;
    const snap = this.driver();
    // AI visual reacts to Live/Gemini playback — not mic VAD.
    this.drive.isSpeaking = Boolean(snap.playbackActive);
    const energy = Number(snap.playLevel) || 0;
    this.drive.audioIntensity = Math.min(1, Math.max(0, energy));
  }
}
