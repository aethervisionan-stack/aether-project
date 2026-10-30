import {
  PublicKey,
  type ParsedInstruction,
  type PartiallyDecodedInstruction,
} from "@solana/web3.js";
import { MEMO_PROGRAM_ID } from "@/lib/memo";
import { SQUADS_VAULT } from "@/lib/presale";
import { executeWithRpcFallback } from "@/lib/solana";

export { MEMO_PROGRAM_ID };

const TREASURY = new PublicKey(SQUADS_VAULT);

function instructionProgramId(
  ix: ParsedInstruction | PartiallyDecodedInstruction,
): string {
  return "programId" in ix ? ix.programId.toBase58() : "";
}

export async function verifySolPayment(input: {
  signature: string;
  orderId: string;
  expectedLamports: number | null;
}): Promise<
  { ok: true; lamports: number } | { ok: false; reason: string }
> {
  const { result: parsed } = await executeWithRpcFallback(async (connection) => {
    const tx = await connection.getParsedTransaction(input.signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    if (!tx) {
      throw new TypeError("Transaction not found or not confirmed");
    }
    return tx;
  });
  if (parsed.meta?.err) {
    return { ok: false, reason: "Transaction failed on-chain" };
  }

  const instructions = [
    ...(parsed.transaction.message.instructions ?? []),
    ...(parsed.meta?.innerInstructions ?? []).flatMap((item) => item.instructions),
  ];

  let sawTreasury = false;
  let sawMemo = false;
  let lamports = 0;

  for (const ix of instructions) {
    const program = instructionProgramId(ix);
    if (program === MEMO_PROGRAM_ID.toBase58()) {
      const data =
        "parsed" in ix
          ? String((ix as ParsedInstruction).parsed ?? "")
          : "data" in ix
            ? Buffer.from(
                (ix as PartiallyDecodedInstruction).data,
                "base64",
              ).toString("utf8")
            : "";
      if (data.includes(input.orderId)) sawMemo = true;
    }
    if ("parsed" in ix && ix.parsed && typeof ix.parsed === "object") {
      const parsedIx = ix.parsed as {
        type?: string;
        info?: { destination?: string; lamports?: number };
      };
      if (
        parsedIx.type === "transfer" &&
        parsedIx.info?.destination === TREASURY.toBase58()
      ) {
        sawTreasury = true;
        lamports = parsedIx.info.lamports ?? 0;
      }
    }
  }

  if (!sawTreasury) {
    return { ok: false, reason: "No SOL transfer to Squads treasury in this tx" };
  }
  if (!sawMemo) {
    return { ok: false, reason: "Memo does not match this order id" };
  }
  if (
    input.expectedLamports &&
    input.expectedLamports > 0 &&
    lamports + 1 < input.expectedLamports
  ) {
    return {
      ok: false,
      reason: `Paid ${lamports} lamports, expected ${input.expectedLamports}`,
    };
  }
  return { ok: true, lamports };
}
