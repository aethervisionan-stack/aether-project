import {
  extractPixEmv,
  parseCheckoutHandleSlug,
} from "@/lib/infinitepay/pixEmv";

const INVOICE_API =
  "https://infinitepay-invoice-api.services.production.infinitepay.io";

export type PixEmvResolve = {
  emv: string | null;
  /** Dotted path / source label for reporting (e.g. `pix.code`, `pagbank.qr_codes.text`). */
  fieldsUsed: string[];
};

/** Try InfinitePay link JSON + undocumented invoice `/public/pix` for EMV. */
export async function resolveInfinitePayPixEmv(
  linkResponse: Record<string, unknown>,
  checkoutUrl: string,
): Promise<PixEmvResolve> {
  const fieldsUsed: string[] = [];
  const fromLink = extractPixEmv(linkResponse);
  if (fromLink.emv && fromLink.fieldPath) {
    fieldsUsed.push(`links.${fromLink.fieldPath}`);
    return { emv: fromLink.emv, fieldsUsed };
  }

  const parsed = parseCheckoutHandleSlug(checkoutUrl);
  if (!parsed) return { emv: null, fieldsUsed };

  try {
    const checkRes = await fetch(`${INVOICE_API}/public/checkout/links/check`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Source": "external_checkout",
      },
      body: JSON.stringify({
        url: checkoutUrl,
        referrer: "https://aether-project-eight.vercel.app",
      }),
      cache: "no-store",
    });
    const checkJson = (await checkRes.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const fromCheck = extractPixEmv(checkJson);
    if (fromCheck.emv && fromCheck.fieldPath) {
      fieldsUsed.push(`invoice.links/check.${fromCheck.fieldPath}`);
      return { emv: fromCheck.emv, fieldsUsed };
    }
  } catch {
    // continue
  }

  // Checkout SPA uses POST /public/pix after an invoice exists; link slug alone
  // usually 404s, but we still try in case InfinitePay starts attaching Pix early.
  try {
    const pixRes = await fetch(`${INVOICE_API}/public/pix`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Source": "external_checkout",
      },
      body: JSON.stringify({
        slug: parsed.slug,
        user: { handle: parsed.handle },
        metadata: {
          origin: "external_checkout",
          invoice: {
            type: "external_checkout",
            slug: parsed.slug,
            source: "api",
          },
        },
      }),
      cache: "no-store",
    });
    const pixJson = (await pixRes.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const fromPix = extractPixEmv(pixJson);
    if (fromPix.emv && fromPix.fieldPath) {
      fieldsUsed.push(`invoice.public/pix.${fromPix.fieldPath}`);
      return { emv: fromPix.emv, fieldsUsed };
    }
  } catch {
    // continue
  }

  return { emv: null, fieldsUsed };
}
