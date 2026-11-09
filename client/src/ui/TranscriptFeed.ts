/**
 * Scrollable Live transcript feed + Markdown export for Gen-1 HUD.
 */

export type TranscriptRole = "user" | "aether" | "system";

export interface TranscriptEntry {
  role: TranscriptRole;
  text: string;
  at: number;
  guardrail?: string;
}

export class TranscriptFeed {
  private readonly entries: TranscriptEntry[] = [];
  private listEl: HTMLElement;
  private exportBtn: HTMLButtonElement;
  private copyBtn: HTMLButtonElement;

  constructor(private readonly root: HTMLElement) {
    this.root.classList.add("transcript-panel");
    this.root.innerHTML = `
      <div class="transcript-head">
        <span class="transcript-title">LIVE TRANSCRIPT</span>
        <div class="transcript-actions">
          <button type="button" class="secondary transcript-btn" data-role="copy-md">Copy .md</button>
          <button type="button" class="secondary transcript-btn" data-role="export-md">Export .md</button>
        </div>
      </div>
      <ul class="transcript-list" data-role="list"></ul>
    `;
    this.listEl = this.root.querySelector("[data-role=list]")!;
    this.copyBtn = this.root.querySelector("[data-role=copy-md]")!;
    this.exportBtn = this.root.querySelector("[data-role=export-md]")!;
    this.copyBtn.addEventListener("click", () => void this.copyMarkdown());
    this.exportBtn.addEventListener("click", () => this.downloadMarkdown());
  }

  clear(): void {
    this.entries.length = 0;
    this.listEl.innerHTML = "";
  }

  push(role: TranscriptRole, text: string, guardrail?: string): void {
    const cleaned = text.trim();
    if (!cleaned) {
      return;
    }
    const entry: TranscriptEntry = {
      role,
      text: cleaned,
      at: Date.now(),
      guardrail,
    };
    this.entries.push(entry);
    // Cap memory for long sessions
    if (this.entries.length > 400) {
      this.entries.splice(0, this.entries.length - 400);
      this.listEl.firstElementChild?.remove();
    }

    const li = document.createElement("li");
    li.dataset.role = role;
    const who =
      role === "user" ? "User" : role === "aether" ? "Aether Copilot" : "System";
    const time = new Date(entry.at).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    li.innerHTML = `<span class="transcript-who">${who}</span><span class="transcript-time">${time}</span><p class="transcript-text"></p>`;
    li.querySelector(".transcript-text")!.textContent = cleaned;
    this.listEl.appendChild(li);
    this.listEl.scrollTop = this.listEl.scrollHeight;
  }

  toMarkdown(): string {
    const lines = [
      "# Aether Vision — Live session transcript",
      "",
      `Exported: ${new Date().toISOString()}`,
      "",
    ];
    for (const e of this.entries) {
      const who =
        e.role === "user" ? "User" : e.role === "aether" ? "Aether Copilot" : "System";
      const stamp = new Date(e.at).toISOString();
      const tag = e.guardrail ? ` _(guardrail: ${e.guardrail})_` : "";
      lines.push(`### ${who} — ${stamp}${tag}`, "", e.text, "");
    }
    if (this.entries.length === 0) {
      lines.push("_No utterances yet._", "");
    }
    return lines.join("\n");
  }

  private async copyMarkdown(): Promise<void> {
    const md = this.toMarkdown();
    try {
      await navigator.clipboard.writeText(md);
      this.flash(this.copyBtn, "Copied");
    } catch {
      this.flash(this.copyBtn, "Fail");
    }
  }

  private downloadMarkdown(): void {
    const md = this.toMarkdown();
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `aether-transcript-${stamp}.md`;
    a.click();
    URL.revokeObjectURL(url);
    this.flash(this.exportBtn, "Saved");
  }

  private flash(btn: HTMLButtonElement, label: string): void {
    const prev = btn.textContent;
    btn.textContent = label;
    window.setTimeout(() => {
      btn.textContent = prev;
    }, 1100);
  }
}
