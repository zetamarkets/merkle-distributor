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

const MAX_NUM_NODES = new anchor.BN(3);
const MAX_TOTAL_CLAIM = new anchor.BN(1_000_000_000_000);
const ZERO_BYTES32 = Buffer.alloc(32);

describe("merkle distributor", () => {
  const sdk = makeSDK();
  const { provider } = sdk;

  it("Is initialized!", async () => {
    const base0 = Keypair.generate();
    const { mint, distributor: distributorPending } =
      await createAndSeedDistributor(
        sdk,
        MAX_TOTAL_CLAIM,
        MAX_NUM_NODES,
        ZERO_BYTES32,
        base0,
        new anchor.BN(0),
        new anchor.BN(1809635703),
        false,
        new anchor.BN(100_000000),
        new anchor.BN(0)
      );
    const { distributor, base, bump } = distributorPending;
    const distributorW = await sdk.loadDistributor(distributor);

    const { data } = distributorW;
    assert.equal(data.bump, bump);
    assert.equal(data.maxNumNodes.toString(), MAX_NUM_NODES.toString());
    assert.equal(data.maxTotalClaim.toString(), MAX_TOTAL_CLAIM.toString());
    assert.equal(data.base.toString(), base0.publicKey.toString());
    assert.equal(data.mint.toString(), mint.toString());
    assert.equal(data.numNodesClaimed.toString(), new anchor.BN(0).toString());
    assert.deepEqual(data.root, Array.from(new Uint8Array(ZERO_BYTES32)));
    assert.equal(
      data.totalAmountClaimed.toString(),
      new anchor.BN(0).toString()
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

  it("fails for empty proof", async () => {
    const base1 = Keypair.generate();

    const claimantKP = Keypair.generate();
    await provider.connection.requestAirdrop(
      claimantKP.publicKey,
      LAMPORTS_PER_SOL
    );

    const { distributorKey } = await createAndSeedDistributor(
      sdk,
      MAX_TOTAL_CLAIM,
      MAX_NUM_NODES,
      ZERO_BYTES32,
      base1,
      new anchor.BN(0),
      new anchor.BN(1809635703),
      false,
      new anchor.BN(100_000000),
      new anchor.BN(0)
    );
    const distributorW = await sdk.loadDistributor(distributorKey);

    try {
      await distributorW.claim(STAKE_ONLY_PROGRAM_ID, {
        index: new anchor.BN(0),
        amount: new anchor.BN(10_000_000),
        proof: [],
        claimant: claimantKP.publicKey,
        signers: [claimantKP],
      });
      throw Error("Should not succeed");
    } catch (e) {
      assert.equal(e.msg, "Invalid Merkle proof.");
    }
  });

  it("success on three account tree", async () => {
    const base2 = Keypair.generate();

    const kpOne = Keypair.generate();
    const kpTwo = Keypair.generate();
    const kpThree = Keypair.generate();
    const allKps = [kpOne, kpTwo, kpThree];
    await Promise.all(
      allKps.map(async (kp) => {
        await provider.connection.requestAirdrop(
          kp.publicKey,
          LAMPORTS_PER_SOL
        );
      })
    );

    const claimAmountOne = new anchor.BN(100);
    const claimAmountTwo = new anchor.BN(101);
    const claimAmountThree = new anchor.BN(102);
    const tree = new BalanceTree([
      { account: kpOne.publicKey, amount: claimAmountOne },
      { account: kpTwo.publicKey, amount: claimAmountTwo },
      { account: kpThree.publicKey, amount: claimAmountThree },
    ]);
    const { distributorKey } = await createAndSeedDistributor(
      sdk,
      MAX_TOTAL_CLAIM,
      MAX_NUM_NODES,
      tree.getRoot(),
      base2,
      new anchor.BN(0),
      new anchor.BN(1809635703),
      false,
      new anchor.BN(100_000000),
      new anchor.BN(0)
    );

    const distributorW = await sdk.loadDistributor(distributorKey);
    await Promise.all(
      allKps.map(async (kp, index) => {
        const amount = new anchor.BN(100 + index);
        const proof = tree.getProof(index, kp.publicKey, amount);

        await distributorW.claim(STAKE_ONLY_PROGRAM_ID, {
          index: new anchor.BN(index),
          amount,
          proof,
          claimant: kp.publicKey,
          signers: [kp],
        });

        const tokenAccountInfo = await getAccount(
          provider.connection,
          getAssociatedTokenAddressSync(distributorW.data.mint, kp.publicKey)
        );
        assert.equal(tokenAccountInfo.amount.toString(), amount.toString());

        const claimStatus = await distributorW.getClaimStatus(
          STAKE_ONLY_PROGRAM_ID,
          kp.publicKey
        );
        assert.equal(claimStatus.claimant.toString(), kp.publicKey.toString());
        assert.equal(claimStatus.claimedAmount.toString(), amount.toString());
      })
    );

    const expectedTotalClaimed = claimAmountOne
      .add(claimAmountTwo)
      .add(claimAmountThree);
    const tokenAccountInfo = await getAccount(
      provider.connection,
      distributorW.distributorATA
    );
    assert.equal(
      tokenAccountInfo.amount.toString(),
      MAX_TOTAL_CLAIM.sub(expectedTotalClaimed).toString()
    );

    await distributorW.reload();
    const { data } = distributorW;
    assert.equal(data.numNodesClaimed.toNumber(), allKps.length);
    assert.equal(
      data.totalAmountClaimed.toString(),
      expectedTotalClaimed.toString()
    );
  });

  it("cannot claim more than proof", async () => {
    const base3 = Keypair.generate();

    const userKP = await createKeypairWithSOL(provider);

    const claimAmount = new anchor.BN(1_000_000);
    const tree = new BalanceTree([
      { account: userKP.publicKey, amount: new anchor.BN(1_000_000) },
    ]);
    const { distributorKey } = await createAndSeedDistributor(
      sdk,
      MAX_TOTAL_CLAIM,
      MAX_NUM_NODES,
      tree.getRoot(),
      base3,
      new anchor.BN(0),
      new anchor.BN(1809635703),
      false,
      new anchor.BN(100_000000),
      new anchor.BN(0)
    );
    const distributorW = await sdk.loadDistributor(distributorKey);

    try {
      await distributorW.claim(STAKE_ONLY_PROGRAM_ID, {
        index: new anchor.BN(0),
        amount: new anchor.BN(2_000_000),
        proof: tree.getProof(0, userKP.publicKey, claimAmount),
        claimant: userKP.publicKey,
        signers: [userKP],
      });
      throw Error("Should not succeed");
    } catch (e) {
      assert.equal(e.msg, "Invalid Merkle proof.");
    }
  });

  it("cannot claim for address other than proof", async () => {
    const base4 = Keypair.generate();

    const claimant = Keypair.generate().publicKey;
    const rogueKP = await createKeypairWithSOL(provider);

    const claimAmount = new anchor.BN(1_000_000);
    const tree = new BalanceTree([{ account: claimant, amount: claimAmount }]);
    const { distributorKey } = await createAndSeedDistributor(
      sdk,
      MAX_TOTAL_CLAIM,
      MAX_NUM_NODES,
      tree.getRoot(),
      base4,
      new anchor.BN(0),
      new anchor.BN(1809635703),
      false,
      new anchor.BN(100_000000),
      new anchor.BN(0)
    );
    const distributorW = await sdk.loadDistributor(distributorKey);

    try {
      await distributorW.claim(STAKE_ONLY_PROGRAM_ID, {
        index: new anchor.BN(0),
        amount: new anchor.BN(2_000_000),
        proof: tree.getProof(0, claimant, claimAmount),
        claimant,
        signers: [rogueKP],
      });
      throw Error("Should not succeed");
    } catch (e) {
      assert.equal(
        e.message,
        `unknown signer: ${rogueKP.publicKey.toString()}`
      );
    }
  });

  it("update tree", async () => {
    const base5 = Keypair.generate();

    const kpOne = Keypair.generate();
    const kpTwo = Keypair.generate();
    const kpThree = Keypair.generate();
    const allKps = [kpOne, kpTwo, kpThree];
    await Promise.all(
      allKps.map(async (kp) => {
        await provider.connection.requestAirdrop(
          kp.publicKey,
          LAMPORTS_PER_SOL
        );
      })
    );

    const claimAmountOne = new anchor.BN(100);
    const claimAmountTwo = new anchor.BN(101);
    const claimAmountThree = new anchor.BN(102);
    const tree = new BalanceTree([
      { account: kpOne.publicKey, amount: claimAmountOne },
      { account: kpTwo.publicKey, amount: claimAmountTwo },
      { account: kpThree.publicKey, amount: claimAmountThree },
    ]);
    const { distributorKey } = await createAndSeedDistributor(
      sdk,
      MAX_TOTAL_CLAIM,
      MAX_NUM_NODES,
      tree.getRoot(),
      base5,
      new anchor.BN(0),
      new anchor.BN(1809635703),
      false,
      new anchor.BN(100_000000),
      new anchor.BN(0)
    );

    const distributorW = await sdk.loadDistributor(distributorKey);
    await Promise.all(
      allKps.map(async (kp, index) => {
        const amount = new anchor.BN(100 + index);
        const proof = tree.getProof(index, kp.publicKey, amount);

        await distributorW.claim(STAKE_ONLY_PROGRAM_ID, {
          index: new anchor.BN(index),
          amount,
          proof,
          claimant: kp.publicKey,
          signers: [kp],
        });

        let ata = getAssociatedTokenAddressSync(
          distributorW.data.mint,
          kp.publicKey
        );
        const tokenAccountInfo = await getAccount(provider.connection, ata);
        assert.equal(tokenAccountInfo.amount.toString(), amount.toString());

        const claimStatus = await distributorW.getClaimStatus(
          STAKE_ONLY_PROGRAM_ID,
          kp.publicKey
        );
        assert.equal(claimStatus.claimant.toString(), kp.publicKey.toString());
        assert.equal(claimStatus.claimedAmount.toString(), amount.toString());
      })
    );

    let expectedTotalClaimed = claimAmountOne
      .add(claimAmountTwo)
      .add(claimAmountThree);
    let tokenAccountInfo = await getAccount(
      provider.connection,
      distributorW.distributorATA
    );
    assert.equal(
      tokenAccountInfo.amount.toString(),
      MAX_TOTAL_CLAIM.sub(expectedTotalClaimed).toString()
    );

    await distributorW.reload();
    let { data } = distributorW;
    assert.equal(data.numNodesClaimed.toNumber(), allKps.length);
    assert.equal(
      data.totalAmountClaimed.toString(),
      expectedTotalClaimed.toString()
    );

    let oldTotalClaimed = expectedTotalClaimed;

    let oldBalance1 = await getAccount(
      provider.connection,
      getAssociatedTokenAddressSync(distributorW.data.mint, kpOne.publicKey)
    );
    let oldBalance2 = await getAccount(
      provider.connection,
      getAssociatedTokenAddressSync(distributorW.data.mint, kpTwo.publicKey)
    );
    let oldBalance3 = await getAccount(
      provider.connection,
      getAssociatedTokenAddressSync(distributorW.data.mint, kpThree.publicKey)
    );

    /*
      UPDATE TREE - EXTRA CLAIMS FOR USERS 1 AND 2
    */

    let treeUpdated = new BalanceTree([
      {
        account: kpOne.publicKey,
        amount: claimAmountOne.add(new anchor.BN(100)),
      },
      {
        account: kpTwo.publicKey,
        amount: claimAmountTwo.add(new anchor.BN(50)),
      },
      { account: kpThree.publicKey, amount: claimAmountThree },
    ]);

    const admin = (provider.wallet as anchor.Wallet).payer;
    await distributorW.update({
      root: treeUpdated.getRoot(),
      maxTotalClaim: MAX_TOTAL_CLAIM,
      maxNumNodes: MAX_NUM_NODES,
      adminAuth: admin,
    });

    await distributorW.reload();

    await distributorW.claim(STAKE_ONLY_PROGRAM_ID, {
      index: new anchor.BN(0),
      amount: claimAmountOne.add(new anchor.BN(100)),
      proof: treeUpdated.getProof(
        0,
        kpOne.publicKey,
        claimAmountOne.add(new anchor.BN(100))
      ),
      claimant: kpOne.publicKey,
      signers: [kpOne],
    });

    await distributorW.claim(STAKE_ONLY_PROGRAM_ID, {
      index: new anchor.BN(1),
      amount: claimAmountTwo.add(new anchor.BN(50)),
      proof: treeUpdated.getProof(
        1,
        kpTwo.publicKey,
        claimAmountTwo.add(new anchor.BN(50))
      ),
      claimant: kpTwo.publicKey,
      signers: [kpTwo],
    });

    try {
      await distributorW.claim(STAKE_ONLY_PROGRAM_ID, {
        index: new anchor.BN(2),
        amount: claimAmountThree,
        proof: treeUpdated.getProof(2, kpThree.publicKey, claimAmountThree),
        claimant: kpThree.publicKey,
        signers: [kpThree],
      });
    } catch (e) {
      assert.equal(e.msg, "no claimable amount");
    }

    /*
      UPDATE TREE - EXTRA CLAIMS FOR USERS 2 AND 3
    */
    treeUpdated = new BalanceTree([
      {
        account: kpOne.publicKey,
        amount: claimAmountOne.sub(new anchor.BN(10)),
      },
      {
        account: kpTwo.publicKey,
        amount: claimAmountTwo.add(new anchor.BN(500)),
      },
      {
        account: kpThree.publicKey,
        amount: claimAmountThree.add(new anchor.BN(80)),
      },
    ]);

    await distributorW.update({
      root: treeUpdated.getRoot(),
      maxTotalClaim: MAX_TOTAL_CLAIM,
      maxNumNodes: MAX_NUM_NODES,
      adminAuth: admin,
    });

    await distributorW.reload();

    try {
      await distributorW.claim(STAKE_ONLY_PROGRAM_ID, {
        index: new anchor.BN(0),
        amount: claimAmountOne.sub(new anchor.BN(10)),
        proof: treeUpdated.getProof(
          0,
          kpOne.publicKey,
          claimAmountOne.sub(new anchor.BN(10))
        ),
        claimant: kpOne.publicKey,
        signers: [kpOne],
      });
      throw Error("Should not succeed");
    } catch (e) {
      assert.equal(e.msg, "no claimable amount");
    }

    await distributorW.claim(STAKE_ONLY_PROGRAM_ID, {
      index: new anchor.BN(1),
      amount: claimAmountTwo.add(new anchor.BN(500)),
      proof: treeUpdated.getProof(
        1,
        kpTwo.publicKey,
        claimAmountTwo.add(new anchor.BN(500))
      ),
      claimant: kpTwo.publicKey,
      signers: [kpTwo],
    });

    await distributorW.claim(STAKE_ONLY_PROGRAM_ID, {
      index: new anchor.BN(2),
      amount: claimAmountThree.add(new anchor.BN(80)),
      proof: treeUpdated.getProof(
        2,
        kpThree.publicKey,
        claimAmountThree.add(new anchor.BN(80))
      ),
      claimant: kpThree.publicKey,
      signers: [kpThree],
    });

    expectedTotalClaimed = new anchor.BN(100 + 50 + 450 + 80);
    tokenAccountInfo = await getAccount(
      provider.connection,
      distributorW.distributorATA
    );
    assert.equal(
      tokenAccountInfo.amount.toString(),
      MAX_TOTAL_CLAIM.sub(oldTotalClaimed).sub(expectedTotalClaimed).toString()
    );

    await distributorW.reload();
    assert.equal(distributorW.data.numNodesClaimed.toNumber(), 2);
    assert.equal(
      distributorW.data.totalAmountClaimed.toString(),
      expectedTotalClaimed.add(oldTotalClaimed).toString()
    );

    let newBalance1 = await getAccount(
      provider.connection,
      getAssociatedTokenAddressSync(distributorW.data.mint, kpOne.publicKey)
    );
    let newBalance2 = await getAccount(
      provider.connection,
      getAssociatedTokenAddressSync(distributorW.data.mint, kpTwo.publicKey)
    );
    let newBalance3 = await getAccount(
      provider.connection,
      getAssociatedTokenAddressSync(distributorW.data.mint, kpThree.publicKey)
    );

    assert.equal(newBalance1.amount - oldBalance1.amount, BigInt(100));
    assert.equal(newBalance2.amount - oldBalance2.amount, BigInt(500));
    assert.equal(newBalance3.amount - oldBalance3.amount, BigInt(80));
  });
});
