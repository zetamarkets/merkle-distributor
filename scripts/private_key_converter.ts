import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { Keypair } from "@solana/web3.js";
require("dotenv").config();

const main = async () => {
  let keyString =
    "xZKGJdQv3CQgAWYYtVFwLzy7cU2qtbZ9HVmS8vHhzEKYWr1aUTcGun3hRAHFs1DSxu7WYhheik4a2FjecraFUeV";

  let keyBuffer = bs58.decode(keyString).toJSON().data;

  const key = Keypair.fromSecretKey(new Uint8Array(keyBuffer));

  console.log(`Private Key (string): ${keyString}`);
  console.log(`Private Key (buffer): [${keyBuffer.join(",")}]`);
  console.log(`Public Key: ${key.publicKey}`);
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
