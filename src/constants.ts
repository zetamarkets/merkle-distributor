import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

import idl from "../target/idl/merkle_distributor.json";

export const PROGRAM_ID = new PublicKey(
  "9xXVvfr2XEikR7ZFScHtNY2Gb4s5jKTLXNTnTtux99KD"
);

export const MERKLE_DISTRIBUTOR_PROGRAM_ID = PROGRAM_ID;

export const MERKLE_DISTRIBUTOR_CODER = new anchor.BorshCoder(
  idl as anchor.Idl
);

export const TEST_DISTRIBUTOR_KEYS: Record<string, string> = {
  "2": "8mNKCaAsLDZxmCLSCHUh3mJT4dct8bxM7bTeKsTqFUnd",
  "3": "GqRXoQDjdGrxjVX72UCiUuzuWVhRCq25uLPjHtsCYfC6",
  "4": "DtuTVsVodrWRGde9f6sL3NgP3d98oAXN8rcQX2Pe3khX",
  "5": "JE8Q4QAjP4jSRzT9aHPW6Ns4v2H5g2ZcFyz9VU2WfXEM",
  "6": "DpEXGcck48A7NpLysAUGNPR3M7kfhExRFJ1nmy2xdWHo",
  "7": "CFNR6EkP2ikSTfCmL6skPvyyyXwxY84PWXrJSYEc26Vq",
  "8": "G5WsrCbD6iHjfjGspYUBP8BWrXnfDYRsvzngLBssBoxB",
  "9": "6KGtuzrVCKsPKchJVfeaD84dSTUrigpbA7YgqAoRXVNw",
  a: "6SYMJyPo5XkBd4C3GjkMf6BCfXnzp59h6wdvkghJPMBE",
  b: "J5Sop6WbS4FPHKrsbNVRZf3wKqomEXyuWM1ByGHULN6y",
  c: "AWw7QbXstg9QpMhYTccXo5skDPfJJvXrzyLYZsdHqjxW",
  d: "HDvbibDbvv3jq3p5AH27MkPk9YS2qZfNWZQcNJc5TcRu",
  e: "Cuvxw1JsfzSQ1G59pPvpGKPX7tSuZ9Af4Z15xTCs9ZhN",
  f: "378JP4Gvqj7aJAjXQRZY6dCrqum3AFMgVAYZWxAy3Gnh",
  g: "4QbEcm6SNw97URNXMbviJUXn1vdst9191aKQU9mWJLDP",
  h: "C6XFju6iM3MPp5UeunbCsqkHKago3cmtJ3FyqigvJa1C",
};
