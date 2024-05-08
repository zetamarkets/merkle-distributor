import * as anchor from "@coral-xyz/anchor";

import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, mintTo } from "@solana/spl-token";

import { MerkleDistributorSDK } from "../src";
import { Distributor } from "../src";

export const DEFAULT_TOKEN_DECIMALS = 6;

export const makeSDK = (): MerkleDistributorSDK => {
  const anchorProvider = anchor.AnchorProvider.env();
  // if the program isn't loaded, load the default
  // Configure the client to use the provider.
  anchor.setProvider(anchorProvider);

  return MerkleDistributorSDK.load({ provider: anchorProvider });
};

export const createKeypairWithSOL = async (
  provider: anchor.AnchorProvider
): Promise<Keypair> => {
  const kp = Keypair.generate();
  await provider.connection.requestAirdrop(kp.publicKey, LAMPORTS_PER_SOL);
  return kp;
};

export const createAndSeedDistributor = async (
  sdk: MerkleDistributorSDK,
  maxTotalClaim: anchor.BN,
  maxNumNodes: anchor.BN,
  root: Buffer,
  base: Keypair,
  claimStartTs: anchor.BN,
  claimEndTs: anchor.BN,
  stakeClaim: boolean,
  immediateClaimPercentage: anchor.BN,
  laterClaimOffsetSeconds: anchor.BN,
  mint?: PublicKey,
  mintAdmin?: Keypair
): Promise<{
  mint: PublicKey;
  distributorKey: PublicKey;
  distributor: Distributor;
}> => {
  const { provider } = sdk;

  let mintToUse: PublicKey;
  if (!mint) {
    mintToUse = await createMint(
      provider.connection,
      (provider.wallet as anchor.Wallet).payer,
      provider.publicKey,
      provider.publicKey,
      DEFAULT_TOKEN_DECIMALS
    );
  } else {
    mintToUse = mint;
  }

  const distributor = await sdk.createDistributor({
    root,
    maxTotalClaim,
    maxNumNodes,
    tokenMint: mintToUse,
    adminAuth: (provider.wallet as anchor.Wallet).payer,
    base,
    claimStartTs,
    claimEndTs,
    stakeClaim,
    immediateClaimPercentage,
    laterClaimOffsetSeconds,
  });

  let payerToUse = (provider.wallet as anchor.Wallet).payer;
  if (mintAdmin) {
    payerToUse = mintAdmin;
  }

  // Seed merkle distributor with tokens
  await mintTo(
    provider.connection,
    payerToUse,
    mintToUse,
    distributor.distributorATA,
    payerToUse,
    maxTotalClaim.toNumber()
  );

  return {
    mint: mintToUse,
    distributorKey: distributor.distributor,
    distributor,
  };
};
