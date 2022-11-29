import { chaiSolana, expectTX } from "@saberhq/chai-solana";
import {
  getATAAddress,
  getTokenAccount,
  u64,
  ZERO,
} from "@saberhq/token-utils";
import { Wallet } from "@project-serum/anchor";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import chai, { expect } from "chai";
import { MerkleDistributorErrors } from "../src/idls/merkle_distributor";

import { BalanceTree } from "../src/utils";
import {
  createAndSeedDistributor,
  createKeypairWithSOL,
  makeSDK,
} from "./testutils";

chai.use(chaiSolana);

const MAX_NUM_NODES = new u64(3);
const MAX_TOTAL_CLAIM = new u64(1_000_000_000_000);
const ZERO_BYTES32 = Buffer.alloc(32);

describe("merkle-distributor", () => {
  const sdk = makeSDK();
  const { provider } = sdk;

  it("Is initialized!", async () => {
    const { pendingDistributor, mint } = await createAndSeedDistributor(
      sdk,
      MAX_TOTAL_CLAIM,
      MAX_NUM_NODES,
      ZERO_BYTES32
    );
    const { distributor, base, bump } = pendingDistributor;
    const distributorW = await sdk.loadDistributor(distributor);

    const { data } = distributorW;
    expect(data.bump).to.equal(bump);
    expect(data.maxNumNodes.toString()).to.equal(MAX_NUM_NODES.toString());
    expect(data.maxTotalClaim.toString()).to.equal(MAX_TOTAL_CLAIM.toString());
    expect(data.base).to.eqAddress(base);
    expect(data.mint).to.eqAddress(mint);
    expect(data.numNodesClaimed.toString()).to.equal(ZERO.toString());
    expect(data.root).to.deep.equal(Array.from(new Uint8Array(ZERO_BYTES32)));
    expect(data.totalAmountClaimed.toString()).to.equal(ZERO.toString());

    const tokenAccountInfo = await getTokenAccount(
      provider,
      distributorW.distributorATA
    );
    expect(tokenAccountInfo.mint).to.eqAddress(mint);
    expect(tokenAccountInfo.amount.toString()).to.equal(
      MAX_TOTAL_CLAIM.toString()
    );
  });

  context("claim", () => {
    it("fails for empty proof", async () => {
      const claimantKP = Keypair.generate();
      await provider.connection.requestAirdrop(
        claimantKP.publicKey,
        LAMPORTS_PER_SOL
      );

      const { distributor } = await createAndSeedDistributor(
        sdk,
        MAX_TOTAL_CLAIM,
        MAX_NUM_NODES,
        ZERO_BYTES32
      );
      const distributorW = await sdk.loadDistributor(distributor);

      const tx = await distributorW.claim({
        index: new u64(0),
        amount: new u64(10_000_000),
        proof: [],
        claimant: claimantKP.publicKey,
      });
      tx.addSigners(claimantKP);

      try {
        await tx.confirm();
      } catch (e) {
        const err = e as Error;
        expect(err.message).to.include(
          `0x${MerkleDistributorErrors.InvalidProof.code.toString(16)}`
        );
      }
    });

    it("success on three account tree", async () => {
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

      const claimAmountOne = new u64(100);
      const claimAmountTwo = new u64(101);
      const claimAmountThree = new u64(102);
      const tree = new BalanceTree([
        { account: kpOne.publicKey, amount: claimAmountOne },
        { account: kpTwo.publicKey, amount: claimAmountTwo },
        { account: kpThree.publicKey, amount: claimAmountThree },
      ]);
      const { distributor } = await createAndSeedDistributor(
        sdk,
        MAX_TOTAL_CLAIM,
        MAX_NUM_NODES,
        tree.getRoot()
      );

      const distributorW = await sdk.loadDistributor(distributor);
      await Promise.all(
        allKps.map(async (kp, index) => {
          const amount = new u64(100 + index);
          const proof = tree.getProof(index, kp.publicKey, amount);

          const tx = await distributorW.claim({
            index: new u64(index),
            amount,
            proof,
            claimant: kp.publicKey,
          });
          tx.addSigners(kp);
          await expectTX(tx, `claim tokens; index ${index}`).to.be.fulfilled;

          const tokenAccountInfo = await getTokenAccount(
            provider,
            await getATAAddress({
              mint: distributorW.data.mint,
              owner: kp.publicKey,
            })
          );
          expect(tokenAccountInfo.amount.toString()).to.equal(
            amount.toString()
          );

          const claimStatus = await distributorW.getClaimStatus(kp.publicKey);
          expect(claimStatus.claimant).to.eqAddress(kp.publicKey);
          expect(claimStatus.claimedAmount.toString()).to.equal(
            amount.toString()
          );
        })
      );

      const expectedTotalClaimed = claimAmountOne
        .add(claimAmountTwo)
        .add(claimAmountThree);
      const tokenAccountInfo = await getTokenAccount(
        provider,
        distributorW.distributorATA
      );
      expect(tokenAccountInfo.amount.toString()).to.equal(
        MAX_TOTAL_CLAIM.sub(expectedTotalClaimed).toString()
      );

      await distributorW.reload();
      const { data } = distributorW;
      expect(data.numNodesClaimed.toNumber()).to.equal(allKps.length);
      expect(data.totalAmountClaimed.toString()).to.equal(
        expectedTotalClaimed.toString()
      );
    });

    it("cannot claim more than proof", async () => {
      const userKP = await createKeypairWithSOL(provider);

      const claimAmount = new u64(1_000_000);
      const tree = new BalanceTree([
        { account: userKP.publicKey, amount: new u64(1_000_000) },
      ]);
      const { distributor } = await createAndSeedDistributor(
        sdk,
        MAX_TOTAL_CLAIM,
        MAX_NUM_NODES,
        tree.getRoot()
      );
      const distributorW = await sdk.loadDistributor(distributor);

      const tx = await distributorW.claim({
        index: new u64(0),
        amount: new u64(2_000_000),
        proof: tree.getProof(0, userKP.publicKey, claimAmount),
        claimant: userKP.publicKey,
      });
      tx.addSigners(userKP);

      try {
        await tx.confirm();
      } catch (e) {
        const err = e as Error;
        expect(err.message).to.include(
          `0x${MerkleDistributorErrors.InvalidProof.code.toString(16)}`
        );
      }
    });

    it("cannot claim for address other than proof", async () => {
      const claimant = Keypair.generate().publicKey;
      const rogueKP = await createKeypairWithSOL(provider);

      const claimAmount = new u64(1_000_000);
      const tree = new BalanceTree([
        { account: claimant, amount: claimAmount },
      ]);
      const { distributor } = await createAndSeedDistributor(
        sdk,
        MAX_TOTAL_CLAIM,
        MAX_NUM_NODES,
        tree.getRoot()
      );
      const distributorW = await sdk.loadDistributor(distributor);

      const tx = await distributorW.claim({
        index: new u64(0),
        amount: new u64(2_000_000),
        proof: tree.getProof(0, claimant, claimAmount),
        claimant,
      });
      tx.addSigners(rogueKP);

      try {
        await tx.confirm();
      } catch (e) {
        const err = e as Error;
        expect(err.message).to.equal(
          `unknown signer: ${rogueKP.publicKey.toString()}`
        );
      }
    });

    it("update tree", async () => {
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

      const claimAmountOne = new u64(100);
      const claimAmountTwo = new u64(101);
      const claimAmountThree = new u64(102);
      const tree = new BalanceTree([
        { account: kpOne.publicKey, amount: claimAmountOne },
        { account: kpTwo.publicKey, amount: claimAmountTwo },
        { account: kpThree.publicKey, amount: claimAmountThree },
      ]);
      const { distributor } = await createAndSeedDistributor(
        sdk,
        MAX_TOTAL_CLAIM,
        MAX_NUM_NODES,
        tree.getRoot()
      );

      const distributorW = await sdk.loadDistributor(distributor);
      await Promise.all(
        allKps.map(async (kp, index) => {
          const amount = new u64(100 + index);
          const proof = tree.getProof(index, kp.publicKey, amount);

          const tx = await distributorW.claim({
            index: new u64(index),
            amount,
            proof,
            claimant: kp.publicKey,
          });
          tx.addSigners(kp);
          await expectTX(tx, `claim tokens; index ${index}`).to.be.fulfilled;

          const tokenAccountInfo = await getTokenAccount(
            provider,
            await getATAAddress({
              mint: distributorW.data.mint,
              owner: kp.publicKey,
            })
          );
          expect(tokenAccountInfo.amount.toString()).to.equal(
            amount.toString()
          );

          const claimStatus = await distributorW.getClaimStatus(kp.publicKey);
          expect(claimStatus.claimant).to.eqAddress(kp.publicKey);
          expect(claimStatus.claimedAmount.toString()).to.equal(
            amount.toString()
          );
        })
      );

      let expectedTotalClaimed = claimAmountOne
        .add(claimAmountTwo)
        .add(claimAmountThree);
      let tokenAccountInfo = await getTokenAccount(
        provider,
        distributorW.distributorATA
      );
      expect(tokenAccountInfo.amount.toString()).to.equal(
        MAX_TOTAL_CLAIM.sub(expectedTotalClaimed).toString()
      );

      await distributorW.reload();
      let { data } = distributorW;
      expect(data.numNodesClaimed.toNumber()).to.equal(allKps.length);
      expect(data.totalAmountClaimed.toString()).to.equal(
        expectedTotalClaimed.toString()
      );

      let oldTotalClaimed = expectedTotalClaimed;

      let oldBalance1 = await getTokenAccount(
        provider,
        await getATAAddress({
          mint: distributorW.data.mint,
          owner: kpOne.publicKey,
        })
      );
      let oldBalance2 = await getTokenAccount(
        provider,
        await getATAAddress({
          mint: distributorW.data.mint,
          owner: kpTwo.publicKey,
        })
      );
      let oldBalance3 = await getTokenAccount(
        provider,
        await getATAAddress({
          mint: distributorW.data.mint,
          owner: kpThree.publicKey,
        })
      );

      /*
        UPDATE TREE - EXTRA CLAIMS FOR USERS 1 AND 2
      */

      let treeUpdated = new BalanceTree([
        { account: kpOne.publicKey, amount: claimAmountOne.add(new u64(100)) },
        { account: kpTwo.publicKey, amount: claimAmountTwo.add(new u64(50)) },
        { account: kpThree.publicKey, amount: claimAmountThree },
      ]);

      const admin = (provider.wallet as Wallet).payer;
      let tx = await distributorW.update({
        root: treeUpdated.getRoot(),
        maxTotalClaim: MAX_TOTAL_CLAIM,
        maxNumNodes: MAX_NUM_NODES,
        adminAuth: admin,
      });
      tx.addSigners(admin);
      await expectTX(tx, `update tree`).to.be.fulfilled;

      await distributorW.reload();

      let claimTx1 = await distributorW.claim({
        index: new u64(0),
        amount: claimAmountOne.add(new u64(100)),
        proof: treeUpdated.getProof(
          0,
          kpOne.publicKey,
          claimAmountOne.add(new u64(100))
        ),
        claimant: kpOne.publicKey,
      });
      claimTx1.addSigners(kpOne);

      await expectTX(claimTx1, `claim tokens; index ${0}`).to.be.fulfilled;

      let claimTx2 = await distributorW.claim({
        index: new u64(1),
        amount: claimAmountTwo.add(new u64(50)),
        proof: treeUpdated.getProof(
          1,
          kpTwo.publicKey,
          claimAmountTwo.add(new u64(50))
        ),
        claimant: kpTwo.publicKey,
      });
      claimTx2.addSigners(kpTwo);
      await expectTX(claimTx2, `claim tokens; index ${1}`).to.be.fulfilled;

      let claimTx3 = await distributorW.claim({
        index: new u64(2),
        amount: claimAmountThree,
        proof: treeUpdated.getProof(2, kpThree.publicKey, claimAmountThree),
        claimant: kpThree.publicKey,
      });
      claimTx3.addSigners(kpThree);

      try {
        await claimTx3.confirm();
      } catch (e) {
        const err = e as Error;
        expect(err.message).to.include(
          `0x${MerkleDistributorErrors.NoClaimableAmount.code.toString(16)}`
        );
      }

      /*
        UPDATE TREE - EXTRA CLAIMS FOR USERS 2 AND 3
      */
      treeUpdated = new BalanceTree([
        { account: kpOne.publicKey, amount: claimAmountOne.sub(new u64(10)) },
        { account: kpTwo.publicKey, amount: claimAmountTwo.add(new u64(500)) },
        {
          account: kpThree.publicKey,
          amount: claimAmountThree.add(new u64(80)),
        },
      ]);

      tx = await distributorW.update({
        root: treeUpdated.getRoot(),
        maxTotalClaim: MAX_TOTAL_CLAIM,
        maxNumNodes: MAX_NUM_NODES,
        adminAuth: admin,
      });
      tx.addSigners(admin);
      await expectTX(tx, `update tree`).to.be.fulfilled;

      await distributorW.reload();

      claimTx1 = await distributorW.claim({
        index: new u64(0),
        amount: claimAmountOne.sub(new u64(10)),
        proof: treeUpdated.getProof(
          0,
          kpOne.publicKey,
          claimAmountOne.sub(new u64(10))
        ),
        claimant: kpOne.publicKey,
      });
      claimTx1.addSigners(kpOne);

      try {
        await claimTx3.confirm();
      } catch (e) {
        const err = e as Error;
        expect(err.message).to.include(
          `0x${MerkleDistributorErrors.NoClaimableAmount.code.toString(16)}`
        );
      }

      claimTx2 = await distributorW.claim({
        index: new u64(1),
        amount: claimAmountTwo.add(new u64(500)),
        proof: treeUpdated.getProof(
          1,
          kpTwo.publicKey,
          claimAmountTwo.add(new u64(500))
        ),
        claimant: kpTwo.publicKey,
      });
      claimTx2.addSigners(kpTwo);
      await expectTX(claimTx2, `claim tokens; index ${1}`).to.be.fulfilled;

      claimTx3 = await distributorW.claim({
        index: new u64(2),
        amount: claimAmountThree.add(new u64(80)),
        proof: treeUpdated.getProof(
          2,
          kpThree.publicKey,
          claimAmountThree.add(new u64(80))
        ),
        claimant: kpThree.publicKey,
      });
      claimTx3.addSigners(kpThree);

      await expectTX(claimTx3, `claim tokens; index ${2}`).to.be.fulfilled;

      expectedTotalClaimed = new u64(100 + 50 + 450 + 80);
      tokenAccountInfo = await getTokenAccount(
        provider,
        distributorW.distributorATA
      );
      expect(tokenAccountInfo.amount.toString()).to.equal(
        MAX_TOTAL_CLAIM.sub(oldTotalClaimed)
          .sub(expectedTotalClaimed)
          .toString()
      );

      await distributorW.reload();
      expect(distributorW.data.numNodesClaimed.toNumber()).to.equal(2);
      expect(distributorW.data.totalAmountClaimed.toString()).to.equal(
        expectedTotalClaimed.add(oldTotalClaimed).toString()
      );

      let newBalance1 = await getTokenAccount(
        provider,
        await getATAAddress({
          mint: distributorW.data.mint,
          owner: kpOne.publicKey,
        })
      );
      let newBalance2 = await getTokenAccount(
        provider,
        await getATAAddress({
          mint: distributorW.data.mint,
          owner: kpTwo.publicKey,
        })
      );
      let newBalance3 = await getTokenAccount(
        provider,
        await getATAAddress({
          mint: distributorW.data.mint,
          owner: kpThree.publicKey,
        })
      );
      expect(
        newBalance1.amount.toNumber() - oldBalance1.amount.toNumber() == 100
      );
      expect(
        newBalance2.amount.toNumber() - oldBalance2.amount.toNumber() == 500
      );
      expect(
        newBalance3.amount.toNumber() - oldBalance3.amount.toNumber() == 80
      );
    });
  });
});
