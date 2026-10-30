import {
  Connection,
  Keypair,
  SendTransactionError,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 450;

function log(message: string, extra?: Record<string, unknown>) {
  if (extra) {
    console.log(`[spl-send] ${message}`, extra);
    return;
  }
  console.log(`[spl-send] ${message}`);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isBlockhashExpiredError(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /block height exceeded|blockhash not found|has expired|TransactionExpiredBlockheightExceeded|blockhash.*not.*found/i.test(
    `${name} ${message}`,
  );
}

export async function describeSolanaSendError(
  error: unknown,
  connection?: Connection,
): Promise<{
  kind: string;
  name: string;
  message: string;
  logs: string[] | null;
}> {
  const name = error instanceof Error ? error.name : "unknown";
  const message = error instanceof Error ? error.message : String(error ?? "");
  let logs: string[] | null = null;
  const sendError =
    error instanceof SendTransactionError
      ? error
      : error &&
          typeof error === "object" &&
          "getLogs" in error &&
          typeof (error as SendTransactionError).getLogs === "function"
        ? (error as SendTransactionError)
        : null;
  if (sendError) {
    logs = sendError.logs ?? null;
    if (!logs?.length && connection) {
      try {
        logs = await sendError.getLogs(connection);
      } catch {
        logs = sendError.logs ?? null;
      }
    }
  }
  const joined = `${name} ${message} ${logs?.join(" ") ?? ""}`;
  let kind = "send_failed";
  if (isBlockhashExpiredError(error)) kind = "blockhash_expired";
  else if (/rent.?exempt|insufficient funds for rent/i.test(joined)) {
    kind = "rent_exemption";
  } else if (/insufficient|0x1\b/i.test(joined)) {
    kind = "insufficient_funds";
  }
  return { kind, name, message, logs };
}

export function signatureFromErrorMessage(error: unknown): string | null {
  const text = error instanceof Error ? error.message : String(error ?? "");
  const match = text.match(
    /Signature\s+([1-9A-HJ-NP-Za-km-z]{32,88})\s+has expired/i,
  );
  return match?.[1] ?? null;
}

async function signatureLanded(
  connection: Connection,
  signature: string,
): Promise<boolean> {
  const { value } = await connection.getSignatureStatuses([signature], {
    searchTransactionHistory: true,
  });
  const status = value[0];
  if (!status || status.err) return false;
  return (
    status.confirmationStatus === "confirmed" ||
    status.confirmationStatus === "finalized"
  );
}

/**
 * Sign and send immediately after fetching a confirmed blockhash.
 * Retries 5 times with a short delay, injecting a new lastValidBlockHeight
 * when the previous hash expires.
 */
export async function sendAndConfirmWithFreshBlockhash(
  connection: Connection,
  payer: Keypair,
  instructions: TransactionInstruction[],
): Promise<string> {
  let lastError: unknown;
  const submitted: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 1) {
      await delay(RETRY_DELAY_MS * (attempt - 1));
    }

    const latest = await connection.getLatestBlockhashAndContext("confirmed");
    const { blockhash, lastValidBlockHeight } = latest.value;
    const minContextSlot = latest.context.slot;

    const tx = new Transaction();
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.add(...instructions);
    tx.sign(payer);
    const serialized = tx.serialize();

    log("signed at the confirmed blockhash", {
      attempt,
      blockhash,
      lastValidBlockHeight,
      minContextSlot,
    });

    let signature = "";
    try {
      signature = await connection.sendRawTransaction(serialized, {
        skipPreflight: attempt > 1,
        preflightCommitment: "confirmed",
        minContextSlot,
        maxRetries: 5,
      });
      submitted.push(signature);
      log("submitted", {
        signature,
        lastValidBlockHeight,
        solscan: `https://solscan.io/tx/${signature}`,
      });

      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed",
      );
      if (confirmation.value.err) {
        throw new Error(
          `on-chain error: ${JSON.stringify(confirmation.value.err)}`,
        );
      }
      log("confirmed", { signature, attempt });
      return signature;
    } catch (error) {
      lastError = error;
      if (signature && (await signatureLanded(connection, signature))) {
        log("landed after confirm race", { signature });
        return signature;
      }
      for (const previous of submitted) {
        if (await signatureLanded(connection, previous)) {
          log("earlier attempt already confirmed", { signature: previous });
          return previous;
        }
      }
      if (!isBlockhashExpiredError(error) && attempt < MAX_ATTEMPTS) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/timeout|429|fetch failed|failed to fetch|block height/i.test(message)) {
          throw error;
        }
      }
      if (attempt === MAX_ATTEMPTS) {
        break;
      }
      log("retrying with a new confirmed blockhash", {
        attempt,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("SPL transfer failed after blockhash retries");
}

/**
 * Wallet sendTransaction often returns a signature before the cluster has
 * seen it. confirmTransaction then throws "block height exceeded" even when
 * the transfer already landed. Poll getSignatureStatuses before failing.
 */
export async function confirmSubmittedSignature(
  connection: Connection,
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number,
): Promise<void> {
  try {
    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      "confirmed",
    );
    if (confirmation.value.err) {
      throw new Error(
        `on-chain error: ${JSON.stringify(confirmation.value.err)}`,
      );
    }
  } catch (error) {
    if (await waitUntilSignatureLanded(connection, signature)) {
      log("landed after confirm race", { signature });
      return;
    }
    throw error;
  }
}

export async function waitUntilSignatureLanded(
  connection: Connection,
  signature: string,
  attempts = 10,
  delayMs = 1500,
): Promise<boolean> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (await signatureLanded(connection, signature)) return true;
    if (attempt < attempts) await delay(delayMs);
  }
  return false;
}
