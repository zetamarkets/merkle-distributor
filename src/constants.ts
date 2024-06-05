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
  "2": "ErpVKtrdEBCKfPF8QwKWFkKSimyYLaLVAZft4Giz51gq",
  "3": "9CCYzvRiAgFpN5Wo5FT8oz836vE9dkz9hWPC2dpPWX2i",
  "4": "9bEn4HZjmycPHcLc2hkeNZGiXaR5PS8vtXSAQejDRaKh",
  "6": "4ScJu8vGvQ3z9xum121FLJyzrXpfSuo5miCX8igjTYxU",
  "7": "AEVZ5Y8vWiMv9GYFrsbADBXDCYmEaSc1CXBq3HURZmsP",
  "8": "F8MigfP2Wt1djZdMN1uaUrhyEvVK3ZMUxF8yTYvLbB1q",
  "9": "HuxaxbMEjKS6XKxntjs5fWDaWy2K2wYkA9FmdLvJQE4M",
  a: "2BZx8GMemKERnh3KT1gqjygF77Vv4aafv3Qh5PoavzPH",
  b: "FG1JAdQwPR4x34EqmtaFxpiHRC7BcpsLSnT4XnwGK9p9",
  c: "2PnvWESSJcg3Pusp9JqFQc3NKHv8XJtTMDGYTzRRyGkQ",
  d: "Hc2DnMwTQpaU835HLQ6abAQ8r3gRo4AcQqWWHfGwkLgC",
  e: "EXJBd1qugT7QmGpBdXWXpGhkE6SUdp6FNmAh2EGj5GoK",
  f: "Eyvavd7PkT9Qtz6Mgfx7jsoCtikv7x1e7Y46NjRJH7WG",
  g: "DSv9Aoc2K87heedpWRoYJi5g5ZTx62kWKNe5ib2zpp1t",
  h: "AARm4koWcoigVQ2RLBYFtrZxxu9JH5wkeDVvyvNCMYWq",
};

export const TEST_COMMUNITY_DISTRIBUTOR_KEYS: Record<string, string> = {
  "2": "Ap6PawKmbv9WXxzn9GiSnELCTZNApXC2JAUo5Q2upKEB",
  "3": "8u6oxjLfF4pn6e5DvF6zmgmPSWmGom3n9896znDtYBYa",
  "4": "D4rEe4vdHYDUEqKMUAtwV7GnsTgAoT1ANrhUf9kL6FQ4",
  "5": "2CWM3ubzUFxqGcgVkLwc72mkwNegYmuvw8wmcG9BbhYY",
  "6": "GJD5nvFjLeq2L6o5yqSsHCcJoJV6unYhTg9MSuz5jfhP",
  "7": "5dAE7i9sxVm8zQAN5rKkWSiSH5A78aCxbX2SQkYCbwcf",
  "8": "9sycoy84bQ1vvbjazsmN1GxUDguyFQwtmTatzMgfczTF",
  "9": "DBj4Gmssg9vkXrCSwt4cWq1gRVHiHa4Dm7yqQ6GweMCn",
  a: "BVvyMH7LjdFzvtuRVCAmf5U3nXz8mR1U4e8635iiinaB",
  b: "GoAHn8x5QLGXxMe7o4N3UzhAfK3qrh7WvUsPhq3Hs4vm",
  d: "7iGgZLeKBTZvCnoa7sgMA9R5dSYY5RDUBcfqayaV8MHW",
  e: "F3wGZYcSN71mdbSKsDcMiMRpAqhuZwYozwVHdTJgKfNf",
  f: "2MJvKHYGaBi1kCmEtEjgzg94WeGVj7WBMbckNqrm4h5Y",
  g: "BiCW3kyygF56vr2P7whoN7MpASzTdu5TVJcXK4x4YfyU",
  h: "72FxkFbm1E1nZ1Ms6GivPceQ4cqUKUtEmhbWrkB71jfj",
};
