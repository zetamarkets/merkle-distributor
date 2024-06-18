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
  "2": "99WoAVx7EmtghPGN8YLCM9e7BwuMU7r2atNaWuepCLrQ",
  "3": "Gzy7fqaGgmxXoxDwpAi1idZLC6NpiRWSnzGtbt95M3QK",
  "4": "CLHbHA6GFG9WenSn2ScfWzHu7onH2xG26jrJ2C3ySkq1",
  "5": "5PC3nbu6SefMDsFKi1yewFwxcXm19CvRX1SZ6Se6DpP7",
  "6": "9ZXGbVZyEEB2DemznYwsGwBoE5QYmMoyMyfk8g4rGDV9",
  "7": "3BrLqwauV4qUJk8Cz2YT6o2xrwgqjYeVpVzJruP5LZW4",
  "8": "4932hX5n8bKWspKcpM4HFwE4WbRFFhtZWkwXk69kH7L6",
  "9": "CDtmmqvQM7JH3HvrDFrHP55dyQ2LwTYXZvHgdQ1kY5fM",
  a: "E9C7ZJsmcWXavJD2nvxJQV1XFFHq9SkLi8CvircQASC4",
  b: "EFbivzjGiP1BT4UKh7jZP9X3fUBRSdQeLNdztAtTkNoa",
  c: "J8z52AHShPYNApin84vpytwLEAmY6hS9NgVe8TCaHRhK",
  d: "G6VeAfXFgr2BZWKkqKk7R9CGDBbwFkr7fScdyZ9mQnh9",
  e: "GVEtrN6RmzLHungLWAR7qRX9GeKu3xcbuJhafq2nfAQM",
  f: "HLTfzqfWC77kNSAcCzsNu48PMELPUqV8VdczcPydzXkH",
  g: "BrVGZg8tfBwv6qTzaPBM9VSjVoUj2uudKh5vf4LZYUcv",
  h: "EH3EAcu76yvdNMBpzrXLRtsNHRF2H9yS5k5FZMDVxy77",
};
