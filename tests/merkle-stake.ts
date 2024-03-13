import * as anchor from "@coral-xyz/anchor";
import { ZetaStaking } from "../deps/zeta-staking/target/types/zeta_staking";
import idl from "../deps/zeta-staking/target/idl/zeta_staking.json";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import {
  logProtocolState,
  testSetup,
  objectEquals,
} from "../deps/zeta-staking/tests/utils";

import { assert } from "chai";

import { BalanceTree } from "../src/utils";
import { makeSDK, createAndSeedDistributor } from "./utils";

describe("merkle stake", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider();

  const zetaStakingProgram = new anchor.Program<ZetaStaking>(
    idl as unknown as ZetaStaking,
    new PublicKey("8bk6VdmdDnfrq5DeZz8gBzAgffEoc7C51SqXJnxmuSFV"),
    provider
  );

  const EPOCH_DURATION_SECONDS = 5;
  const MIN_STAKE_DURATION_EPOCHS = 1;
  const LOCKUP_AMT = 100;
  const LOCKUP_EPOCHS = 5;

  const mintAdminKp = anchor.web3.Keypair.generate();
  const userKp = anchor.web3.Keypair.generate();
  const zetaMintKp = anchor.web3.Keypair.generate();

  let TEST_KEYS: {
    zetaMint: anchor.web3.PublicKey;
    userZetaAta: anchor.web3.PublicKey;
    protocolState: anchor.web3.PublicKey;
    stakeAccManager: anchor.web3.PublicKey;
    stakeAccs: anchor.web3.PublicKey[];
    stakeVaults: anchor.web3.PublicKey[];
    updateStakeAccCtxs: any[];
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
    TEST_KEYS = await testSetup(
      provider.connection,
      zetaStakingProgram,
      EPOCH_DURATION_SECONDS,
      LOCKUP_EPOCHS,
      MIN_STAKE_DURATION_EPOCHS,
      mintAdminKp,
      userKp,
      zetaMintKp,
      LOCKUP_AMT * 2,
      2
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
      TEST_KEYS.zetaMint,
      mintAdminKp
    );
    DISTRIBUTOR_KEY = distributorKey;
  });

  it("create stakeAcc0 @ epoch 1 with 100 tokens", async () => {
    await zetaStakingProgram.methods
      .stake(0, LOCKUP_EPOCHS, new anchor.BN(LOCKUP_AMT), "test0")
      .accounts({
        protocolState: TEST_KEYS.protocolState,
        zetaTokenAccount: TEST_KEYS.userZetaAta,
        stakeAccountManager: TEST_KEYS.stakeAccManager,
        stakeAccount: TEST_KEYS.stakeAccs[0],
        stakeVault: TEST_KEYS.stakeVaults[0],
        authority: userKp.publicKey,
        zetaMint: TEST_KEYS.zetaMint,
      })
      .signers([userKp])
      .rpc();

    let psAcc = await zetaStakingProgram.account.protocolState.fetch(
      TEST_KEYS.protocolState
    );
    logProtocolState(psAcc);
    let stakeAcc = await zetaStakingProgram.account.stakeAccount.fetch(
      TEST_KEYS.stakeAccs[0]
    );
    assert.equal(stakeAcc.amountStillStaked.toNumber(), LOCKUP_AMT);
    assert.equal(stakeAcc.initialStakeAmount.toNumber(), LOCKUP_AMT);
    assert.equal(stakeAcc.stakeDurationEpochs, LOCKUP_EPOCHS);
    assert.ok(objectEquals(stakeAcc.stakeState, { locked: {} }));

    let ataAcc = await getAccount(provider.connection, TEST_KEYS.userZetaAta);
    assert.equal(Number(ataAcc.amount), 100);
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

    let stakeAccountManager = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("stake-account-manager")),
        airdropUser0.publicKey.toBuffer(),
      ],
      zetaStakingProgram.programId
    )[0];

    await zetaStakingProgram.methods
      .initStakeAccountManager()
      .accounts({
        stakeAccountManager,
        authority: airdropUser0.publicKey,
      })
      .signers([airdropUser0])
      .rpc();

    let stakeAccount = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("stake-account")),
        airdropUser0.publicKey.toBuffer(),
        Uint8Array.from([0]),
      ],
      zetaStakingProgram.programId
    )[0];
    let stakeVault = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("stake-vault")),
        stakeAccount.toBuffer(),
      ],
      zetaStakingProgram.programId
    )[0];
    let zetaAirdropUser0Accs = {
      zetaStaking: zetaStakingProgram.programId,
      protocolState: TEST_KEYS.protocolState,
      stakeAccountManager,
      stakeAccount,
      stakeVault,
      zetaMint: TEST_KEYS.zetaMint,
    };

    await distributorW.claimStake(
      {
        index: new anchor.BN(0),
        amount: claimAmount0,
        proof,
        claimant: airdropUser0.publicKey,
        signers: [airdropUser0],
      },
      zetaAirdropUser0Accs,
      0,
      "cpi_test"
    );

    let airdropU0StakeAccount =
      await zetaStakingProgram.account.stakeAccount.fetch(
        zetaAirdropUser0Accs.stakeAccount
      );
    assert.equal(
      String.fromCharCode(...airdropU0StakeAccount.name).replace(/\0/g, ""),
      "cpi_test"
    );
    assert.equal(airdropU0StakeAccount.amountStillStaked.toNumber(), 400);
    assert.equal(
      airdropU0StakeAccount.amountStillStaked.toNumber(),
      airdropU0StakeAccount.initialStakeAmount.toNumber()
    );
    assert.equal(airdropU0StakeAccount.stakeDurationEpochs, LOCKUP_EPOCHS);
    assert.equal(
      airdropU0StakeAccount.authority.toString(),
      airdropUser0.publicKey.toString()
    );

    let stakeAccountManager1 = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("stake-account-manager")),
        airdropUser1.publicKey.toBuffer(),
      ],
      zetaStakingProgram.programId
    )[0];
    await zetaStakingProgram.methods
      .initStakeAccountManager()
      .accounts({
        stakeAccountManager: stakeAccountManager1,
        authority: airdropUser1.publicKey,
      })
      .signers([airdropUser1])
      .rpc();

    let stakeAccount1 = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("stake-account")),
        airdropUser1.publicKey.toBuffer(),
        Uint8Array.from([0]),
      ],
      zetaStakingProgram.programId
    )[0];
    let stakeVault1 = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("stake-vault")),
        stakeAccount1.toBuffer(),
      ],
      zetaStakingProgram.programId
    )[0];
    let zetaAirdropUser1Accs = {
      zetaStaking: zetaStakingProgram.programId,
      protocolState: TEST_KEYS.protocolState,
      stakeAccountManager: stakeAccountManager1,
      stakeAccount: stakeAccount1,
      stakeVault: stakeVault1,
      zetaMint: TEST_KEYS.zetaMint,
    };
    const proof1 = tree.getProof(1, airdropUser1.publicKey, claimAmount1);
    await distributorW.claimStake(
      {
        index: new anchor.BN(1),
        amount: claimAmount1,
        proof: proof1,
        claimant: airdropUser1.publicKey,
        signers: [airdropUser1],
      },
      zetaAirdropUser1Accs,
      0,
      "cpi_test1"
    );

    let airdropU1StakeAccount =
      await zetaStakingProgram.account.stakeAccount.fetch(
        zetaAirdropUser1Accs.stakeAccount
      );
    assert.equal(
      String.fromCharCode(...airdropU1StakeAccount.name).replace(/\0/g, ""),
      "cpi_test1"
    );
    assert.equal(airdropU1StakeAccount.amountStillStaked.toNumber(), 567);
    assert.equal(
      airdropU1StakeAccount.amountStillStaked.toNumber(),
      airdropU1StakeAccount.initialStakeAmount.toNumber()
    );
    assert.equal(airdropU1StakeAccount.stakeDurationEpochs, LOCKUP_EPOCHS);
    assert.equal(
      airdropU1StakeAccount.authority.toString(),
      airdropUser1.publicKey.toString()
    );
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
