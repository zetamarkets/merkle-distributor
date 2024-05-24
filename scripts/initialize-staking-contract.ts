import { state as State } from "../deps/zeta-staking/src/state";
import { Network } from "../deps/zeta-staking/src/types";
import { commitmentConfig } from "../deps/zeta-staking/src/utils";

import * as anchor from "@coral-xyz/anchor";
import { Keypair, Connection } from "@solana/web3.js";

import adminPrivateKey from "./test-airdrop-admin.json";
import mintPrivateKey from "./test-mint.json";

const ADMIN_KP = Keypair.fromSecretKey(Buffer.from(adminPrivateKey));
const MINT_KP = Keypair.fromSecretKey(Buffer.from(mintPrivateKey));
const CX = new Connection(
  "https://zeta.rpcpool.com/7d48e129-e378-441c-8bff-a712b2e6ea2c",
  "confirmed"
);

const EPOCH_DURATION_SECONDS = 3600; // 1 hour
const MAX_N_EPOCHS = 1460;
const MIN_STAKE_DURATION_EPOCHS = 12; // 12 hours

async function main() {
  await State.load(
    Network.MAINNET,
    CX,
    commitmentConfig("confirmed"),
    new anchor.Wallet(ADMIN_KP)
  );

  await State.initializeProtocolState(
    EPOCH_DURATION_SECONDS,
    MAX_N_EPOCHS,
    MIN_STAKE_DURATION_EPOCHS
  );
  await State.fetchProtocolState();

  console.log(State.protocolState);
}

main();
