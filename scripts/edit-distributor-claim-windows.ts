import * as anchor from "@coral-xyz/anchor";
import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import adminPrivateKey from "./test-airdrop-admin.json";
import { MerkleDistributorSDK } from "../src";

import {
  TEST_BASE_DISTRIBUTOR_KEYS,
  TEST_COMMUNITY_DISTRIBUTOR_KEYS,
} from "../src";
const ADMIN_KP = Keypair.fromSecretKey(Buffer.from(adminPrivateKey));
const CX = new Connection(
  "https://zeta.rpcpool.com/7d48e129-e378-441c-8bff-a712b2e6ea2c",
  "confirmed"
);

const CLAIM_START_TS = new anchor.BN(1716595200); // May 25 00:00
const FULL_CLAIM_FROM = new anchor.BN(1717286400); // June 2 00:00
const CLAIM_END_TS = new anchor.BN(1717545600); // June 5 00:00
const immediateClaimPercentage = 50; // Linearly scale up from 50%

async function main() {
  const provider = new anchor.AnchorProvider(
    CX,
    new anchor.Wallet(ADMIN_KP),
    {}
  );

  const merkleSdk = MerkleDistributorSDK.load({ provider });

  await Promise.all(
    Object.entries(TEST_BASE_DISTRIBUTOR_KEYS).map(
      async ([shardChar, distributorKey]) => {
        const distributorW = await merkleSdk.loadDistributor(
          new PublicKey(distributorKey)
        );

        const laterClaimOffsetSeconds = FULL_CLAIM_FROM.sub(CLAIM_START_TS);

        if (
          distributorW.data.claimStartTs.toNumber() !=
            CLAIM_START_TS.toNumber() ||
          distributorW.data.claimEndTs.toNumber() != CLAIM_END_TS.toNumber()
        ) {
          console.log(
            `shardchar: ${shardChar}, distributorkey: ${distributorKey}, updateClaimWindow`
          );
          await distributorW.updateClaimWindow({
            claimStartTs: CLAIM_START_TS,
            claimEndTs: CLAIM_END_TS,
            adminAuth: ADMIN_KP,
          });
        }

        if (
          distributorW.data.immediateClaimPercentage.toNumber() !=
            immediateClaimPercentage * 1_000000 ||
          distributorW.data.laterClaimOffsetSeconds.toNumber() !=
            laterClaimOffsetSeconds.toNumber()
        ) {
          console.log(
            `shardchar: ${shardChar}, distributorkey: ${distributorKey}, update claim percentages and offset seconds`
          );
          await distributorW.updateDistributorClaimPercentage({
            immediateClaimPercentage: new anchor.BN(
              immediateClaimPercentage * 1_000000
            ),
            laterClaimOffsetSeconds,
            adminAuth: ADMIN_KP,
          });
        }
      }
    )
  );

  console.log("Doing community trees now");

  await Promise.all(
    Object.entries(TEST_COMMUNITY_DISTRIBUTOR_KEYS).map(
      async ([shardChar, distributorKey]) => {
        const distributorW = await merkleSdk.loadDistributor(
          new PublicKey(distributorKey)
        );

        if (
          distributorW.data.claimStartTs.toNumber() !=
            CLAIM_START_TS.toNumber() ||
          distributorW.data.claimEndTs.toNumber() != CLAIM_END_TS.toNumber()
        ) {
          console.log(
            `shardchar: ${shardChar}, distributorkey: ${distributorKey}, updateClaimWindow`
          );
          await distributorW.updateClaimWindow({
            claimStartTs: CLAIM_START_TS,
            claimEndTs: CLAIM_END_TS,
            adminAuth: ADMIN_KP,
          });
        }

        if (
          distributorW.data.immediateClaimPercentage.toNumber() != 100_000000 ||
          distributorW.data.laterClaimOffsetSeconds.toNumber() != 0
        ) {
          console.log(
            `shardchar: ${shardChar}, distributorkey: ${distributorKey}, update claim percentages and offset seconds`
          );
          await distributorW.updateDistributorClaimPercentage({
            immediateClaimPercentage: new anchor.BN(100 * 1_000000),
            laterClaimOffsetSeconds: new anchor.BN(0),
            adminAuth: ADMIN_KP,
          });
        }
      }
    )
  );
}

main();
