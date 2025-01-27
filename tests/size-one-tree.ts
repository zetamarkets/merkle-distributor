import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";

import { BalanceTree } from "../src/utils";
import {
  makeSDK,
  createAndSeedDistributor,
  createKeypairWithSOL,
} from "./utils";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { STAKE_ONLY_PROGRAM_ID } from "../src";

const MAX_NUM_NODES = new anchor.BN(1);
const MAX_TOTAL_CLAIM = new anchor.BN(1_000_000_000_000);
const ZERO_BYTES32 = Buffer.alloc(32);

describe("merkle distributor", () => {
  const sdk = makeSDK();
  const { provider } = sdk;

  it("success on one account tree", async () => {
    const base0 = Keypair.generate();

    const kpOne = Keypair.generate();

    await provider.connection.requestAirdrop(kpOne.publicKey, LAMPORTS_PER_SOL);

    const claimAmountOne = new anchor.BN(100);

    const tree = new BalanceTree([
      { account: kpOne.publicKey, amount: claimAmountOne },
    ]);
    const { distributorKey } = await createAndSeedDistributor(
      sdk,
      MAX_TOTAL_CLAIM,
      MAX_NUM_NODES,
      tree.getRoot(),
      base0,
      new anchor.BN(0),
      new anchor.BN(1809635703),
      false,
      new anchor.BN(100_000000),
      new anchor.BN(0)
    );

    const distributorW = await sdk.loadDistributor(distributorKey);

    const proof = tree.getProof(0, kpOne.publicKey, claimAmountOne);
    console.log("one account tree proof:", proof);

    await distributorW.claim(STAKE_ONLY_PROGRAM_ID, {
      index: new anchor.BN(0),
      amount: claimAmountOne,
      proof,
      claimant: kpOne.publicKey,
      signers: [kpOne],
    });

    const claimerTokenAccountInfo = await getAccount(
      provider.connection,
      getAssociatedTokenAddressSync(distributorW.data.mint, kpOne.publicKey)
    );
    assert.equal(
      claimerTokenAccountInfo.amount.toString(),
      claimAmountOne.toString()
    );

    const claimStatus = await distributorW.getClaimStatus(
      STAKE_ONLY_PROGRAM_ID,
      kpOne.publicKey
    );
    assert.equal(claimStatus.claimant.toString(), kpOne.publicKey.toString());
    assert.equal(
      claimStatus.claimedAmount.toString(),
      claimAmountOne.toString()
    );

    const tokenAccountInfo = await getAccount(
      provider.connection,
      distributorW.distributorATA
    );
    assert.equal(
      tokenAccountInfo.amount.toString(),
      MAX_TOTAL_CLAIM.sub(claimAmountOne).toString()
    );

    await distributorW.reload();
    const { data } = distributorW;
    assert.equal(data.numNodesClaimed.toNumber(), 1);
    assert.equal(data.totalAmountClaimed.toString(), claimAmountOne.toString());
  });
});
