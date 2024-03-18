import * as anchor from "@coral-xyz/anchor";
import {
  Transaction,
  Signer,
  ConfirmOptions,
  TransactionSignature,
} from "@solana/web3.js";
import idl from "../../target/idl/merkle_distributor.json";

export async function processTransaction(
  provider: anchor.AnchorProvider,
  tx: Transaction,
  signers?: Array<Signer>,
  opts?: ConfirmOptions
): Promise<TransactionSignature> {
  let recentBlockhash = await provider.connection.getLatestBlockhash();
  tx.recentBlockhash = recentBlockhash.blockhash;
  tx.feePayer = provider.publicKey;

  try {
    return await provider.sendAndConfirm(tx, signers, opts);
  } catch (e) {
    throw parseError(e);
  }
}

export function parseError(err: any) {
  const anchorError = anchor.AnchorError.parse(err.logs);
  if (anchorError) {
    // Parse Anchor error into another type such that it's consistent.
    return NativeAnchorError.parse(anchorError);
  }

  const programError = anchor.ProgramError.parse(err, idlErrors);
  if (typeof err == typeof 0 && idlErrors.has(err)) {
    return idlErrors.get(err);
  }
  if (programError) {
    return programError;
  }

  return err;
}

function parseIdlErrors(idl: anchor.Idl): Map<number, string> {
  const errors = new Map();
  if (idl.errors) {
    idl.errors.forEach((e) => {
      let msg = e.msg ?? e.name;
      errors.set(e.code, msg);
    });
  }
  return errors;
}

class NativeAnchorError extends Error {
  constructor(
    readonly code: number,
    readonly msg: string,
    readonly logs: string[],
    readonly errorLogs: string[]
  ) {
    super(errorLogs.join("\n"));
  }

  public static parse(error: anchor.AnchorError): NativeAnchorError {
    let err = new NativeAnchorError(
      error.error.errorCode.number,
      error.error.errorMessage,
      error.logs,
      error.errorLogs
    );
    return err;
  }

  public toString(): string {
    return this.msg;
  }
}

const idlErrors = parseIdlErrors(idl as anchor.Idl);
