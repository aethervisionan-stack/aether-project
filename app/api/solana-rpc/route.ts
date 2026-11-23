import { timingSafeEqual } from "node:crypto";
import { getUpstreamRpcEndpoints } from "@/lib/solana";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Optional authenticated RPC proxy. Disabled by default so hosted builds
 * cannot be used as an open paid-RPC burn. Prefer direct public RPC on the client.
 */
async function proxyJsonRpc(request: Request) {
  if (process.env.SOLANA_RPC_PROXY_ENABLED !== "true") {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "rpc_proxy_disabled" } },
      { status: 403 },
    );
  }

  const secret = process.env.SOLANA_RPC_PROXY_SECRET?.trim();
  if (!secret) {
    return Response.json(
      {
        jsonrpc: "2.0",
        error: { code: -32001, message: "rpc_proxy_secret_required" },
      },
      { status: 503 },
    );
  }

  const header =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-rpc-proxy-secret") ??
    "";
  if (!header || !safeEqual(header, secret)) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "unauthorized" } },
      { status: 401 },
    );
  }

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
    lastError instanceof Error
      ? lastError.message
      : "All Solana RPC endpoints failed";
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
