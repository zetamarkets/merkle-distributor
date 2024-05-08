import * as anchor from "@coral-xyz/anchor";
import type { Keypair, PublicKey } from "@solana/web3.js";

import type { MerkleDistributorSDK } from "./sdk";

export type CreateDistributorArgs = {
  sdk: MerkleDistributorSDK;
  root: Buffer;
  maxTotalClaim: anchor.BN;
  maxNumNodes: anchor.BN;
  tokenMint: PublicKey;
  adminAuth: Keypair;
  base: Keypair;
  claimStartTs: anchor.BN;
  claimEndTs: anchor.BN;
  stakeClaim: boolean;
  immediateClaimPercentage: anchor.BN;
  laterClaimOffsetSeconds: anchor.BN;
};

export type UpdateDistributorArgs = {
  root: Buffer;
  maxTotalClaim: anchor.BN;
  maxNumNodes: anchor.BN;
  adminAuth: Keypair;
};

export type UpdateDistributorClaimWindowArgs = {
  claimStartTs: anchor.BN;
  claimEndTs: anchor.BN;
  adminAuth: Keypair;
};

export type Distributor = {
  bump: number;
  base: PublicKey;
  distributor: PublicKey;
  distributorATA: PublicKey;
};

export type ClaimArgs = {
  index: anchor.BN;
  amount: anchor.BN;
  proof: Buffer[];
  claimant: PublicKey;
  signers?: Keypair[];
};

export interface DistributorData {
  base: PublicKey;
  adminAuth: PublicKey;
  bump: number;
  root: Array<number>;
  mint: PublicKey;
  maxTotalClaim: anchor.BN;
  maxNumNodes: anchor.BN;
  totalAmountClaimed: anchor.BN;
  numNodesClaimed: anchor.BN;
  claimStartTs: anchor.BN;
  claimEndTs: anchor.BN;
  stakeClaim: boolean;
}

export interface ClaimStatus {
  claimant: PublicKey;
  claimedAt: anchor.BN;
  claimedAmount: anchor.BN;
}
