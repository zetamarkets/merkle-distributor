import { utils } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

import { PROGRAM_ID } from "./constants";

export const findDistributorKey = (base: PublicKey): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode("MerkleDistributor"), base.toBytes()],
    PROGRAM_ID
  );
};

export const findClaimStatusKey = (
  claimant: PublicKey,
  distributor: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("ClaimStatus"),
      distributor.toBytes(),
      claimant.toBytes(),
    ],
    PROGRAM_ID
  );
};
