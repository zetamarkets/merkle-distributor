import * as anchor from "@coral-xyz/anchor";
import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

import adminPrivateKey from "./test-airdrop-admin.json";
import mintPrivateKey from "./test-mint-v2.json";

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

const CLAIM_START_TS = new anchor.BN(1718668800); // June 18 00:00
const FULL_CLAIM_FROM = new anchor.BN(1718712000); // June 18 12:00
const CLAIM_END_TS = new anchor.BN(1719187200); // June 24 00:00
const immediateClaimPercentage = 50; // Linearly scale up from 50%

async function main() {
  const provider = new anchor.AnchorProvider(
    CX,
    new anchor.Wallet(ADMIN_KP),
    {}
  );

  const merkleSdk = MerkleDistributorSDK.load({ provider });

  const treesFolderPath = path.resolve(__dirname, "./fake-trees");

  const trees: Map<string, { account: PublicKey; amount: anchor.BN }[]> =
    new Map();
  const baseKps: Map<string, Keypair> = new Map();

  fs.readdirSync(treesFolderPath).forEach((fileName) => {
    const filePath = path.resolve(__dirname, `./fake-trees/${fileName}`);
    const fileContent = fs.readFileSync(filePath, { encoding: "utf-8" });
    const firstChar = fileName[0];
    if (fileName.includes("kp")) {
      baseKps.set(
        firstChar,
        Keypair.fromSecretKey(Buffer.from(JSON.parse(fileContent)))
      );
    } else {
      const nonTransformedTree = JSON.parse(fileContent);
      const transformedTree = nonTransformedTree.map(
        (x: { account: string; amount: number }) => {
          return {
            account: new PublicKey(x.account),
            amount: new anchor.BN(x.amount),
          };
        }
      );
      trees.set(firstChar, transformedTree);
    }
  });

  let distributorKeys = new Map();
  for (let [shardChar, preTreeArr] of trees.entries()) {
    const kp = baseKps.get(shardChar)!;
    const distrbutorKey = findDistributorKey(kp.publicKey);

    const tree = new BalanceTree(preTreeArr);
    let maxTotalClaim = new anchor.BN(0);
    preTreeArr.forEach((x) => {
      maxTotalClaim = maxTotalClaim.add(x.amount);
    });
    let maxNumNodes = new anchor.BN(preTreeArr.length);

    let distributorW: MerkleDistributorWrapper;

    try {
      distributorW = await merkleSdk.loadDistributor(distrbutorKey[0]);
      console.log(
        `${shardChar} immediateClaimPercentage: ${
          distributorW.data.immediateClaimPercentage.toNumber() / 1_000000
        }`
      );
    } catch (e) {
      console.log(
        `base tree for ${shardChar} has not been created yet, creating...`
      );

      await merkleSdk.createDistributor({
        root: tree.getRoot(),
        maxTotalClaim,
        maxNumNodes,
        tokenMint: MINT_KP.publicKey,
        adminAuth: ADMIN_KP,
        base: kp,
        claimStartTs: CLAIM_START_TS,
        claimEndTs: CLAIM_END_TS,
        stakeClaimOnly: false,
        immediateClaimPercentage: new anchor.BN(
          immediateClaimPercentage * 1_000000
        ),
        laterClaimOffsetSeconds: FULL_CLAIM_FROM.sub(CLAIM_START_TS),
      });

      console.log(`created for ${shardChar}`);

      distributorW = await merkleSdk.loadDistributor(distrbutorKey[0]);
    }

    try {
      distributorW = await merkleSdk.loadDistributor(distrbutorKey[0]);
      const ataInfo = await getAccount(CX, distributorW.distributorATA);
      if (Number(ataInfo.amount) != maxTotalClaim.toNumber()) {
        let transferAmt = maxTotalClaim.toNumber() - Number(ataInfo.amount);
        console.log(
          `transferring ${transferAmt} tokens to distributor ata: ${distributorW.distributorATA} for ${shardChar}`
        );
        await transfer(
          CX,
          ADMIN_KP,
          getAssociatedTokenAddressSync(MINT_KP.publicKey, ADMIN_KP.publicKey),
          distributorW.distributorATA,
          ADMIN_KP,
          transferAmt
        );
        console.log(`transferred ${transferAmt} for ${shardChar}`);
      } else {
        console.log(`distributor ${shardChar} ata has enough tokens already:`);
      }
    } catch (e) {
      console.log(`failed to transfer for ${shardChar}, ${e}`);
    }

    distributorKeys.set(shardChar, distributorW.key.toString());
  }

  console.log(distributorKeys);
}
main();
