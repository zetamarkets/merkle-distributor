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

  const shardedBaseJsons: Map<string, object[]> = new Map();
  const shardedCommunityJsons: Map<string, object[]> = new Map();

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
        console.log(firstChar);
        if (r.BaseAllocation != 0) {
          if (shardedBaseJsons.has(firstChar)) {
            shardedBaseJsons.get(firstChar)!.push({
              account: r.Address,
              amount: Math.floor(r.BaseAllocation * Math.pow(10, 6)),
            });
          } else {
            shardedBaseJsons.set(firstChar, [
              {
                account: r.Address,
                amount: Math.floor(r.BaseAllocation * Math.pow(10, 6)),
              },
            ]);
          }
        }

        if (r.CommunityAllocation != 0) {
          if (shardedCommunityJsons.has(firstChar)) {
            shardedCommunityJsons.get(firstChar)!.push({
              account: r.Address,
              amount: Math.floor(r.CommunityAllocation * Math.pow(10, 6)),
            });
          } else {
            shardedCommunityJsons.set(firstChar, [
              {
                account: r.Address,
                amount: Math.floor(r.CommunityAllocation * Math.pow(10, 6)),
              },
            ]);
          }
        }
      });

      console.log(shardedBaseJsons);
      console.log(shardedCommunityJsons);

      shardedBaseJsons.forEach((baseAllocations, firstChar) => {
        const newBasePath = path.resolve(
          __dirname,
          `./trees/${firstChar}_base.json`
        );

        const newKpPath = path.resolve(
          __dirname,
          `./trees/${firstChar}_base_kp.json`
        );

        const kp = Keypair.generate();

        fs.writeFileSync(newKpPath, "[" + kp.secretKey.toString() + "]");
        fs.writeFileSync(newBasePath, JSON.stringify(baseAllocations), "utf-8");
      });

      shardedCommunityJsons.forEach((communityAllocations, firstChar) => {
        const newCommunityPath = path.resolve(
          __dirname,
          `./trees/${firstChar}_community.json`
        );

        const newKpPath = path.resolve(
          __dirname,
          `./trees/${firstChar}_community_kp.json`
        );

        const kp = Keypair.generate();

        fs.writeFileSync(newKpPath, "[" + kp.secretKey.toString() + "]");
        fs.writeFileSync(
          newCommunityPath,
          JSON.stringify(communityAllocations),
          "utf8"
        );
      });
    }
  );
}

main();
