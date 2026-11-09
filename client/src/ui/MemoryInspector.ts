/**
 * Discrete Gen-1 HUD panel: view / edit / clear learned preferences.
 */

import {
  clearMemoryProfile,
  extractMemoryNow,
  fetchMemoryProfile,
  updateMemoryPreferences,
  type LearnedPreferences,
  type MemoryProfile,
} from "../services/MemoryService";

const TONES = ["direct", "warm", "formal"] as const;
const STYLES = ["concise", "technical", "detailed"] as const;
const LEVELS = ["simple", "balanced", "advanced"] as const;

export type MemoryInspectorHandler = (msg: {
  kind: "ok" | "warn" | "info" | "danger";
  text: string;
}) => void;

export class MemoryInspector {
  private open = false;
  private profile: MemoryProfile | null = null;
  private panel!: HTMLElement;
  private toggleBtn!: HTMLButtonElement;
  private onNotify: MemoryInspectorHandler | null = null;

  constructor(private readonly root: HTMLElement) {
    this.root.classList.add("memory-inspector");
    this.root.innerHTML = `
      <button type="button" class="secondary memory-toggle" data-action="toggle" aria-expanded="false">
        Memory
      </button>
      <div class="memory-panel glass" data-role="panel" hidden>
        <div class="memory-head">
          <h3 class="memory-title">Memory Inspector</h3>
          <p class="memory-lede">Learned prefs for Live replies. Local profile only.</p>
        </div>
        <div class="memory-body" data-role="body">
          <p class="memory-empty">Loading profile…</p>
        </div>
        <div class="memory-actions">
          <button type="button" class="secondary" data-action="refresh" disabled>Refresh</button>
          <button type="button" class="secondary" data-action="extract" disabled>Re-learn</button>
          <button type="button" class="secondary" data-action="save" disabled>Save</button>
          <button type="button" class="secondary memory-danger" data-action="clear-history" disabled>Clear history</button>
          <button type="button" class="secondary memory-danger" data-action="clear-all" disabled>Clear all</button>
        </div>
        <p class="memory-status" data-role="status" hidden></p>
      </div>
    `;

    this.toggleBtn = this.root.querySelector("[data-action=toggle]")!;
    this.panel = this.root.querySelector("[data-role=panel]")!;

    this.toggleBtn.addEventListener("click", () => void this.toggle());
    this.root.querySelector("[data-action=refresh]")?.addEventListener("click", () => void this.reload());
    this.root.querySelector("[data-action=extract]")?.addEventListener("click", () => void this.extract());
    this.root.querySelector("[data-action=save]")?.addEventListener("click", () => void this.save());
    this.root
      .querySelector("[data-action=clear-history]")
      ?.addEventListener("click", () => void this.clear(true));
    this.root.querySelector("[data-action=clear-all]")?.addEventListener("click", () => void this.clear(false));
  }

  setNotify(handler: MemoryInspectorHandler | null): void {
    this.onNotify = handler;
  }

  /** Local unlock: force Memory Inspector open so prefs are visible without a click. */
  async openPanel(forceOpen = true): Promise<void> {
    if (forceOpen && !this.open) {
      this.open = true;
      this.panel.hidden = false;
      this.toggleBtn.setAttribute("aria-expanded", "true");
      this.toggleBtn.textContent = "Memory ▾";
      await this.reload();
      return;
    }
    await this.ensureLoaded();
  }

  async ensureLoaded(): Promise<void> {
    if (!this.profile) {
      await this.reload();
    }
  }

  private setStatus(text: string | null): void {
    const el = this.root.querySelector<HTMLElement>("[data-role=status]");
    if (!el) {
      return;
    }
    if (!text) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = text;
  }

  private setBusy(busy: boolean): void {
    for (const btn of this.root.querySelectorAll<HTMLButtonElement>("button[data-action]")) {
      if (btn.dataset.action === "toggle") {
        continue;
      }
      btn.disabled = !this.open || busy;
    }
  }

  private async toggle(): Promise<void> {
    this.open = !this.open;
    this.panel.hidden = !this.open;
    this.toggleBtn.setAttribute("aria-expanded", this.open ? "true" : "false");
    this.toggleBtn.textContent = this.open ? "Memory ▾" : "Memory";
    if (this.open) {
      await this.reload();
    }
  }

  private async reload(): Promise<void> {
    this.setBusy(true);
    this.setStatus("Loading…");
    try {
      this.profile = await fetchMemoryProfile();
      this.renderBody();
      this.setStatus(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus(`Load failed: ${message}`);
      this.onNotify?.({ kind: "warn", text: `Memory load failed: ${message}` });
    } finally {
      this.setBusy(false);
    }
  }

  private renderBody(): void {
    const body = this.root.querySelector<HTMLElement>("[data-role=body]");
    if (!body || !this.profile) {
      return;
    }
    const p = this.profile.preferences;
    const cmds = (p.frequent_commands || []).join(", ");
    const historyCount = this.profile.history?.length ?? 0;
    const summary = this.profile.preference_summary || "—";

    body.innerHTML = `
      <dl class="memory-meta">
        <div><dt>Profile</dt><dd>${escapeHtml(this.profile.profile_id)}</dd></div>
        <div><dt>History</dt><dd>${historyCount} turns</dd></div>
        <div><dt>Summary</dt><dd class="memory-summary">${escapeHtml(summary || "—")}</dd></div>
      </dl>
      <form class="memory-form" data-role="form">
        <label>
          <span>Tone</span>
          <select name="tone">${options(TONES, p.tone)}</select>
        </label>
        <label>
          <span>Style</span>
          <select name="style">${options(STYLES, p.style)}</select>
        </label>
        <label>
          <span>Technical</span>
          <select name="technical_level">${options(LEVELS, p.technical_level)}</select>
        </label>
        <label>
          <span>Language</span>
          <input name="language" type="text" maxlength="8" placeholder="auto" value="${escapeAttr(p.language || "")}" />
        </label>
        <label class="memory-notes">
          <span>Notes</span>
          <textarea name="notes" rows="2" maxlength="400" placeholder="Optional freeform notes">${escapeHtml(p.notes || "")}</textarea>
        </label>
        <label class="memory-cmds">
          <span>Frequent commands</span>
          <input name="frequent_commands" type="text" maxlength="240" value="${escapeAttr(cmds)}" placeholder="comma-separated" />
        </label>
      </form>
      <details class="memory-history">
        <summary>Recent interactions (${historyCount})</summary>
        <ul>
          ${(this.profile.history || [])
            .slice(-12)
            .reverse()
            .map(
              (h) =>
                `<li><span class="memory-role">${escapeHtml(h.role)}</span> ${escapeHtml(h.text)}</li>`,
            )
            .join("") || "<li class=\"memory-empty\">No history yet.</li>"}
        </ul>
      </details>
    `;
  }

  private readForm(): Partial<LearnedPreferences> | null {
    const form = this.root.querySelector<HTMLFormElement>("[data-role=form]");
    if (!form) {
      return null;
    }
    const fd = new FormData(form);
    const cmdsRaw = String(fd.get("frequent_commands") || "");
    const language = String(fd.get("language") || "").trim();
    return {
      tone: String(fd.get("tone") || "direct"),
      style: String(fd.get("style") || "concise"),
      technical_level: String(fd.get("technical_level") || "balanced"),
      language: language || null,
      notes: String(fd.get("notes") || "").trim(),
      frequent_commands: cmdsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12),
    };
  }

  private async save(): Promise<void> {
    const patch = this.readForm();
    if (!patch) {
      return;
    }
    this.setBusy(true);
    this.setStatus("Saving…");
    try {
      this.profile = await updateMemoryPreferences(patch);
      this.renderBody();
      this.setStatus("Saved.");
      this.onNotify?.({ kind: "ok", text: "Memory preferences saved" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus(`Save failed: ${message}`);
      this.onNotify?.({ kind: "danger", text: `Memory save failed: ${message}` });
    } finally {
      this.setBusy(false);
    }
  }

  private async extract(): Promise<void> {
    this.setBusy(true);
    this.setStatus("Re-learning from history…");
    try {
      this.profile = await extractMemoryNow();
      this.renderBody();
      this.setStatus("Preferences refreshed from history.");
      this.onNotify?.({ kind: "info", text: "Preferences re-learned from history" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus(`Extract failed: ${message}`);
      this.onNotify?.({ kind: "warn", text: `Memory extract failed: ${message}` });
    } finally {
      this.setBusy(false);
    }
  }

  private async clear(historyOnly: boolean): Promise<void> {
    const label = historyOnly ? "Clear interaction history?" : "Clear all memory (prefs + history)?";
    if (!window.confirm(label)) {
      return;
    }
    this.setBusy(true);
    this.setStatus(historyOnly ? "Clearing history…" : "Clearing profile…");
    try {
      this.profile = await clearMemoryProfile({ historyOnly });
      this.renderBody();
      this.setStatus(historyOnly ? "History cleared." : "Profile cleared.");
      this.onNotify?.({
        kind: "ok",
        text: historyOnly ? "Memory history cleared" : "Memory profile cleared",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus(`Clear failed: ${message}`);
      this.onNotify?.({ kind: "danger", text: `Memory clear failed: ${message}` });
    } finally {
      this.setBusy(false);
    }
  }
}

function options(values: readonly string[], selected: string): string {
  return values
    .map((v) => `<option value="${v}"${v === selected ? " selected" : ""}>${v}</option>`)
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
