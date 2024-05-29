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

export const TEST_BASE_DISTRIBUTOR_KEYS: Record<string, string> = {
  "2": "8QzyQ6tTrZWhe7bAmJhfNQ1DkBuW2SffFfY8oq4sJsg5",
  "3": "B9u4iq8vHCb8MzLzzE9ht8XixC6S1KAoGcMExv5vZrrr",
  "4": "Pytow4Lotj7RM41RQFosX5RtwPpzYUgo9RDfZMs8JYR",
  "6": "EfUaJw8skrS3uyg8KJywyZQb3oqsDtfix3wM8cVvrLDc",
  "7": "23TbXyjjJjMaxuidsfrnWL5ioCgBdESdwGrHULgXaM6o",
  "8": "J9xrrTF9S9iGNuDYupoc2fbzRtSGsNmufpkQ8Lukui2s",
  "9": "9xQ8nNj3771XheHLyhbaynNsGwe7N2Cvn7TdNvh47qKQ",
  a: "8yd4K3MoJT5Q1N2e3qwqCb9seXHyWW9EBzN7cABsXnfP",
  b: "4nsRBwkxXb4kD5uWyVqNkqhx6kNVBHoc7JHzqkvYGNQU",
  c: "AXmtsKSJw4SAz2sdGwXmUsiejSg4gefEFNwFcjr8r2dP",
  d: "6W8yFRun56ZYsndMDEp1HL9GqJMfHX3gdSdxd2CAMXc1",
  e: "BoK6iGNAqvtMVAvFFerYWQik28E3WjAGVroavYPhTADq",
  f: "4xCXFECaxckzNzV7YM4U5z8cFrKTB3nPVjWE7JFz2fTi",
  g: "9PKS71Qy28weMLWVfb9yZNZ5FyBaE6szdeTpEugwRRUT",
  h: "Dr8NM8n6di34UtCndQopZ11iNMv8AimpntjTX1o41e29",
};

export const TEST_COMMUNITY_DISTRIBUTOR_KEYS: Record<string, string> = {
  "2": "EFLy2nnVQz9WgxDVWuTx2ggJfGyTnwNquuHxfkFnyK2E",
  "3": "6sEM9A2opJ46vuXMVTWkshHsJaSsii5YN2TatZQ1uj7d",
  "4": "GeGX5T6Qig9uPmXdaQdWG36Lmj1hSQsxXkj5oDAwBzhR",
  "6": "7g2wXmoUFiDy4cbmEjQ1oRWX2gQ5daK3ioXS7HjcRyTY",
  "7": "2VFN9vh4BLVtAZFkPaJs41uM8zoXusf2Gt7rHoxA8ztT",
  "8": "DTEcMjBUex49PG7347mHVfNBUaZVQAjr4MuZfsozeqdH",
  "9": "2qFMUzjT1uWifr7R33A4KRXqY7tUr557vjCB1cDui8sp",
  a: "DfWuXbaLbRtnPKHEfzZpEvNBegRtjJenVa5Uo3ZrmWzE",
  d: "A92wZLrzy7cTQnQ8e7QgVNaiJi2AqwHCYrsMhki3QpNZ",
  e: "7DWeNggEV7ouBxwGwUZNDg3kNEvqRqbSkLJDN5bPBf2J",
  f: "6gXyhWpe6NdMjAEBRbuiuBx3bzCWoFxA6KcLwVkSdmZP",
  g: "9NvyKbv3vET52U94yUQSuunc8Jdo1ANg8KLmBvsWSHK6",
  h: "6joSKiWRpJFshgpMaeUVEBEfcRYy1m6rA5c2Y4enqAtD",
};
