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
  "2": "Fd8nH3LY1Sr37Aa5gDHRPu179mJXPLchVGqppv9TdMAg",
  "3": "5V3xcxgDeJXgbUv2c5WsopCbrkTQDoNonYZc8Uw3JG9T",
  "4": "GhQvtYvjrVsCeXxJZKUh8JmyfYtRXVeJeF4cMKnSyUBy",
  "6": "3vd8AjZbYEMFRjJpZwWx5Couw6UEhKVKGXefKUzQZgfZ",
  "7": "42e26PBVz7ZYwzy2jNeU5SPeK3Y7pYq6BGTP1c8eqVCL",
  "8": "Ho2yoweuExJMUKuY1fM3U634ed8cy6SYEyAKdKRNWLPR",
  "9": "BMKpHmfUn88xRjcDWL8AtwNAQKmGBCgA8xi9awavKYnM",
  a: "2adoyz65qZ8GsefFntch1Zf2cxyMBXi5x96tNw4xjLTs",
  b: "C1Fy7jH1aca6BpHmXqpWudwkfB6iHi3YM5CYFP5AB6mc",
  c: "7hp8Yq1XC3xjDrWSZuioBbLWgSRZ1VBGd2QpwV2fzmrY",
  d: "ABdr5d18r2MRsQ1VAxcXSKgTaetrJrE8BgbPPqp91DyY",
  e: "8vkNReXfYvLW6bekm73GRgFT6avv2tKPopZkbtXLoaa8",
  f: "23cFo6upg6hwp5tijTegDHzodq12jEgZUUtV5BZuuyoh",
  g: "g5rmNest881FfkKvrCdceBMSDB9fZDnouNyC1Rm8eVP",
  h: "5jwzKsLcvFzCucUGiCUNX4uAHDaLeGhTP9xNqr9PzAtL",
};

export const TEST_COMMUNITY_DISTRIBUTOR_KEYS: Record<string, string> = {
  "2": "DwGc9MBM6rrBADL7BEtUiDmhymqxZA7B3DTFkQnEYaBs",
  "3": "FLYcmfxVCfYbKPmFv92NPw9zzNvPZdVCQ1boZps5Bpvm",
  "4": "CeLdk7TLdvoiHqHeGiURqjWEc9GceqFzxLUzNpPvV5SA",
  "6": "DaFPn9GynhV8mw9tk69zBTLdEH4J5UNv1CYBFjsJrUdD",
  "7": "FPPw1grDPFzSeGGEnuEyH3NUmSZTCsxdpyNakQgzraSs",
  "8": "7dHVTwLMkR75ASDw5tixW78zEQNuumfWRmcbXEJqS5S3",
  "9": "8rP2435CWHGphJYU9z9xxv5guMRHnivzBLMZu1YiQu4q",
  a: "8HwVxaMCuBv6Za3ASZ6XLHvd3jveFXG5nheJafUT2hUe",
  b: "CefuRzcgSA7QnmVKrJCTGJ537jjpXUxjrZBdLheyqSyw",
  c: "Cbpoo36zv4dUH9JAAE2VokjoDj55nYV6rBy42usXRhg8",
  d: "EAAqkBL4rztnzBcHQm9yBa7jPSaz35223KLZFTDGwmrr",
  e: "8D3xF8S69oLbxp5v3Aqx7hma36Awvcnw3ubzu4xuVFiL",
  f: "2JyodB9VW7ukHVrpRyYswdijLhz5rPA6AbE3J2K1f2Cw",
  g: "CZrZiEpyhPECUwu6TmBZGUW6QkkAwqCZTSBypLg1hz8A",
  h: "B72EcewEEHvxsvtFFBqwXj3op5Fc1KSjDQ1mScR4tWyU",
};
