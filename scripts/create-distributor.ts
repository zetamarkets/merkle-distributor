import {
  SignerWallet,
  SingleConnectionBroadcaster,
  SolanaProvider,
} from "@saberhq/solana-contrib";
import { u64 } from "@saberhq/token-utils";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

import airdropDataRaw from "../data/airdrop-amounts.json";
import { MerkleDistributorSDK } from "../src/sdk";
import { parseBalanceMap } from "../src/utils/parse-balance-map";

require("dotenv").config();

const main = async () => {
  // Load the airdrop data in data/airdrop-amounts.json and make a local tree out of it
  const balanceMap: { [authority: string]: u64 } = {};
  airdropDataRaw.forEach(({ authority, amount }) => {
    const prevBalance = balanceMap[authority];
    if (prevBalance) {
      balanceMap[authority] = prevBalance.add(new u64(amount));
    } else {
      balanceMap[authority] = new u64(amount);
    }
  });
  const { claims, merkleRoot, tokenTotal } = parseBalanceMap(
    Object.entries(balanceMap).map(([authority, amount]) => ({
      address: authority,
      earnings: amount.toString(),
    }))
  );

  // Load config to set up connections and keys
  const rpcURL = process.env.RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcURL);
  const keypair = Keypair.fromSecretKey(
    new Uint8Array(
      JSON.parse(Buffer.from(process.env.ADMIN_PRIVATE_KEY!).toString())
    )
  );
  const provider = new SolanaProvider(
    connection,
    new SingleConnectionBroadcaster(connection),
    new SignerWallet(keypair)
  );
  const sdk = MerkleDistributorSDK.load({ provider });
  let mintKey = process.env.MINT_KEY!;

  // Create the transaction to create the distributor
  const pendingDistributor = await sdk.createDistributor({
    root: merkleRoot,
    maxTotalClaim: new u64(tokenTotal),
    maxNumNodes: new u64(Object.keys(claims).length),
    tokenMint: new PublicKey(mintKey),
    base: undefined,
    adminAuth: keypair,
  });

  // Send the transaction
  const { tx, ...distributorInfo } = pendingDistributor;
  const pendingTx = await tx.send();
  const receipt = await pendingTx.wait();
  receipt.printLogs();

  // Print info about the distributor if the transaction worked
  console.log(
    JSON.stringify(
      {
        bump: distributorInfo.bump,
        distributor: distributorInfo.distributor.toString(),
        distributorATA: distributorInfo.distributorATA.toString(),
      },
      null,
      2
    )
  );
};

main()
  .then()
  .catch((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    } else {
      process.exit(0);
    }
  });
