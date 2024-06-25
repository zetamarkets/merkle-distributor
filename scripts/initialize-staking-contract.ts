import { state as State } from "../deps/zeta-staking/src/state";
import { Network } from "../deps/zeta-staking/src/types";
import { commitmentConfig } from "../deps/zeta-staking/src/utils";

import * as anchor from "@coral-xyz/anchor";
import { Keypair, Connection } from "@solana/web3.js";

import adminPrivateKey from "../deps/zeta-staking/zeta-staking-mainnet-auth.json";

const ADMIN_KP = Keypair.fromSecretKey(Buffer.from(adminPrivateKey));

const CX = new Connection(
  "https://zeta.rpcpool.com/7d48e129-e378-441c-8bff-a712b2e6ea2c",
  "confirmed"
);

const EPOCH_DURATION_SECONDS = 10; // 1 day
const MAX_N_EPOCHS = 1460;
const MIN_STAKE_DURATION_EPOCHS = 30; // 30 days

async function main() {
  await State.load(
    Network.MAINNET,
    CX,
    commitmentConfig("confirmed"),
    new anchor.Wallet(ADMIN_KP)
  );

  console.log(State.program.programId);

  try {
    await State.initializeProtocolState(
      EPOCH_DURATION_SECONDS,
      MAX_N_EPOCHS,
      MIN_STAKE_DURATION_EPOCHS
    );
  } catch (e) {
    console.log(e);
  }

  await State.fetchProtocolState();

  console.log(State.protocolState);
}

main();
