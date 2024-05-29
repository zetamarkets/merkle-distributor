import {
  createMint,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Keypair, Connection } from "@solana/web3.js";

import adminPrivateKey from "./test-airdrop-admin.json";
import mintPrivateKey from "./test-mint.json";

const ADMIN_KP = Keypair.fromSecretKey(Buffer.from(adminPrivateKey));
const MINT_KP = Keypair.fromSecretKey(Buffer.from(mintPrivateKey));
const CX = new Connection(
  "https://zeta.rpcpool.com/7d48e129-e378-441c-8bff-a712b2e6ea2c",
  "confirmed"
);

async function main() {
  const mintInfo = await getMint(CX, MINT_KP.publicKey);

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
        BigInt("1000000000000000")
      );
    }
  }
}

main();
