import {
  SignerWallet,
  SingleConnectionBroadcaster,
  SolanaProvider,
} from "@saberhq/solana-contrib";
import { /* getOrCreateATA, */ u64 } from "@saberhq/token-utils";
// import {
//   ASSOCIATED_TOKEN_PROGRAM_ID,
//   Token,
//   TOKEN_PROGRAM_ID,
// } from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

import airdropDataRaw from "../data/airdrop-amounts.json";
import { MerkleDistributorSDK } from "../src";
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
  merkleRoot;
  tokenTotal;

  // Load config to set up connections and keys
  const rpcURL = process.env.RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcURL);

  const userKey = Keypair.fromSecretKey(
    new Uint8Array(
      JSON.parse(Buffer.from(process.env.CLAIMER_PRIVATE_KEY!).toString())
    )
  );

  let userClaim = claims[userKey.publicKey.toString()];
  const provider = new SolanaProvider(
    connection,
    new SingleConnectionBroadcaster(connection),
    new SignerWallet(userKey)
  );

  // Load the existing distributor
  const sdk = MerkleDistributorSDK.load({ provider });
  const distributor = await sdk.loadDistributor(
    new PublicKey(process.env.DISTRIBUTOR_ADDRESS!)
  );

  // If necessary, use the following code to create an ATA
  // I found that getOrCreateATA didn't create one if it didn't exist, so you have to force it
  /*
  let ata = (
    await getOrCreateATA({
      provider: distributor.sdk.provider,
      mint: distributor.data.mint,
      owner: userKey.publicKey,
    })
  ).address;
  let ix = Token.createAssociatedTokenAccountInstruction(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    distributor.data.mint,
    ata,
    userKey.publicKey,
    userKey.publicKey
  );
  */

  // Create the transaction to update the existing distributor
  // Note: amount is the total you are entitled to, including whatever is already claimed from before
  let tx = await distributor.claim({
    amount: new u64(5),
    index: new u64(userClaim.index),
    proof: userClaim.proof,
    claimant: userKey.publicKey,
  });

  // Send the transaction
  tx.addSigners(userKey);
  const pendingTx = await tx.send();
  const receipt = await pendingTx.wait();
  receipt.printLogs();
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
