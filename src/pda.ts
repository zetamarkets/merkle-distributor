import { utils } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export const findDistributorKey = (
  programId: PublicKey,
  base: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode("MerkleDistributor"), base.toBytes()],
    programId
  );
};

export const findClaimStatusKey = (
  programId: PublicKey,
  claimant: PublicKey,
  distributor: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("ClaimStatus"),
      distributor.toBytes(),
      claimant.toBytes(),
    ],
    programId
  );
};
