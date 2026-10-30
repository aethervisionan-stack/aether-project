import {
  Connection,
  Keypair,
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
