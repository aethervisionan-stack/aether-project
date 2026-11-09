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
  private rpc = "https://api.mainnet-beta.solana.com";
  private cfg: BillingConfig | null = null;
  private copyBtn: HTMLButtonElement | null = null;
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
    this.copyBtn?.addEventListener("click", () => void this.copyAddress());
  }

  applyBillingConfig(cfg: BillingConfig): void {
    this.cfg = cfg;
    this.wallet = (cfg.treasury_wallet || OFFICIAL_TREASURY_WALLET).trim();
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

  private async refresh(): Promise<void> {
    const result = await fetchSolBalance(this.wallet, this.rpc);
    this.renderBalance(result);
  }

  private renderBalance(result: TreasuryBalanceResult): void {
    if (this.syncEl) {
      this.syncEl.textContent = result.online
        ? "Blockchain Sync: Online"
        : "Blockchain Sync: Offline";
      this.syncEl.dataset.state = result.online ? "online" : "offline";
    }
    if (this.balEl) {
      if (result.ok && result.sol != null) {
        this.balEl.textContent = `SOL: ${result.sol.toLocaleString(undefined, {
          minimumFractionDigits: 4,
          maximumFractionDigits: 6,
        })}`;
      } else {
        this.balEl.textContent = `SOL: —${result.error ? ` (${result.error})` : ""}`;
      }
    }
  }

  private renderFiatStub(): void {
    if (!this.fiatEl || !this.cfg) {
      return;
    }
    // Gen-1: no ledger yet — show planned retention from current TEMP/official price.
    const price = formatPrice(this.cfg.unit_amount_cents, this.cfg.currency);
    const retained = formatPrice(
      Math.round(this.cfg.unit_amount_cents * (this.cfg.treasury_share ?? 0.7)),
      this.cfg.currency,
    );
    this.fiatEl.textContent =
      `Retained fiat (plan/stub): ${retained} of ${price}/mo · live ledger TBD`;
  }

  private async copyAddress(): Promise<void> {
    const value = this.wallet || OFFICIAL_TREASURY_WALLET;
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
