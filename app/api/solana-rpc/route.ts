import { getUpstreamRpcEndpoints } from "@/lib/solana";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxyJsonRpc(request: Request) {
  const payload = await request.text();
  if (!payload) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32600, message: "Empty RPC body" } },
      { status: 400 },
    );
  }

  let lastError: unknown;
  for (const endpoint of getUpstreamRpcEndpoints()) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: payload,
        cache: "no-store",
      });
      const text = await response.text();
      if (!response.ok) {
        console.warn(
          `[RPC Fallback] Falha no endpoint: ${endpoint}. Tentando o próximo...`,
          response.status,
        );
        lastError = new Error(`${response.status} ${response.statusText}`);
        continue;
      }
      return new Response(text, {
        status: 200,
        headers: {
          "content-type":
            response.headers.get("content-type") ?? "application/json",
        },
      });
    } catch (err) {
      console.warn(
        `[RPC Fallback] Falha no endpoint: ${endpoint}. Tentando o próximo...`,
        err,
      );
      lastError = err;
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : "All Solana RPC endpoints failed";
  return Response.json(
    {
      jsonrpc: "2.0",
      error: { code: -32000, message },
    },
    { status: 502 },
  );
}

export async function POST(request: Request) {
  return proxyJsonRpc(request);
}
