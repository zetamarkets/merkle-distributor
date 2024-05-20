import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";

import { BalanceTree } from "../src/utils";
import { makeSDK, createAndSeedDistributor } from "./utils";
import { MerkleDistributorWrapper, findDistributorKey } from "../src";
import { sleepUntil } from "../deps/zeta-staking/tests/test-utils";

const MAX_NUM_NODES = new anchor.BN(3);
const MAX_TOTAL_CLAIM = new anchor.BN(500 + 750 + 999);

describe("distributor-early-and-late-claim", () => {
  const sdk = makeSDK();
  const { provider } = sdk;

  const claimStartTs = Math.round(Date.now() / 1000) + 5;
  const claimEndTs = Math.round(Date.now() / 1000) + 18;
  const immediateClaimPercentage = 50;
  const laterClaimOffsetSeconds = 6;

  const kpOne = Keypair.generate();
  const kpTwo = Keypair.generate();
  const kpThree = Keypair.generate();
  const allKps = [kpOne, kpTwo, kpThree];

  const distributorBase = Keypair.generate();

  const claimAmountOne = new anchor.BN(500);
  const claimAmountTwo = new anchor.BN(750);
  const claimAmountThree = new anchor.BN(999);
  const tree = new BalanceTree([
    { account: kpOne.publicKey, amount: claimAmountOne },
    { account: kpTwo.publicKey, amount: claimAmountTwo },
    { account: kpThree.publicKey, amount: claimAmountThree },
  ]);

  const [distributorKey, distributorBump] = findDistributorKey(
    distributorBase.publicKey
  );

  let distributorW: MerkleDistributorWrapper;

  before(async () => {
    await Promise.all(
      allKps.map(async (kp) => {
        await provider.connection.requestAirdrop(
          kp.publicKey,
          LAMPORTS_PER_SOL
        );
      })
    );
  });

  it("create a distributor with important parameters.", async () => {
    const { mint } = await createAndSeedDistributor(
      sdk,
      MAX_TOTAL_CLAIM,
      MAX_NUM_NODES,
      tree.getRoot(),
      distributorBase,
      new anchor.BN(claimStartTs),
      new anchor.BN(claimEndTs),
      false,
      new anchor.BN(immediateClaimPercentage * 1_000_000),
      new anchor.BN(laterClaimOffsetSeconds)
    );
    distributorW = await sdk.loadDistributor(distributorKey);

    const { data } = distributorW;
    assert.equal(data.bump, distributorBump);
    assert.equal(data.maxNumNodes.toString(), MAX_NUM_NODES.toString());
    assert.equal(data.maxTotalClaim.toString(), MAX_TOTAL_CLAIM.toString());
    assert.equal(data.base.toString(), distributorBase.publicKey.toString());
    assert.equal(data.mint.toString(), mint.toString());
    assert.equal(data.numNodesClaimed.toString(), new anchor.BN(0).toString());
    assert.deepEqual(data.root, Array.from(new Uint8Array(tree.getRoot())));
    assert.equal(
      data.totalAmountClaimed.toString(),
      new anchor.BN(0).toString()
    );
    assert.equal(data.claimStartTs.toNumber(), claimStartTs);
    assert.equal(data.claimEndTs.toNumber(), claimEndTs);
    assert.equal(
      data.immediateClaimPercentage.toNumber(),
      immediateClaimPercentage * 1_000_000
    );
    assert.equal(
      data.laterClaimOffsetSeconds.toNumber(),
      laterClaimOffsetSeconds
    );

    const tokenAccountInfo = await getAccount(
      provider.connection,
      distributorW.distributorATA
    );
    assert.equal(tokenAccountInfo.mint.toString(), mint.toString());
    assert.equal(
      tokenAccountInfo.amount.toString(),
      MAX_TOTAL_CLAIM.toString()
    );
  });

  it("try and claim before window", async () => {
    const proof = tree.getProof(0, kpOne.publicKey, claimAmountOne);
    try {
      await distributorW.claim({
        index: new anchor.BN(0),
        amount: claimAmountOne,
        proof,
        claimant: kpOne.publicKey,
        signers: [kpOne],
      });
      throw Error("Should not succeed");
    } catch (e) {
      assert.equal(e.msg, "Outside the claim window");
    }
  });

  let actualClaimAmountOne = 0;
  it("claim right after window starts for percetnage haircut.", async () => {
    await sleepUntil(claimStartTs + 2);

    const proof = tree.getProof(0, kpOne.publicKey, claimAmountOne);

    await distributorW.claim({
      index: new anchor.BN(0),
      amount: claimAmountOne,
      proof,
      claimant: kpOne.publicKey,
      signers: [kpOne],
    });

    const slot = await provider.connection.getSlot({ commitment: "processed" });
    const timestamp = await provider.connection.getBlockTime(slot);

    let estimatedClaimAmount = distributorW.getEstimatedClaimAmount(
      claimAmountOne.toNumber(),
      timestamp!
    );

    const claimaintOneTokenAccInfo = await getAccount(
      provider.connection,
      getAssociatedTokenAddressSync(distributorW.data.mint, kpOne.publicKey)
    );

    console.log(estimatedClaimAmount);
    assert.equal(Number(claimaintOneTokenAccInfo.amount), estimatedClaimAmount);

    actualClaimAmountOne = Number(claimaintOneTokenAccInfo.amount);

    console.log(
      "haircut claim, full amount = 500, clipped amount =",
      estimatedClaimAmount,
      actualClaimAmountOne
    );

    const claimStatus = await distributorW.getClaimStatus(kpOne.publicKey);
    assert.equal(claimStatus.claimant.toString(), kpOne.publicKey.toString());
    assert.equal(
      claimStatus.claimedAmount.toString(),
      claimAmountOne.toString()
    );
  });

  it("try and claim again with user one after haircut over.", async () => {
    await sleepUntil(claimStartTs + laterClaimOffsetSeconds + 2);

    const proof = tree.getProof(0, kpOne.publicKey, claimAmountOne);

    try {
      await distributorW.claim({
        index: new anchor.BN(0),
        amount: claimAmountOne,
        proof,
        claimant: kpOne.publicKey,
        signers: [kpOne],
      });
      throw Error("Should not succeed");
    } catch (e) {
      assert.equal(e.msg, "no claimable amount");
    }
  });

  it("claim for full amount for user two", async () => {
    const proof = tree.getProof(1, kpTwo.publicKey, claimAmountTwo);

    await distributorW.claim({
      index: new anchor.BN(1),
      amount: claimAmountTwo,
      proof,
      claimant: kpTwo.publicKey,
      signers: [kpTwo],
    });

    const claimaintTwoTokenAccInfo = await getAccount(
      provider.connection,
      getAssociatedTokenAddressSync(distributorW.data.mint, kpTwo.publicKey)
    );

    assert.equal(
      Number(claimaintTwoTokenAccInfo.amount),
      claimAmountTwo.toNumber()
    );

    const claimStatus = await distributorW.getClaimStatus(kpTwo.publicKey);
    assert.equal(claimStatus.claimant.toString(), kpTwo.publicKey.toString());
    assert.equal(
      claimStatus.claimedAmount.toString(),
      claimAmountTwo.toString()
    );
  });

  it("clawback after window over", async () => {
    await sleepUntil(claimEndTs + 2);

    const proof = tree.getProof(2, kpThree.publicKey, claimAmountThree);

    try {
      await distributorW.claim({
        index: new anchor.BN(2),
        amount: claimAmountThree,
        proof,
        claimant: kpThree.publicKey,
        signers: [kpThree],
      });
      throw Error("Should not succeed");
    } catch (e) {
      assert.equal(e.msg, "Outside the claim window");
    }

    let ataAcc = await getAccount(
      provider.connection,
      distributorW.distributorATA
    );
    assert.equal(
      Number(ataAcc.amount),
      claimAmountOne.toNumber() -
        actualClaimAmountOne +
        claimAmountThree.toNumber()
    );

    const distributorAdminKp = (
      distributorW.sdk.provider.wallet as anchor.Wallet
    ).payer;
    await distributorW.adminClaimAfterExpiry(distributorAdminKp);

    ataAcc = await getAccount(provider.connection, distributorW.distributorATA);
    assert.equal(Number(ataAcc.amount), 0);

    let adminAtaAddr = getAssociatedTokenAddressSync(
      distributorW.data.mint,
      distributorAdminKp.publicKey
    );
    let adminAtaAcc = await getAccount(provider.connection, adminAtaAddr);
    assert.equal(
      Number(adminAtaAcc.amount),
      claimAmountOne.toNumber() -
        actualClaimAmountOne +
        claimAmountThree.toNumber()
    );
  });
});
