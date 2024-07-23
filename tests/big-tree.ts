import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";

import { BalanceTree } from "../src/utils";
import { MerkleDistributorWrapper } from "../src";
import { makeSDK, createAndSeedDistributor } from "./utils";
import { PublicKey, Keypair } from "@solana/web3.js";
import { STAKE_ONLY_PROGRAM_ID } from "../src";

describe("big tree", () => {
  const NUM_LEAVES = 100_000;
  const NUM_SAMPLES = 25;

  const sdk = makeSDK();
  const { provider } = sdk;
  const elements: { account: PublicKey; amount: anchor.BN }[] = [];

  for (let i = 0; i < NUM_LEAVES; i++) {
    const node = {
      account: provider.wallet.publicKey,
      amount: new anchor.BN(100),
    };
    elements.push(node);
  }
  const tree = new BalanceTree(elements);

  it("proof verification works", () => {
    const account = provider.wallet.publicKey;
    const root = tree.getRoot();

    for (let i = 0; i < NUM_LEAVES; i += NUM_LEAVES / NUM_SAMPLES) {
      const proof = tree.getProof(i, account, new anchor.BN(100));
      const validProof = BalanceTree.verifyProof(
        i,
        account,
        new anchor.BN(100),
        proof,
        root
      );
      assert.ok(validProof);
    }
  });

  it("claim deep node", async () => {
    let distributorWrapper: MerkleDistributorWrapper;
    let base = Keypair.generate();

    const { distributorKey, distributor } = await createAndSeedDistributor(
      sdk,
      new anchor.BN(100 * NUM_LEAVES),
      new anchor.BN(NUM_LEAVES),
      tree.getRoot(),
      base,
      new anchor.BN(0),
      new anchor.BN(1809635703),
      false,
      new anchor.BN(100_000000),
      new anchor.BN(0)
    );

    distributorWrapper = await sdk.loadDistributor(distributorKey);

    const amount = new anchor.BN(100);
    const index = new anchor.BN(90000);
    const claimant = provider.wallet.publicKey;
    await distributorWrapper.claim(STAKE_ONLY_PROGRAM_ID, {
      index,
      amount,
      proof: tree.getProof(index.toNumber(), provider.wallet.publicKey, amount),
      claimant,
    });
  });
});
