/**
 * HUD Canvas panel — Deep Research topic + Markdown editor + AI semantic diffs.
 */

import { runDeepResearch } from "../agent/deepResearch";
import { msg, t } from "../i18n";
import {
  applyCanvasDiff,
  createCanvasDoc,
  getCanvasDoc,
  listCanvasDocs,
  proposeCanvasDiff,
  saveCanvasDoc,
  type CanvasDiff,
  type CanvasDocument,
} from "../services/CanvasService";

export type CanvasNotify = (kind: "ok" | "warn" | "info" | "danger", text: string) => void;

type CanvasMsgs = {
  toggle: string;
  toggleOpen: string;
  title: string;
  lede: string;
  topicPh: string;
  research: string;
  researching: string;
  researchDone: string;
  researchFail: string;
  editorPh: string;
  save: string;
  saving: string;
  saved: string;
  saveFail: string;
  instructionPh: string;
  propose: string;
  proposing: string;
  proposed: string;
  proposeFail: string;
  accept: string;
  reject: string;
  accepted: string;
  rejected: string;
  applyFail: string;
  pending: string;
  noPending: string;
  empty: string;
  revision: string;
  newDoc: string;
  refresh: string;
};

const FALLBACK: CanvasMsgs = {
  toggle: "Canvas",
  toggleOpen: "Canvas ▾",
  title: "Canvas",
  lede: "Deep Research reports and collaborative Markdown edits.",
  topicPh: "Research topic…",
  research: "Deep Research",
  researching: "Researching…",
  researchDone: "Research ready — opened in Canvas.",
  researchFail: "Research failed: {message}",
  editorPh: "Markdown document…",
  save: "Save",
  saving: "Saving…",
  saved: "Saved revision {revision}.",
  saveFail: "Save failed: {message}",
  instructionPh: "AI edit instruction…",
  propose: "Propose edit",
  proposing: "Proposing…",
  proposed: "Diff queued — accept or reject.",
  proposeFail: "Propose failed: {message}",
  accept: "Accept",
  reject: "Reject",
  accepted: "Diff accepted.",
  rejected: "Diff rejected.",
  applyFail: "Apply failed: {message}",
  pending: "Pending diffs",
  noPending: "No pending AI diffs.",
  empty: "No document yet — run Deep Research or create one.",
  revision: "rev {revision}",
  newDoc: "New",
  refresh: "Refresh",
};

function canvasMsg(): CanvasMsgs {
  const bag = msg() as unknown as { canvas?: Partial<CanvasMsgs> };
  return { ...FALLBACK, ...(bag.canvas || {}) };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export class CanvasPanel {
  private open = false;
  private doc: CanvasDocument | null = null;
  private panel!: HTMLElement;
  private toggleBtn!: HTMLButtonElement;
  private statusEl!: HTMLElement;
  private editor!: HTMLTextAreaElement;
  private topicInput!: HTMLInputElement;
  private instructionInput!: HTMLInputElement;
  private pendingEl!: HTMLElement;
  private metaEl!: HTMLElement;
  private notify: CanvasNotify | null = null;
  private busy = false;

  constructor(private readonly root: HTMLElement) {
    this.root.classList.add("canvas-panel-host");
    this.renderShell();
    this.bind();
    this.applyLocale();
  }

  setNotify(handler: CanvasNotify | null): void {
    this.notify = handler;
  }

  applyLocale(): void {
    const m = canvasMsg();
    this.toggleBtn.textContent = this.open ? m.toggleOpen : m.toggle;
    const title = this.root.querySelector("[data-i18n=title]");
    const lede = this.root.querySelector("[data-i18n=lede]");
    if (title) title.textContent = m.title;
    if (lede) lede.textContent = m.lede;
    this.topicInput.placeholder = m.topicPh;
    this.editor.placeholder = m.editorPh;
    this.instructionInput.placeholder = m.instructionPh;
    const setBtn = (action: string, label: string) => {
      const btn = this.root.querySelector(`[data-action="${action}"]`);
      if (btn) btn.textContent = label;
    };
    setBtn("research", m.research);
    setBtn("save", m.save);
    setBtn("propose", m.propose);
    setBtn("new", m.newDoc);
    setBtn("refresh", m.refresh);
    this.renderPending();
    this.renderMeta();
  }

  async openPanel(forceOpen = true): Promise<void> {
    if (forceOpen && !this.open) {
      this.open = true;
      this.panel.hidden = false;
      this.toggleBtn.setAttribute("aria-expanded", "true");
      this.toggleBtn.textContent = canvasMsg().toggleOpen;
    }
    await this.ensureDoc();
  }

  private renderShell(): void {
    this.root.innerHTML = `
      <button type="button" class="secondary canvas-toggle" data-action="toggle" aria-expanded="false">
        Canvas
      </button>
      <div class="canvas-panel glass" data-role="panel" hidden>
        <div class="canvas-head">
          <h3 class="canvas-title" data-i18n="title">Canvas</h3>
          <p class="canvas-lede" data-i18n="lede">Deep Research + semantic edits.</p>
        </div>
        <div class="canvas-toolbar">
          <input type="text" class="canvas-topic" data-role="topic" maxlength="500" />
          <button type="button" class="secondary" data-action="research">Deep Research</button>
          <button type="button" class="secondary" data-action="new">New</button>
          <button type="button" class="secondary" data-action="refresh">Refresh</button>
        </div>
        <p class="canvas-meta" data-role="meta"></p>
        <textarea class="canvas-editor" data-role="editor" rows="14" spellcheck="true"></textarea>
        <div class="canvas-ai-row">
          <input type="text" class="canvas-instruction" data-role="instruction" maxlength="2000" />
          <button type="button" class="secondary" data-action="propose">Propose edit</button>
          <button type="button" class="secondary" data-action="save">Save</button>
        </div>
        <div class="canvas-pending" data-role="pending"></div>
        <p class="canvas-status" data-role="status" hidden></p>
      </div>
    `;
    this.toggleBtn = this.root.querySelector("[data-action=toggle]")!;
    this.panel = this.root.querySelector("[data-role=panel]")!;
    this.statusEl = this.root.querySelector("[data-role=status]")!;
    this.editor = this.root.querySelector("[data-role=editor]")!;
    this.topicInput = this.root.querySelector("[data-role=topic]")!;
    this.instructionInput = this.root.querySelector("[data-role=instruction]")!;
    this.pendingEl = this.root.querySelector("[data-role=pending]")!;
    this.metaEl = this.root.querySelector("[data-role=meta]")!;
  }

  private bind(): void {
    this.toggleBtn.addEventListener("click", () => void this.toggle());
    this.root.querySelector("[data-action=research]")?.addEventListener("click", () => void this.runResearch());
    this.root.querySelector("[data-action=save]")?.addEventListener("click", () => void this.save());
    this.root.querySelector("[data-action=propose]")?.addEventListener("click", () => void this.propose());
    this.root.querySelector("[data-action=new]")?.addEventListener("click", () => void this.createNew());
    this.root.querySelector("[data-action=refresh]")?.addEventListener("click", () => void this.reload());
  }

  private async toggle(): Promise<void> {
    this.open = !this.open;
    this.panel.hidden = !this.open;
    this.toggleBtn.setAttribute("aria-expanded", this.open ? "true" : "false");
    this.toggleBtn.textContent = this.open ? canvasMsg().toggleOpen : canvasMsg().toggle;
    if (this.open) {
      await this.ensureDoc();
    }
  }

  private setStatus(text: string | null): void {
    if (!text) {
      this.statusEl.hidden = true;
      this.statusEl.textContent = "";
      return;
    }
    this.statusEl.hidden = false;
    this.statusEl.textContent = text;
  }

  private toast(kind: "ok" | "warn" | "info" | "danger", text: string): void {
    this.notify?.(kind, text);
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.root.querySelectorAll<HTMLButtonElement>("button[data-action]").forEach((btn) => {
      if (btn.dataset.action === "toggle") return;
      btn.disabled = busy;
    });
  }

  private renderMeta(): void {
    const m = canvasMsg();
    if (!this.doc) {
      this.metaEl.textContent = m.empty;
      return;
    }
    this.metaEl.textContent = `${this.doc.title} · ${t(m.revision, { revision: this.doc.revision })}`;
  }

  private renderPending(): void {
    const m = canvasMsg();
    const pending = (this.doc?.pending_diffs || []) as CanvasDiff[];
    if (!pending.length) {
      this.pendingEl.innerHTML = `<p class="canvas-pending-empty">${escapeHtml(m.noPending)}</p>`;
      return;
    }
    this.pendingEl.innerHTML = `
      <div class="canvas-pending-head">${escapeHtml(m.pending)}</div>
      <ul class="canvas-pending-list">
        ${pending
          .map((diff) => {
            const summary = escapeHtml(diff.summary || diff.id);
            const ops = Array.isArray(diff.ops) ? diff.ops.length : 0;
            return `<li data-diff-id="${escapeHtml(diff.id)}">
              <span>${summary} (${ops})</span>
              <button type="button" class="secondary" data-accept="${escapeHtml(diff.id)}">${escapeHtml(m.accept)}</button>
              <button type="button" class="secondary" data-reject="${escapeHtml(diff.id)}">${escapeHtml(m.reject)}</button>
            </li>`;
          })
          .join("")}
      </ul>
    `;
    this.pendingEl.querySelectorAll<HTMLButtonElement>("[data-accept]").forEach((btn) => {
      btn.addEventListener("click", () => void this.apply(btn.dataset.accept || "", true));
    });
    this.pendingEl.querySelectorAll<HTMLButtonElement>("[data-reject]").forEach((btn) => {
      btn.addEventListener("click", () => void this.apply(btn.dataset.reject || "", false));
    });
  }

  private bindDoc(doc: CanvasDocument): void {
    this.doc = doc;
    this.editor.value = doc.markdown || "";
    this.renderMeta();
    this.renderPending();
  }

  private async ensureDoc(): Promise<void> {
    if (this.doc) {
      this.renderMeta();
      this.renderPending();
      return;
    }
    await this.reload();
  }

  private async reload(): Promise<void> {
    const m = canvasMsg();
    try {
      if (this.doc?.id) {
        const fresh = await getCanvasDoc(this.doc.id);
        this.bindDoc(fresh);
        return;
      }
      const docs = await listCanvasDocs();
      if (docs.length) {
        const full = await getCanvasDoc(docs[0].id);
        this.bindDoc(full);
      } else {
        this.doc = null;
        this.editor.value = "";
        this.renderMeta();
        this.renderPending();
        this.setStatus(m.empty);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus(message);
      this.toast("warn", message);
    }
  }

  private async createNew(): Promise<void> {
    if (this.busy) return;
    this.setBusy(true);
    try {
      const doc = await createCanvasDoc({
        title: "Untitled",
        markdown: "# Untitled\n\n",
        kind: "article",
      });
      this.bindDoc(doc);
      this.setStatus(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.toast("danger", message);
    } finally {
      this.setBusy(false);
    }
  }

  private async runResearch(): Promise<void> {
    if (this.busy) return;
    const m = canvasMsg();
    const topic = this.topicInput.value.trim();
    if (!topic) {
      this.toast("warn", m.topicPh);
      return;
    }
    this.setBusy(true);
    this.setStatus(m.researching);
    try {
      const result = await runDeepResearch({
        topic,
        openInCanvas: true,
        canvasDocId: this.doc?.id ?? null,
      });
      if (!result.ok) {
        const text = t(m.researchFail, { message: result.error || "unknown" });
        this.setStatus(text);
        this.toast("danger", text);
        return;
      }
      if (result.canvas) {
        const full = await getCanvasDoc(result.canvas.id);
        this.bindDoc(full);
      } else if (result.report_markdown) {
        this.editor.value = result.report_markdown;
      }
      this.setStatus(m.researchDone);
      this.toast("ok", m.researchDone);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const text = t(m.researchFail, { message });
      this.setStatus(text);
      this.toast("danger", text);
    } finally {
      this.setBusy(false);
    }
  }

  private async save(): Promise<void> {
    if (this.busy) return;
    const m = canvasMsg();
    this.setBusy(true);
    this.setStatus(m.saving);
    try {
      let doc = this.doc;
      if (!doc) {
        doc = await createCanvasDoc({
          title: "Untitled",
          markdown: this.editor.value,
          kind: "article",
        });
      } else {
        doc = await saveCanvasDoc(doc.id, this.editor.value, {
          expectedRevision: doc.revision,
        });
      }
      this.bindDoc(doc);
      const text = t(m.saved, { revision: doc.revision });
      this.setStatus(text);
      this.toast("ok", text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const text = t(m.saveFail, { message });
      this.setStatus(text);
      this.toast("danger", text);
    } finally {
      this.setBusy(false);
    }
  }

  private async propose(): Promise<void> {
    if (this.busy) return;
    const m = canvasMsg();
    const instruction = this.instructionInput.value.trim();
    if (!instruction) {
      this.toast("warn", m.instructionPh);
      return;
    }
    this.setBusy(true);
    this.setStatus(m.proposing);
    try {
      if (!this.doc) {
        const created = await createCanvasDoc({
          title: "Untitled",
          markdown: this.editor.value || "# Untitled\n\n",
        });
        this.bindDoc(created);
      }
      // Persist local edits first so proposals target current buffer.
      if (this.doc && this.editor.value !== this.doc.markdown) {
        const saved = await saveCanvasDoc(this.doc.id, this.editor.value, {
          expectedRevision: this.doc.revision,
        });
        this.bindDoc(saved);
      }
      const { doc } = await proposeCanvasDiff(this.doc!.id, instruction);
      if (doc) {
        this.bindDoc(doc);
      } else {
        await this.reload();
      }
      this.instructionInput.value = "";
      this.setStatus(m.proposed);
      this.toast("ok", m.proposed);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const text = t(m.proposeFail, { message });
      this.setStatus(text);
      this.toast("danger", text);
    } finally {
      this.setBusy(false);
    }
  }

  private async apply(diffId: string, accept: boolean): Promise<void> {
    if (this.busy || !this.doc || !diffId) return;
    const m = canvasMsg();
    this.setBusy(true);
    try {
      const doc = await applyCanvasDiff(this.doc.id, diffId, { accept });
      this.bindDoc(doc);
      const text = accept ? m.accepted : m.rejected;
      this.setStatus(text);
      this.toast(accept ? "ok" : "info", text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const text = t(m.applyFail, { message });
      this.setStatus(text);
      this.toast("danger", text);
    } finally {
      this.setBusy(false);
    }
  }
}
