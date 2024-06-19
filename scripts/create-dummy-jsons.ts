import { parse } from "csv-parse";
import * as path from "path";
import * as fs from "fs";
import { Keypair } from "@solana/web3.js";

type Allocations = {
  Address: string;
  BaseAllocation: number;
  CommunityAllocation: number;
};

const csvFilePath = path.resolve(__dirname, "./dummy_airdrop.csv");

const headers = ["Address", "BaseAllocation", "CommunityAllocation"];

async function main() {
  const fileContent = fs.readFileSync(csvFilePath, { encoding: "utf-8" });

  const shardedJsons: Map<string, object[]> = new Map();

  parse(
    fileContent,
    {
      delimiter: ",",
      from_line: 2,
      columns: headers,
    },
    (error, result: Allocations[]) => {
      if (error) {
        console.error(error);
      }

      result.forEach((r) => {
        let firstChar = r.Address[0].toLowerCase();

        let totalAllocation =
          Number(r.BaseAllocation) + Number(r.CommunityAllocation);
        console.log(totalAllocation);

        if (totalAllocation != 0) {
          if (shardedJsons.has(firstChar)) {
            shardedJsons.get(firstChar)!.push({
              account: r.Address,
              amount: Math.floor(totalAllocation * Math.pow(10, 6)),
            });
          } else {
            shardedJsons.set(firstChar, [
              {
                account: r.Address,
                amount: Math.floor(totalAllocation * Math.pow(10, 6)),
              },
            ]);
          }
        }
      });

      shardedJsons.forEach((baseAllocations, firstChar) => {
        const newBasePath = path.resolve(
          __dirname,
          `./trees/${firstChar}.json`
        );

        const newKpPath = path.resolve(
          __dirname,
          `./trees/${firstChar}_kp.json`
        );

        const kp = Keypair.generate();

        fs.writeFileSync(newKpPath, "[" + kp.secretKey.toString() + "]");
        fs.writeFileSync(newBasePath, JSON.stringify(baseAllocations), "utf-8");
      });
    }
  );
}

main();
