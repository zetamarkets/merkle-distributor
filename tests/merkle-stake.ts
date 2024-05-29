import * as anchor from "@coral-xyz/anchor";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { assert } from "chai";

import { BalanceTree } from "../src/utils";
import { makeSDK, createAndSeedDistributor } from "./utils";

import {
  testSetup,
  getAdminKeypair,
  getZetaMintKeypair,
} from "../deps/zeta-staking/tests/test-utils";
import { Client } from "../deps/zeta-staking/src/client";
import { state as State } from "../deps/zeta-staking/src/state";
import { Network } from "../deps/zeta-staking/src/types";
import { commitmentConfig } from "../deps/zeta-staking/src/utils";

describe("merkle stake", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();

  const EPOCH_DURATION_SECONDS = 5;
  const MIN_STAKE_DURATION_EPOCHS = 2;
  const LOCKUP_AMT = 100;
  const LOCKUP_EPOCHS = 5;

  const stakeOnlyUserKp = anchor.web3.Keypair.generate();

  let STAKING_TEST_SETUP: {
    users: Client[];
  };

  const merkleSdk = makeSDK();
  const merkleBase = anchor.web3.Keypair.generate();
  const airdropUser0 = anchor.web3.Keypair.generate();
  const airdropUser1 = anchor.web3.Keypair.generate();
  const unclaimedUser = anchor.web3.Keypair.generate();
  const allAirdropKps = [airdropUser0, airdropUser1];
  let DISTRIBUTOR_KEY: anchor.web3.PublicKey;
  const claimAmount0 = new anchor.BN(400);
  const claimAmount1 = new anchor.BN(567);
  const unclaimedAmount = new anchor.BN(54211);
  const tree = new BalanceTree([
    { account: airdropUser0.publicKey, amount: claimAmount0 },
    { account: airdropUser1.publicKey, amount: claimAmount1 },
    { account: unclaimedUser.publicKey, amount: unclaimedAmount },
  ]);

  before(async () => {
    STAKING_TEST_SETUP = await testSetup(
      provider.connection,
      EPOCH_DURATION_SECONDS,
      LOCKUP_EPOCHS,
      MIN_STAKE_DURATION_EPOCHS,
      [stakeOnlyUserKp],
      LOCKUP_AMT * 2
    );

    await Promise.all(
      allAirdropKps.map(async (kp) => {
        await provider.connection.requestAirdrop(
          kp.publicKey,
          anchor.web3.LAMPORTS_PER_SOL
        );
      })
    );

    let amountToMint = claimAmount0.add(claimAmount1).add(unclaimedAmount);

    let { distributorKey } = await createAndSeedDistributor(
      merkleSdk,
      amountToMint,
      new anchor.BN(3),
      tree.getRoot(),
      merkleBase,
      new anchor.BN(0),
      new anchor.BN(1809635703),
      true,
      new anchor.BN(100),
      new anchor.BN(0),
      getZetaMintKeypair().publicKey,
      getAdminKeypair()
    );
    DISTRIBUTOR_KEY = distributorKey;
  });

  it("create stakeAcc0 @ epoch 1 with 100 tokens", async () => {
    await STAKING_TEST_SETUP.users[0].createAndSendTx([
      await STAKING_TEST_SETUP.users[0].stake(
        LOCKUP_AMT,
        LOCKUP_EPOCHS,
        "test0"
      ),
    ]);
    await STAKING_TEST_SETUP.users[0].fetchUserState();
    let stakeAcc = STAKING_TEST_SETUP.users[0].stakeAccounts.get(0)!;

    assert.equal(stakeAcc.amountStillStaked, LOCKUP_AMT);
    assert.equal(stakeAcc.initialStakeAmount, LOCKUP_AMT);
    assert.equal(stakeAcc.stakeDurationEpochs, LOCKUP_EPOCHS);
    assert.equal(stakeAcc.stakeState, "Locked");
    assert.equal(Number(STAKING_TEST_SETUP.users[0].zetaAta.amount), 100);
  });

  it("Try to claim, must stake claim instead", async () => {
    const proof = tree.getProof(0, airdropUser0.publicKey, claimAmount0);
    const distributorW = await merkleSdk.loadDistributor(DISTRIBUTOR_KEY);

    try {
      await distributorW.claim({
        index: new anchor.BN(0),
        amount: claimAmount0,
        proof,
        claimant: airdropUser0.publicKey,
        signers: [airdropUser0],
      });
      throw Error("Should not succeed");
    } catch (e) {
      assert.equal(e.msg, "Must claim tokens direct to stake");
    }

    const airdropStakeUser0 = await Client.load(
      Network.LOCALNET,
      provider.connection,
      commitmentConfig("confirmed"),
      new anchor.Wallet(airdropUser0)
    );

    const airdropStakeUser1 = await Client.load(
      Network.LOCALNET,
      provider.connection,
      commitmentConfig("confirmed"),
      new anchor.Wallet(airdropUser1)
    );

    await airdropStakeUser0.createAndSendTx([
      await airdropStakeUser0.createStakeAccountManager(),
    ]);

    try {
      await distributorW.claimStake(
        {
          index: new anchor.BN(0),
          amount: claimAmount0,
          proof,
          claimant: airdropUser0.publicKey,
          signers: [airdropUser0],
        },
        {
          zetaStaking: State.program.programId,
          protocolState: State.protocolStateAddress,
          stakeAccountManager: airdropStakeUser0.stakeAccountManagerAddress,
          stakeAccount: airdropStakeUser0.stakeAccountAddresses[0],
          stakeVault: airdropStakeUser0.stakeVaultAddresses[0],
          zetaMint: State.protocolState.zetaMint,
        },
        0,
        "cpi_test",
        1
      );
      throw Error("Should not succeed");
    } catch (e) {
      assert.equal(e.msg, "Invalid stake duration");
    }

    await distributorW.claimStake(
      {
        index: new anchor.BN(0),
        amount: claimAmount0,
        proof,
        claimant: airdropUser0.publicKey,
        signers: [airdropUser0],
      },
      {
        zetaStaking: State.program.programId,
        protocolState: State.protocolStateAddress,
        stakeAccountManager: airdropStakeUser0.stakeAccountManagerAddress,
        stakeAccount: airdropStakeUser0.stakeAccountAddresses[0],
        stakeVault: airdropStakeUser0.stakeVaultAddresses[0],
        zetaMint: State.protocolState.zetaMint,
      },
      0,
      "cpi_test",
      LOCKUP_EPOCHS
    );
    await airdropStakeUser0.fetchUserState();

    const airdropU0StakeAccount = airdropStakeUser0.stakeAccounts.get(0)!;
    assert.equal(airdropU0StakeAccount.name, "cpi_test");
    assert.equal(airdropU0StakeAccount.amountStillStaked, 400);
    assert.equal(airdropU0StakeAccount.initialStakeAmount, 400);
    assert.equal(airdropU0StakeAccount.stakeDurationEpochs, LOCKUP_EPOCHS);
    assert.equal(
      airdropU0StakeAccount.authority.toString(),
      airdropStakeUser0.publicKey.toString()
    );
    assert.equal(airdropU0StakeAccount.stakeState, "Locked");

    await airdropStakeUser1.createAndSendTx([
      await airdropStakeUser1.createStakeAccountManager(),
    ]);

    const proof1 = tree.getProof(1, airdropUser1.publicKey, claimAmount1);
    await distributorW.claimStake(
      {
        index: new anchor.BN(1),
        amount: claimAmount1,
        proof: proof1,
        claimant: airdropUser1.publicKey,
        signers: [airdropUser1],
      },
      {
        zetaStaking: State.program.programId,
        protocolState: State.protocolStateAddress,
        stakeAccountManager: airdropStakeUser1.stakeAccountManagerAddress,
        stakeAccount: airdropStakeUser1.stakeAccountAddresses[0],
        stakeVault: airdropStakeUser1.stakeVaultAddresses[0],
        zetaMint: State.protocolState.zetaMint,
      },
      0,
      "cpi_test1",
      LOCKUP_EPOCHS
    );
    await airdropStakeUser1.fetchUserState();

    const airdropU1StakeAccount = airdropStakeUser1.stakeAccounts.get(0)!;
    assert.equal(airdropU1StakeAccount.name, "cpi_test1");
    assert.equal(airdropU1StakeAccount.amountStillStaked, 567);
    assert.equal(airdropU1StakeAccount.initialStakeAmount, 567);
    assert.equal(airdropU1StakeAccount.stakeDurationEpochs, LOCKUP_EPOCHS);
    assert.equal(
      airdropU1StakeAccount.authority.toString(),
      airdropStakeUser1.publicKey.toString()
    );
    assert.equal(airdropU1StakeAccount.stakeState, "Locked");
  });

  it("claim back unclaimed airdrop after expiry", async () => {
    const distributorW = await merkleSdk.loadDistributor(DISTRIBUTOR_KEY);

    const distributorAdminKp = (
      distributorW.sdk.provider.wallet as anchor.Wallet
    ).payer;
    let ataAcc = await getAccount(
      provider.connection,
      distributorW.distributorATA
    );
    assert.equal(Number(ataAcc.amount), unclaimedAmount.toNumber());

    try {
      await distributorW.adminClaimAfterExpiry(distributorAdminKp);
      throw Error("Shouldn't succeed");
    } catch (e) {
      assert.equal(
        e.msg,
        "Can only admin claim after the claim window is over"
      );
    }

    await distributorW.updateClaimWindow({
      claimStartTs: new anchor.BN(0),
      claimEndTs: new anchor.BN(1000),
      adminAuth: distributorAdminKp,
    });

    await distributorW.adminClaimAfterExpiry(distributorAdminKp);

    ataAcc = await getAccount(provider.connection, distributorW.distributorATA);
    assert.equal(Number(ataAcc.amount), 0);

    let adminAtaAddr = getAssociatedTokenAddressSync(
      distributorW.data.mint,
      distributorAdminKp.publicKey
    );
    let adminAtaAcc = await getAccount(provider.connection, adminAtaAddr);
    assert.equal(Number(adminAtaAcc.amount), unclaimedAmount.toNumber());
  });
});
