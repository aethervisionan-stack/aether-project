/**
 * Probe PagBank Orders Pix EMV with env from `vercel env run`.
 * Never prints the full token.
 */
const token = (process.env.PAGBANK_TOKEN || process.env.PAGSEGURO_TOKEN || "")
  .trim()
  .replace(/^['"]+|['"]+$/g, "")
  .replace(/^Bearer\s+/i, "");
const sandbox =
  ["true", "1", "yes"].includes(
    String(process.env.PAGBANK_SANDBOX || "").trim().toLowerCase(),
  );
const mock = String(process.env.PAGBANK_MOCK || "").trim().toLowerCase();

function mask(t) {
  if (!t) return "(missing)";
  if (t.length < 12) return `len=${t.length}`;
  return `${t.slice(0, 8)}…${t.slice(-4)} len=${t.length}`;
}

const bases = sandbox
  ? ["https://sandbox.api.pagseguro.com"]
  : [
      "https://api.pagseguro.com",
      "https://sandbox.api.pagseguro.com",
    ];

console.log(
  JSON.stringify({
    token: mask(token),
    PAGBANK_SANDBOX: sandbox,
    PAGBANK_MOCK: mock,
    bases,
  }),
);

if (!token) {
  console.error("NO_TOKEN");
  process.exit(2);
}

const taxId = "54931957803";
const amount = 100;
const payload = {
  reference_id: `probe-emv-${Date.now()}`,
  customer: {
    name: "Cliente Arquetipo Probe",
    email: `cliente.probe.${Date.now()}@example.com`,
    tax_id: taxId,
    phones: [
      { country: "55", area: "11", number: "999999999", type: "MOBILE" },
    ],
  },
  items: [
    {
      reference_id: "probe-pix",
      name: "Probe Pix EMV",
      quantity: 1,
      unit_amount: amount,
    },
  ],
  qr_codes: [
    {
      amount: { value: amount },
      expiration_date: new Date(Date.now() + 86400000).toISOString(),
    },
  ],
};

for (const base of bases) {
  const res = await fetch(`${base}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  const text = body?.qr_codes?.[0]?.text || body?.charges?.[0]?.qr_code?.text || null;
  console.log(
    JSON.stringify({
      base,
      status: res.status,
      code: body?.code || body?.error_messages?.[0]?.code || null,
      description:
        body?.description || body?.error_messages?.[0]?.description || null,
      orderId: body?.id || null,
      emvLen: text ? String(text).length : 0,
      emvPrefix: text ? String(text).slice(0, 24) : null,
      hasPixGui: text ? String(text).includes("br.gov.bcb.pix") : false,
    }),
  );
  if (res.ok && text) {
    process.exit(0);
  }
}

process.exit(1);
