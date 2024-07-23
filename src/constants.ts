import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

import idl from "../target/idl/merkle_distributor.json";

export const PROGRAM_ID = new PublicKey(
  "4JSALTb4QbipG7NNLryAFJg4y8X5C1ELErSncsVMA3gZ"
);

export const MERKLE_DISTRIBUTOR_PROGRAM_ID = PROGRAM_ID;

export const MERKLE_DISTRIBUTOR_CODER = new anchor.BorshCoder(
  idl as anchor.Idl
);

export const TEST_DISTRIBUTOR_KEYS: Record<string, string> = {
  "2": "GbxrcVa9JzRoCzw4SZjrjjbmcCJwBfiKatp5mmGwTKNk",
  "3": "G4MeQWxer6pyxucoTpLzCLX34KjKPNp87ru2HNjpDHEf",
  "4": "DsaoRo4FQqfe7LakKwAKEyqcBKRGXqZoAUjn3JUUpEYR",
  "5": "5pi18EgAa2ySUfidhWniUCKfxTdrrrhKFaU4x3NBR3Vj",
  "6": "94xd8WSwrpUqnvMyKjt7G7nnUqX2gGcPGK3BNpGBheau",
  "7": "hnxkPNyj5m8azgpVVuJwKCd6V11pZb4ML4ZX8yGms6z",
  "8": "9cs6P4rh5MCBzRR69FpAfctTaEhiU6Cgtx9MCjc3zf4L",
  "9": "Hr4YFpWsCVukV6PKoPHpawRn7XLGQghe5Hf4v7FSVETM",
  a: "Ca7cGy1Q8cAV5oeC3E4sXJABV8vuK72uo3kJSGE37RA3",
  b: "MAH744DRaxTpT4yFqPoE2U4wfgmKnFvZYBQehBG5Spw",
  c: "6EsU2wnf8ALQ8dkU1YQPf9p1s7qkGxuure5JT9i8PYnv",
  d: "HNiNz7stPuGmhQB3LSsYMhyTWG6oEDYByS9SVsVpdpPd",
  e: "7azPBx3SgVapJTmp3snKtZDbzcBFbYdUJ45fk72iezzq",
  f: "96CamMi5SBEZdVnya6A1YwEPYP8QL5vHR24eut1noe7Q",
  g: "8HJ6uTCbUr728jo4StGJXNhiEibZ2sPj4428AMt8FD97",
  h: "6KE9Hp3kfkDpMcz3tDN1PZFX2sVwUTSGirsCh2cJcUGJ",
};

export const PRODUCTION_DISTRIBUTOR_KEYS: Record<string, string> = {
  "1": "Ena5PXG5QHAFqxLHueKW8fc74kGSghBVL2UDHyrUnFc1",
  "2": "CLPmtotgeWyYqwEQrV3yXWqNdk6aSdj9f86gQHnHVEBo",
  "3": "4TqxRLvWyA3i8u18iG97ocuAY6wKL2mFLc1Qogd6moor",
  "4": "3rLQ4wYXhi4XxBvoeZXdsvCC5HD1Ei9xPZhAtUzNiPZf",
  "5": "Csq8eYrtntuDEJ7YFG3jXuQ6SmMS9taxPbic7UZUYFNX",
  "6": "Do44U3Nbi4Y1vdjB3XCNa1chJCpFgYvBN1reCx385wQ1",
  "7": "DWpLKpu8xV8ndXAAHMbjgyeRUwUYAxtYhtwJh8Dssd2d",
  "8": "7BUBEu7jE2JazSFEzGN8oP949yq6z6xZFK1uRQu6hG88",
  "9": "3FT4V9KqAWPkpXkXS7RRbPR3kK2H6acuP92LFqX73FL6",
  a: "E1vJ43iC3ugkwwQK7xW5Zz9wRNkSYm4GZALoXTETv4t2",
  b: "HwBy6DAP2y1usiaWDCbiPQv5dtPLEZYenTUV3FCu7imG",
  c: "CQ5Fi2EcGwVScFjFN8hPvaVDmxj7MarWoqyziD6Wcept",
  d: "CMYgPw7cYAMtmxxWGiGLTeV8T6QFyh3nui7mkebh44LM",
  e: "5jK9Aimc3ZxqL57cwvsHGJx3MR1dZHuXBwYBb7QCHVQD",
  f: "GdNKKg8TXZQbhFuUNkSGr5o3vuhnrvD3rbApbmipxtpG",
  g: "G9Ty1XbwuagpUEcsexNV6nP2YmmCt816GS5sGwMU11WF",
  h: "2XXw2tHcH59YtLJwfaD4GdhkARGww6RBheyviUsFWEcf",
  i: "FxTYEUHqgc478su5Dge3FtSjbuByxWbYP9Dws5nLeMwW",
  j: "4FaCZyR1vSgsR8nFgXf8x1f81rWg8gyjHKmEXwFjt129",
  k: "A4c6Mi9kqNyrNLUjRPiTPhnL9Yx63sXA5pygPuEoAh4M",
  l: "5GnFHWaDAKYaf2T2gahmkzxpgTUNt4ddDhy65NGq2PT",
  m: "4DBsW2Qdh39x1cb5jQ5mASKeSKjrZt4bCMkGV9ekxpuu",
  n: "GdqgRTuyhVDjv8GbPy3kC7YQzMbT3ffANpCXK7ie243u",
  o: "CFAejLQynRFa3mnWYPzVeKMSw66t5TsqKJuBheejif9E",
  p: "5gh3BM2KQzGevAEid4sAYrHd99uQCNjqM2ipkkZb178H",
  q: "JA7CKeJEq2p11Taqp9rJw8sMu9AWK29FiqjXuz8PJ2Av",
  r: "AiB7Vgdm2DsXFe8FXqA7pjjPRBpshk4MNnpubJQTRL8L",
  s: "5DvChKBPGYYS3VbbP1Pa7Qj7gUEwfbsRPrsARh6apPbn",
  t: "CNSWTtezkd7VwNc8bT4iLFedawHDgjBNVkkesVh2ciDK",
  u: "5yrdm62pK6L4nxBfJjb2n31ZBStdL2Za2Dj8xWjWwm4N",
  v: "5NveKpT8P41C8BgsEmGTRqCmZkWwjkaF5NC7WQ1jiBSd",
  w: "4npWCt7noK6FXceZ5FgLuMsa4P2sqCzsKATJR66t1orC",
  x: "8aTtdjE4v7HhiDgHAcS156vb1zvboCh1ukHLXa5AqBEk",
  y: "C12iWEzCdiyU1zL9VrJwFCW26XZTMmSwoJczc9ZrDuHo",
  z: "6o1ZexNBJnQCDXiWtJgDPkE4u5WndgUb1wKDjofRuWme",
  misc: "7YiyMXFSmjoW9yV9xoujqcoZve7j1A2mEVnjpifMU6mx",
};
