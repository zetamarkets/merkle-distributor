import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

import idl from "../target/idl/merkle_distributor.json";

export const PROGRAM_ID = new PublicKey(
  "9xXVvfr2XEikR7ZFScHtNY2Gb4s5jKTLXNTnTtux99KD"
);

export const MERKLE_DISTRIBUTOR_PROGRAM_ID = PROGRAM_ID;

export const MERKLE_DISTRIBUTOR_CODER = new anchor.BorshCoder(
  idl as anchor.Idl
);
