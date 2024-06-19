import {
  createMint,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Keypair, Connection } from "@solana/web3.js";

import adminPrivateKey from "./test-airdrop-admin.json";
import mintPrivateKey from "./test-mint-v2.json";

const ADMIN_KP = Keypair.fromSecretKey(Buffer.from(adminPrivateKey));
const MINT_KP = Keypair.fromSecretKey(Buffer.from(mintPrivateKey));
const CX = new Connection(
  "https://zeta-zeta-61e4.mainnet.rpcpool.com/82783eef-0ee4-4300-b3c7-f97e504b1698",
  "confirmed"
);

async function main() {
  let mintInfo: any = undefined;

  try {
    mintInfo = await getMint(CX, MINT_KP.publicKey);
  } catch (e) {
    console.log(e);
  }

  if (!mintInfo) {
    console.log(mintInfo, "mint not created");
    await createMint(
      CX,
      ADMIN_KP,
      ADMIN_KP.publicKey,
      ADMIN_KP.publicKey,
      6,
      MINT_KP
    );
  } else {
    console.log("supply", mintInfo.supply);

    const adminAtaInfo = await getOrCreateAssociatedTokenAccount(
      CX,
      ADMIN_KP,
      MINT_KP.publicKey,
      ADMIN_KP.publicKey
    );

    console.log("adminAta:", adminAtaInfo.amount);

    if (adminAtaInfo.amount == BigInt(0)) {
      await mintTo(
        CX,
        ADMIN_KP,
        MINT_KP.publicKey,
        adminAtaInfo.address,
        ADMIN_KP,
        BigInt("10000000000000000")
      );
    }
  }
}

main();
