/**
 * Gen-1 tactical treasury / tokenomics HUD card.
 */

import { msg, t } from "../i18n";
import type { BillingConfig } from "../services/BillingService";
import { formatPrice } from "../services/BillingService";
import {
  fetchSolBalance,
  OFFICIAL_TREASURY_WALLET,
  truncateAddress,
  type TreasuryBalanceResult,
} from "../services/SolanaTreasuryService";

const POLL_MS = 30_000;

export type TreasuryStatusHandler = (payload: {
  ok: boolean;
  online: boolean;
  reconnecting?: boolean;
  error?: string;
  sol?: number | null;
}) => void;

export class TreasuryWidget {
  private timer: number | null = null;
  private wallet = OFFICIAL_TREASURY_WALLET;
  private rpc = "https://rpc.ankr.com/solana";
  private cfg: BillingConfig | null = null;
  private inflight = false;
  private onStatus: TreasuryStatusHandler | null = null;
  private copyBtn: HTMLButtonElement | null = null;
  private retryBtn: HTMLButtonElement | null = null;
  private syncEl: HTMLElement | null = null;
  private balEl: HTMLElement | null = null;
  private fiatEl: HTMLElement | null = null;
  private addrEl: HTMLElement | null = null;
  private splitEl: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private lastBalance: TreasuryBalanceResult | null = null;
  private lastSyncState: "online" | "offline" | "reconnecting" | null = null;

  constructor(private readonly root: HTMLElement) {
    this.root.classList.add("treasury-card");
    const tr = msg().treasury;
    this.root.innerHTML = `
      <div class="treasury-head">
        <span class="treasury-title" data-role="title">${escapeHtml(tr.title)}</span>
        <span class="treasury-sync" data-role="sync">${escapeHtml(tr.syncIdle)}</span>
      </div>
      <div class="treasury-addr-row">
        <code class="treasury-addr" data-role="addr" title="${OFFICIAL_TREASURY_WALLET}">${truncateAddress(OFFICIAL_TREASURY_WALLET)}</code>
        <button type="button" class="treasury-copy" data-role="copy" title="${escapeAttr(tr.copyTitle)}">${escapeHtml(tr.copy)}</button>
        <button type="button" class="treasury-copy" data-role="retry" title="${escapeAttr(tr.retryTitle)}">${escapeHtml(tr.retry)}</button>
      </div>
      <p class="treasury-bal" data-role="bal">${escapeHtml(t(tr.sol, { value: "—" }))}</p>
      <p class="treasury-fiat" data-role="fiat">${escapeHtml(tr.retainedFiat)}</p>
      <p class="treasury-split" data-role="split"></p>
    `;
    this.titleEl = this.root.querySelector("[data-role=title]");
    this.syncEl = this.root.querySelector("[data-role=sync]");
    this.balEl = this.root.querySelector("[data-role=bal]");
    this.fiatEl = this.root.querySelector("[data-role=fiat]");
    this.addrEl = this.root.querySelector("[data-role=addr]");
    this.splitEl = this.root.querySelector("[data-role=split]");
    this.copyBtn = this.root.querySelector("[data-role=copy]");
    this.retryBtn = this.root.querySelector("[data-role=retry]");
    this.copyBtn?.addEventListener("click", () => void this.copyAddress());
    this.retryBtn?.addEventListener("click", () => void this.refresh(true));
    this.renderSplit();
  }

  setStatusHandler(handler: TreasuryStatusHandler | null): void {
    this.onStatus = handler;
  }

  applyLocale(): void {
    const tr = msg().treasury;
    if (this.titleEl) this.titleEl.textContent = tr.title;
    if (this.copyBtn) {
      this.copyBtn.textContent = tr.copy;
      this.copyBtn.title = tr.copyTitle;
    }
    if (this.retryBtn) {
      this.retryBtn.textContent = tr.retry;
      this.retryBtn.title = tr.retryTitle;
    }
    if (this.lastSyncState) {
      this.setSync(this.lastSyncState, syncLabel(this.lastSyncState));
    } else if (this.syncEl) {
      this.syncEl.textContent = tr.syncIdle;
    }
    if (this.lastBalance) {
      this.renderBalance(this.lastBalance);
    }
    this.renderFiatStub();
    this.renderSplit();
  }

  applyBillingConfig(cfg: BillingConfig): void {
    this.cfg = cfg;
    this.wallet = OFFICIAL_TREASURY_WALLET;
    this.rpc = (cfg.treasury_rpc_url || cfg.solana_rpc_url || this.rpc).trim();
    if (this.addrEl) {
      this.addrEl.textContent = truncateAddress(this.wallet);
      this.addrEl.setAttribute("title", this.wallet);
    }
    this.renderSplit();
    this.renderFiatStub();
  }

  start(): void {
    this.stop();
    void this.refresh();
    this.timer = window.setInterval(() => void this.refresh(), POLL_MS);
  }

  stop(): void {
    if (this.timer != null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  dispose(): void {
    this.stop();
  }

  private renderSplit(): void {
    if (!this.splitEl) return;
    const cfg = this.cfg;
    const treasury = Math.round((cfg?.treasury_share ?? 0.7) * 100);
    const burn = Math.round((cfg?.burn_share ?? 0.3) * 100);
    const mode = cfg?.solana_mode === "stub" ? "stub" : cfg?.solana_mode || "stub";
    this.splitEl.textContent = t(msg().treasury.tokenomics, { treasury, burn, mode });
  }

  private async refresh(manual = false): Promise<void> {
    if (this.inflight) {
      return;
    }
    this.inflight = true;
    this.setSync("reconnecting", msg().treasury.syncReconnecting);
    this.balEl?.classList.add("is-loading", "skeleton");
    if (this.retryBtn) {
      this.retryBtn.disabled = true;
      this.retryBtn.textContent = manual ? "…" : msg().treasury.retry;
    }
    try {
      const result = await fetchSolBalance(this.wallet, this.rpc);
      this.renderBalance(result);
      this.onStatus?.({
        ok: result.ok,
        online: result.online,
        reconnecting: result.reconnecting,
        error: result.error,
        sol: result.sol,
      });
    } catch (err) {
      const fail: TreasuryBalanceResult = {
        ok: false,
        online: false,
        reconnecting: true,
        wallet: this.wallet,
        rpc: this.rpc,
        lamports: 0,
        sol: 0,
        error: err instanceof Error ? err.message : String(err),
        fetchedAt: Date.now(),
      };
      this.renderBalance(fail);
      this.onStatus?.({
        ok: false,
        online: false,
        reconnecting: true,
        error: fail.error,
        sol: 0,
      });
    } finally {
      this.balEl?.classList.remove("is-loading", "skeleton");
      this.inflight = false;
      if (this.retryBtn) {
        this.retryBtn.disabled = false;
        this.retryBtn.textContent = msg().treasury.retry;
      }
    }
  }

  private setSync(state: "online" | "offline" | "reconnecting", label: string): void {
    if (!this.syncEl) {
      return;
    }
    this.lastSyncState = state;
    this.syncEl.dataset.state = state;
    this.syncEl.textContent = label;
  }

  private renderBalance(result: TreasuryBalanceResult): void {
    this.lastBalance = result;
    if (result.ok && result.online) {
      this.setSync("online", msg().treasury.syncOnline);
    } else if (result.reconnecting || !result.online) {
      this.setSync("reconnecting", msg().treasury.syncReconnecting);
    } else {
      this.setSync("offline", msg().treasury.syncOffline);
    }

    if (this.balEl) {
      if (result.ok && result.sol != null) {
        const value = result.sol.toLocaleString(undefined, {
          minimumFractionDigits: 4,
          maximumFractionDigits: 6,
        });
        this.balEl.textContent = t(msg().treasury.sol, { value });
        this.balEl.title = result.rpc ? `via ${result.rpc}` : "";
      } else {
        const sol = result.sol != null && Number.isFinite(result.sol) ? result.sol : 0;
        this.balEl.textContent = t(msg().treasury.sol, { value: sol.toFixed(2) });
        this.balEl.title = result.error
          ? `${result.error} — ${msg().treasury.retry}`
          : msg().treasury.balanceUnavailable;
      }
    }
  }

  private renderFiatStub(): void {
    if (!this.fiatEl || !this.cfg) {
      return;
    }
    const price = formatPrice(this.cfg.unit_amount_cents, this.cfg.currency);
    const retained = formatPrice(
      Math.round(this.cfg.unit_amount_cents * (this.cfg.treasury_share ?? 0.7)),
      this.cfg.currency,
    );
    this.fiatEl.textContent = t(msg().treasury.retainedFiatLive, { retained, price });
  }

  private async copyAddress(): Promise<void> {
    const value = OFFICIAL_TREASURY_WALLET;
    const tr = msg().treasury;
    try {
      await navigator.clipboard.writeText(value);
      if (this.copyBtn) {
        this.copyBtn.textContent = tr.copied;
        window.setTimeout(() => {
          if (this.copyBtn) {
            this.copyBtn.textContent = msg().treasury.copy;
          }
        }, 1200);
      }
    } catch {
      if (this.copyBtn) {
        this.copyBtn.textContent = tr.copyFail;
      }
    }
  }
}

function syncLabel(state: "online" | "offline" | "reconnecting"): string {
  const tr = msg().treasury;
  if (state === "online") return tr.syncOnline;
  if (state === "offline") return tr.syncOffline;
  return tr.syncReconnecting;
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
