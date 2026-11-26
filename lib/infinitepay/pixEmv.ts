/** Pix EMV / BR Code validation + extraction for InfinitePay checkout. */

const EMV_FIELD_KEYS = [
  "pixCopyPaste",
  "pix_copy_paste",
  "pix_copia_e_cola",
  "copia_e_cola",
  "copy_paste",
  "brcode",
  "brCode",
  "br_code",
  "emv",
  "emv_code",
  "pix_code",
  "pixCode",
  "qr_code_text",
  "qrCodeText",
  "qrcode_text",
  "code",
] as const;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** True when string looks like a Brazilian Pix EMV (copia-e-cola), not a URL. */
export function isValidPixEmv(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const text = raw.trim();
  if (text.length < 60) return false;
  if (/^https?:\/\//i.test(text)) return false;
  if (!text.startsWith("000201")) return false;
  if (!text.includes("br.gov.bcb.pix")) return false;
  if (text.includes("6304ABCD")) return false;
  if (/MOCK_/i.test(text)) return false;
  return true;
}

function pushCandidate(
  out: { value: string; path: string }[],
  value: unknown,
  path: string,
): void {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (!trimmed) return;
  out.push({ value: trimmed, path });
}

/**
 * Walk a JSON-ish payload and collect string candidates that look like Pix EMV.
 * Returns the first valid EMV and the dotted path used.
 */
export function extractPixEmv(data: unknown): {
  emv: string | null;
  fieldPath: string | null;
} {
  const candidates: { value: string; path: string }[] = [];

  function walk(node: unknown, path: string, depth: number): void {
    if (depth > 8 || node == null) return;
    if (typeof node === "string") {
      pushCandidate(candidates, node, path || "(root)");
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`, depth + 1));
      return;
    }
    const rec = asRecord(node);
    if (!rec) return;

    for (const key of EMV_FIELD_KEYS) {
      if (key in rec) {
        pushCandidate(candidates, rec[key], path ? `${path}.${key}` : key);
      }
    }

    const pix = asRecord(rec.pix);
    if (pix) {
      for (const key of EMV_FIELD_KEYS) {
        if (key in pix) {
          pushCandidate(
            candidates,
            pix[key],
            path ? `${path}.pix.${key}` : `pix.${key}`,
          );
        }
      }
    }

    const dataNode = asRecord(rec.data);
    if (dataNode) walk(dataNode, path ? `${path}.data` : "data", depth + 1);

    for (const [k, v] of Object.entries(rec)) {
      if (
        k === "data" ||
        k === "pix" ||
        (EMV_FIELD_KEYS as readonly string[]).includes(k)
      ) {
        continue;
      }
      if (v && typeof v === "object") {
        walk(v, path ? `${path}.${k}` : k, depth + 1);
      }
    }
  }

  walk(data, "", 0);

  for (const c of candidates) {
    if (isValidPixEmv(c.value)) {
      return { emv: c.value.trim(), fieldPath: c.path };
    }
  }
  return { emv: null, fieldPath: null };
}

/** Parse handle + slug from an InfinitePay checkout URL. */
export function parseCheckoutHandleSlug(
  url: string,
): { handle: string; slug: string } | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const handle = parts[parts.length - 2];
    const slug = parts[parts.length - 1];
    if (!handle || !slug) return null;
    return { handle, slug };
  } catch {
    return null;
  }
}

/** Client-safe pick of Pix EMV from create-link JSON (never a URL). */
export function pickClientPixEmv(
  data: Record<string, unknown>,
): string | null {
  const extracted = extractPixEmv(data);
  if (extracted.emv) return extracted.emv;
  for (const key of [
    "pixCopyPaste",
    "pix_emv",
    "brcode",
    "brCode",
    "pix_code",
  ] as const) {
    const v = data[key];
    if (isValidPixEmv(v)) return v.trim();
  }
  return null;
}
