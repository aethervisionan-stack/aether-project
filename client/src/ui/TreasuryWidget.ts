/**
 * Gen-1 tactical treasury / tokenomics HUD card.
 */

import type { BillingConfig } from "../services/BillingService";
import { formatPrice } from "../services/BillingService";
import {
  fetchSolBalance,
  OFFICIAL_TREASURY_WALLET,
  truncateAddress,
  type TreasuryBalanceResult,
} from "../services/SolanaTreasuryService";

const POLL_MS = 30_000;

export class TreasuryWidget {
  private timer: number | null = null;
  private wallet = OFFICIAL_TREASURY_WALLET;
  private rpc = "https://rpc.ankr.com/solana";
  private cfg: BillingConfig | null = null;
  private inflight = false;
  private copyBtn: HTMLButtonElement | null = null;
  private retryBtn: HTMLButtonElement | null = null;
  private syncEl: HTMLElement | null = null;
  private balEl: HTMLElement | null = null;
  private fiatEl: HTMLElement | null = null;
  private addrEl: HTMLElement | null = null;
  private splitEl: HTMLElement | null = null;

  constructor(private readonly root: HTMLElement) {
    this.root.classList.add("treasury-card");
    this.root.innerHTML = `
      <div class="treasury-head">
        <span class="treasury-title">TREASURY</span>
        <span class="treasury-sync" data-role="sync">Blockchain Sync: —</span>
      </div>
      <div class="treasury-addr-row">
        <code class="treasury-addr" data-role="addr" title="${OFFICIAL_TREASURY_WALLET}">${truncateAddress(OFFICIAL_TREASURY_WALLET)}</code>
        <button type="button" class="treasury-copy" data-role="copy" title="Copy full address">Copy</button>
        <button type="button" class="treasury-copy" data-role="retry" title="Retry Solana balance">Retry</button>
      </div>
      <p class="treasury-bal" data-role="bal">SOL: —</p>
      <p class="treasury-fiat" data-role="fiat">Retained fiat: —</p>
      <p class="treasury-split" data-role="split">Tokenomics: 70% treasury / 30% burn</p>
    `;
    this.syncEl = this.root.querySelector("[data-role=sync]");
    this.balEl = this.root.querySelector("[data-role=bal]");
    this.fiatEl = this.root.querySelector("[data-role=fiat]");
    this.addrEl = this.root.querySelector("[data-role=addr]");
    this.splitEl = this.root.querySelector("[data-role=split]");
    this.copyBtn = this.root.querySelector("[data-role=copy]");
    this.retryBtn = this.root.querySelector("[data-role=retry]");
    this.copyBtn?.addEventListener("click", () => void this.copyAddress());
    this.retryBtn?.addEventListener("click", () => void this.refresh(true));
  }

  applyBillingConfig(cfg: BillingConfig): void {
    this.cfg = cfg;
    this.wallet = OFFICIAL_TREASURY_WALLET;
    this.rpc = (cfg.treasury_rpc_url || cfg.solana_rpc_url || this.rpc).trim();
    if (this.addrEl) {
      this.addrEl.textContent = truncateAddress(this.wallet);
      this.addrEl.setAttribute("title", this.wallet);
    }
    if (this.splitEl) {
      const t = Math.round((cfg.treasury_share ?? 0.7) * 100);
      const b = Math.round((cfg.burn_share ?? 0.3) * 100);
      const mode = cfg.solana_mode === "stub" ? "stub" : cfg.solana_mode;
      this.splitEl.textContent = `Tokenomics: ${t}% treasury / ${b}% burn · ${mode}`;
    }
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

  private async refresh(manual = false): Promise<void> {
    if (this.inflight) {
      return;
    }
    this.inflight = true;
    this.setSync("reconnecting", "Blockchain Sync: Reconnecting…");
    if (this.retryBtn) {
      this.retryBtn.disabled = true;
      this.retryBtn.textContent = manual ? "…" : "Retry";
    }
    try {
      const result = await fetchSolBalance(this.wallet, this.rpc);
      this.renderBalance(result);
    } catch (err) {
      this.renderBalance({
        ok: false,
        online: false,
        reconnecting: true,
        wallet: this.wallet,
        rpc: this.rpc,
        lamports: 0,
        sol: 0,
        error: err instanceof Error ? err.message : String(err),
        fetchedAt: Date.now(),
      });
    } finally {
      this.inflight = false;
      if (this.retryBtn) {
        this.retryBtn.disabled = false;
        this.retryBtn.textContent = "Retry";
      }
    }
  }

  private setSync(state: "online" | "offline" | "reconnecting", label: string): void {
    if (!this.syncEl) {
      return;
    }
    this.syncEl.dataset.state = state;
    this.syncEl.textContent = label;
  }

  private renderBalance(result: TreasuryBalanceResult): void {
    if (result.ok && result.online) {
      this.setSync("online", "Blockchain Sync: Online");
    } else if (result.reconnecting || !result.online) {
      this.setSync("reconnecting", "Blockchain Sync: Reconnecting…");
    } else {
      this.setSync("offline", "Blockchain Sync: Offline");
    }

    if (this.balEl) {
      if (result.ok && result.sol != null) {
        this.balEl.textContent = `SOL: ${result.sol.toLocaleString(undefined, {
          minimumFractionDigits: 4,
          maximumFractionDigits: 6,
        })}`;
        this.balEl.title = result.rpc ? `via ${result.rpc}` : "";
      } else {
        const sol = result.sol != null && Number.isFinite(result.sol) ? result.sol : 0;
        this.balEl.textContent = `SOL: ${sol.toFixed(2)}`;
        this.balEl.title = result.error
          ? `${result.error} — tap Retry`
          : "Balance unavailable — tap Retry";
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
    this.fiatEl.textContent =
      `Retained fiat (plan/stub): ${retained} of ${price}/mo · live ledger TBD`;
  }

  private async copyAddress(): Promise<void> {
    const value = OFFICIAL_TREASURY_WALLET;
    try {
      await navigator.clipboard.writeText(value);
      if (this.copyBtn) {
        const prev = this.copyBtn.textContent;
        this.copyBtn.textContent = "Copied";
        window.setTimeout(() => {
          if (this.copyBtn) {
            this.copyBtn.textContent = prev || "Copy";
          }
        }, 1200);
      }
    } catch {
      if (this.copyBtn) {
        this.copyBtn.textContent = "Fail";
      }
    }
  }
}
