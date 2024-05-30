import * as anchor from "@coral-xyz/anchor";
import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

import adminPrivateKey from "./test-airdrop-admin.json";
import mintPrivateKey from "./test-mint.json";

import {
  MerkleDistributorSDK,
  MerkleDistributorWrapper,
  findDistributorKey,
} from "../src";
import { BalanceTree } from "../src/utils";
import {
  getAccount,
  getAssociatedTokenAddressSync,
  transfer,
} from "@solana/spl-token";

const ADMIN_KP = Keypair.fromSecretKey(Buffer.from(adminPrivateKey));
const MINT_KP = Keypair.fromSecretKey(Buffer.from(mintPrivateKey));
const CX = new Connection(
  "https://zeta.rpcpool.com/7d48e129-e378-441c-8bff-a712b2e6ea2c",
  "confirmed"
);

const CLAIM_START_TS = new anchor.BN(1716681600); // May 26 00:00
const FULL_CLAIM_FROM = new anchor.BN(1716681600); // June 2 00:00
const CLAIM_END_TS = new anchor.BN(1717545600); // June 5 00:00
const immediateClaimPercentage = 100; // Linearly scale up from 50%

async function main() {
  const provider = new anchor.AnchorProvider(
    CX,
    new anchor.Wallet(ADMIN_KP),
    {}
  );

  const merkleSdk = MerkleDistributorSDK.load({ provider });

  const treesFolderPath = path.resolve(__dirname, "./trees");

  const shardToDo = "5_community";

  const treeFc = fs.readFileSync(`${treesFolderPath}/${shardToDo}.json`, {
    encoding: "utf-8",
  });
  const nonTransformedTree = JSON.parse(treeFc);
  const keypairFc = fs.readFileSync(`${treesFolderPath}/${shardToDo}_kp.json`, {
    encoding: "utf-8",
  });

  const keypair = Keypair.fromSecretKey(Buffer.from(JSON.parse(keypairFc)));
  const transformedTree = nonTransformedTree.map(
    (x: { account: string; amount: number }) => {
      return {
        account: new PublicKey(x.account),
        amount: new anchor.BN(x.amount),
      };
    }
  );
  const bt = new BalanceTree(transformedTree);
  let maxTotalClaim = new anchor.BN(0);
  transformedTree.forEach((x) => {
    maxTotalClaim = maxTotalClaim.add(x.amount);
  });
  let maxNumNodes = new anchor.BN(transformedTree.length);

  const distrbutorKey = findDistributorKey(keypair.publicKey);

  let distributorW: MerkleDistributorWrapper;

  try {
    distributorW = await merkleSdk.loadDistributor(distrbutorKey[0]);
    console.log(
      `${shardToDo} immediateClaimPercentage: ${
        distributorW.data.immediateClaimPercentage.toNumber() / 1_000000
      }`
    );
  } catch (e) {
    console.log(`tree for ${shardToDo} has not been created yet, creating...`);

    await merkleSdk.createDistributor({
      root: bt.getRoot(),
      maxTotalClaim,
      maxNumNodes,
      tokenMint: MINT_KP.publicKey,
      adminAuth: ADMIN_KP,
      base: keypair,
      claimStartTs: CLAIM_START_TS,
      claimEndTs: CLAIM_END_TS,
      stakeClaimOnly: false,
      immediateClaimPercentage: new anchor.BN(
        immediateClaimPercentage * 1_000000
      ),
      laterClaimOffsetSeconds: FULL_CLAIM_FROM.sub(CLAIM_START_TS),
    });

    console.log(`created for ${shardToDo}`);
    distributorW = await merkleSdk.loadDistributor(distrbutorKey[0]);
  }

  try {
    const ataInfo = await getAccount(CX, distributorW.distributorATA);
    if (Number(ataInfo.amount) != maxTotalClaim.toNumber()) {
      let transferAmt = maxTotalClaim.toNumber() - Number(ataInfo.amount);
      console.log(
        `transferring ${transferAmt} tokens to distributor ata: ${distributorW.distributorATA} for ${shardToDo}`
      );
      await transfer(
        CX,
        ADMIN_KP,
        getAssociatedTokenAddressSync(MINT_KP.publicKey, ADMIN_KP.publicKey),
        distributorW.distributorATA,
        ADMIN_KP,
        transferAmt
      );
      console.log(`transferred ${transferAmt} for ${shardToDo}`);
    } else {
      console.log(`distributor ${shardToDo} ata has enough tokens already:`);
    }
  } catch (e) {
    console.log(`failed to transfer for ${shardToDo}, ${e}`);
  }

  console.log(shardToDo, distrbutorKey[0].toString());
}
main();
