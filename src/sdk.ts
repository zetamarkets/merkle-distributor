import * as anchor from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./constants";
import { MerkleDistributor } from "../target/types/merkle_distributor";
import idl from "../target/idl/merkle_distributor.json";
import type { CreateDistributorArgs, Distributor } from "./types";
import { MerkleDistributorWrapper } from "./wrapper";

export class MerkleDistributorSDK {
  constructor(
    readonly provider: anchor.AnchorProvider,
    readonly program: anchor.Program<MerkleDistributor>
  ) {}

  /**
   * Loads the SDK.
   * @returns {MerkleDistributorSDK}
   */
  static load({
    provider,
  }: {
    // Provider
    provider: anchor.AnchorProvider;
  }): MerkleDistributorSDK {
    return new MerkleDistributorSDK(
      provider,
      new anchor.Program<MerkleDistributor>(
        idl as unknown as MerkleDistributor,
        PROGRAM_ID,
        provider
      )
    );
  }

  /**
   * Load an existing merkle distributor.
   * @returns {MerkleDistributorWrapper}
   */
  async loadDistributor(key: PublicKey): Promise<MerkleDistributorWrapper> {
    return await MerkleDistributorWrapper.load(this, key);
  }

  /**
   * Create a merkle distributor.
   * @returns {Distributor}
   */
  async createDistributor(
    args: Omit<CreateDistributorArgs, "sdk">
  ): Promise<Distributor> {
    return await MerkleDistributorWrapper.createDistributor({
      sdk: this,
      ...args,
    });
  }
}
