import * as anchor from "@coral-xyz/anchor";
import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

import adminPrivateKey from "./test-airdrop-admin.json";
import mintPrivateKey from "./test-mint.json";

import { MerkleDistributorSDK, findDistributorKey } from "../src";
import { Distributor } from "../src";
import { BalanceTree } from "../src/utils";
import { getAssociatedTokenAddressSync, transfer } from "@solana/spl-token";

const ADMIN_KP = Keypair.fromSecretKey(Buffer.from(adminPrivateKey));
const MINT_KP = Keypair.fromSecretKey(Buffer.from(mintPrivateKey));
const CX = new Connection(
  "https://zeta.rpcpool.com/7d48e129-e378-441c-8bff-a712b2e6ea2c",
  "confirmed"
);

const CLAIM_START_TS = new anchor.BN(1716595200); // May 25 00:00
const FULL_CLAIM_FROM = new anchor.BN(1716854400); // May 28 00:00
const CLAIM_END_TS = new anchor.BN(1716940800); // May 29 00:00
const immediateClaimPercentage = 50; // Linearly scale up from 50%

async function main() {
  const provider = new anchor.AnchorProvider(
    CX,
    new anchor.Wallet(ADMIN_KP),
    {}
  );

  const merkleSdk = MerkleDistributorSDK.load({ provider });

  const treesFolderPath = path.resolve(__dirname, "./trees");

  const baseTrees: Map<string, { account: PublicKey; amount: anchor.BN }[]> =
    new Map();
  const baseBaseKps: Map<string, Keypair> = new Map();
  const communityTrees: Map<
    string,
    { account: PublicKey; amount: anchor.BN }[]
  > = new Map();
  const communityBaseKps: Map<string, Keypair> = new Map();
  fs.readdirSync(treesFolderPath).forEach((fileName) => {
    const filePath = path.resolve(__dirname, `./trees/${fileName}`);
    const fileContent = fs.readFileSync(filePath, { encoding: "utf-8" });
    const firstChar = fileName[0];
    if (fileName.includes("base_kp")) {
      baseBaseKps.set(
        firstChar,
        Keypair.fromSecretKey(Buffer.from(JSON.parse(fileContent)))
      );
    } else if (fileName.includes("base")) {
      const nonTransformedTree = JSON.parse(fileContent);
      const transformedTree = nonTransformedTree.map(
        (x: { account: string; amount: number }) => {
          return {
            account: new PublicKey(x.account),
            amount: new anchor.BN(x.amount),
          };
        }
      );
      baseTrees.set(firstChar, transformedTree);
    } else if (fileName.includes("community_kp")) {
      communityBaseKps.set(
        firstChar,
        Keypair.fromSecretKey(Buffer.from(JSON.parse(fileContent)))
      );
    } else if (fileName.includes("community")) {
      const nonTransformedTree = JSON.parse(fileContent);
      const transformedTree = nonTransformedTree.map(
        (x: { account: string; amount: number }) => {
          return {
            account: new PublicKey(x.account),
            amount: new anchor.BN(x.amount),
          };
        }
      );
      communityTrees.set(firstChar, transformedTree);
    }
  });

  let baseDistributorKeys = new Map();

  for (let [shardChar, preTreeArr] of baseTrees.entries()) {
    const tree = new BalanceTree(preTreeArr);

    let maxTotalClaim = new anchor.BN(0);
    preTreeArr.forEach((x) => {
      maxTotalClaim = maxTotalClaim.add(x.amount);
    });
    let maxNumNodes = new anchor.BN(preTreeArr.length);

    const baseKp = baseBaseKps.get(shardChar)!;

    const distrbutorKey = findDistributorKey(baseKp.publicKey);

    // try {
    //   console.log("creating for", shardChar);
    //   const distributorCreated = await merkleSdk.createDistributor({
    //     root: tree.getRoot(),
    //     maxTotalClaim,
    //     maxNumNodes,
    //     tokenMint: MINT_KP.publicKey,
    //     adminAuth: ADMIN_KP,
    //     base: baseKp,
    //     claimStartTs: CLAIM_START_TS,
    //     claimEndTs: CLAIM_END_TS,
    //     stakeClaimOnly: false,
    //     immediateClaimPercentage: new anchor.BN(
    //       immediateClaimPercentage * 1_000000
    //     ),
    //     laterClaimOffsetSeconds: FULL_CLAIM_FROM.sub(CLAIM_START_TS),
    //   });

    //   console.log("created for", shardChar);

    //   await transfer(
    //     CX,
    //     ADMIN_KP,
    //     getAssociatedTokenAddressSync(MINT_KP.publicKey, ADMIN_KP.publicKey),
    //     distributorCreated.distributorATA,
    //     ADMIN_KP,
    //     maxTotalClaim.toNumber()
    //   );

    //   console.log("transfered for", shardChar);
    // } catch (e) {
    //   console.log("distributor already created");
    // }

    const distributorW = await merkleSdk.loadDistributor(distrbutorKey[0]);

    baseDistributorKeys.set(shardChar, distributorW.key.toString());
  }

  console.log("Doing community trees now");
  let communityDistributorKeys = new Map();

  for (let [shardChar, preTreeArr] of communityTrees.entries()) {
    const tree = new BalanceTree(preTreeArr);

    let maxTotalClaim = new anchor.BN(0);
    preTreeArr.forEach((x) => {
      maxTotalClaim = maxTotalClaim.add(x.amount);
    });
    let maxNumNodes = new anchor.BN(preTreeArr.length);

    const baseKp = communityBaseKps.get(shardChar)!;

    const distrbutorKey = findDistributorKey(baseKp.publicKey);

    // try {
    //   console.log("creating for", shardChar);
    //   const distributorCreated = await merkleSdk.createDistributor({
    //     root: tree.getRoot(),
    //     maxTotalClaim,
    //     maxNumNodes,
    //     tokenMint: MINT_KP.publicKey,
    //     adminAuth: ADMIN_KP,
    //     base: baseKp,
    //     claimStartTs: CLAIM_START_TS,
    //     claimEndTs: CLAIM_END_TS,
    //     stakeClaimOnly: false,
    //     immediateClaimPercentage: new anchor.BN(100 * 1_000000),
    //     laterClaimOffsetSeconds: new anchor.BN(0),
    //   });

    //   console.log("created for", shardChar);

    //   await transfer(
    //     CX,
    //     ADMIN_KP,
    //     getAssociatedTokenAddressSync(MINT_KP.publicKey, ADMIN_KP.publicKey),
    //     distributorCreated.distributorATA,
    //     ADMIN_KP,
    //     maxTotalClaim.toNumber()
    //   );

    //   console.log("transfered for", shardChar);
    // } catch (e) {
    //   console.log("distributor already created", e);
    // }

    const distributorW = await merkleSdk.loadDistributor(distrbutorKey[0]);

    communityDistributorKeys.set(shardChar, distributorW.key.toString());
  }

  console.log(baseDistributorKeys, communityDistributorKeys);
}
main();
