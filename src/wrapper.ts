import * as anchor from "@coral-xyz/anchor";
import { MerkleDistributor } from "../target/types/merkle_distributor";
import {
  Transaction,
  PublicKey,
  TransactionInstruction,
  TransactionSignature,
  SystemProgram,
  Keypair,
} from "@solana/web3.js";
import * as spl from "@solana/spl-token";

import { findClaimStatusKey, findDistributorKey } from "./pda";
import type { MerkleDistributorSDK } from "./sdk";
import type {
  ClaimArgs,
  CreateDistributorArgs,
  Distributor,
  DistributorData,
  ClaimStatus,
  UpdateDistributorArgs,
  UpdateDistributorClaimWindowArgs,
} from "./types";
import { toBytes32Array, processTransaction } from "./utils";

export class MerkleDistributorWrapper {
  readonly program: anchor.Program<MerkleDistributor>;
  readonly key: PublicKey;
  readonly distributorATA: PublicKey;
  data: DistributorData;

  constructor(
    readonly sdk: MerkleDistributorSDK,
    key: PublicKey,
    distributorATA: PublicKey,
    data: DistributorData
  ) {
    this.program = sdk.program;
    this.key = key;
    this.distributorATA = distributorATA;
    this.data = data;
  }

  static async load(
    sdk: MerkleDistributorSDK,
    key: PublicKey
  ): Promise<MerkleDistributorWrapper> {
    const data = await sdk.program.account.merkleDistributor.fetch(key);
    return new MerkleDistributorWrapper(
      sdk,
      key,
      spl.getAssociatedTokenAddressSync(data.mint, key, true),
      data
    );
  }

  static async createDistributor(
    args: CreateDistributorArgs
  ): Promise<Distributor> {
    const { root, tokenMint } = args;

    const { sdk } = args;
    const { provider } = sdk;

    const baseKey = args.base;
    const adminAuth = args.adminAuth;
    const [distributor, bump] = findDistributorKey(baseKey.publicKey);

    const ixs: TransactionInstruction[] = [];
    ixs.push(
      sdk.program.instruction.newDistributor(
        toBytes32Array(root),
        args.maxTotalClaim,
        args.maxNumNodes,
        args.claimStartTs,
        args.claimEndTs,
        args.stakeClaim,
        args.immediateClaimPercentage,
        args.laterClaimOffsetSeconds,
        {
          accounts: {
            base: baseKey.publicKey,
            adminAuth: adminAuth.publicKey,
            distributor,
            mint: tokenMint,
            payer: provider.publicKey,
            systemProgram: SystemProgram.programId,
          },
        }
      )
    );

    let address = spl.getAssociatedTokenAddressSync(
      tokenMint,
      distributor,
      true
    );
    let instruction: TransactionInstruction = undefined;
    try {
      await spl.getAccount(provider.connection, address);
    } catch (e) {
      instruction = spl.createAssociatedTokenAccountInstruction(
        provider.publicKey,
        address,
        distributor,
        tokenMint
      );
    }

    if (instruction) {
      ixs.push(instruction);
    }

    let tx = new Transaction().add(...ixs);
    await processTransaction(provider, tx, [baseKey, adminAuth]);

    return {
      base: baseKey.publicKey,
      bump,
      distributor,
      distributorATA: address,
    };
  }

  claimIX(args: ClaimArgs): TransactionInstruction {
    const { amount, claimant, index, proof } = args;
    const [claimStatus, _] = findClaimStatusKey(claimant, this.key);

    return this.program.instruction.claim(
      index,
      amount,
      proof.map((p) => toBytes32Array(p)),
      {
        accounts: {
          distributor: this.key,
          claimStatus,
          from: this.distributorATA,
          to: spl.getAssociatedTokenAddressSync(this.data.mint, claimant),
          claimant,
          payer: claimant,
          systemProgram: SystemProgram.programId,
          tokenProgram: spl.TOKEN_PROGRAM_ID,
        },
      }
    );
  }

  // TODO: Fix later
  async claimStake(
    args: ClaimArgs,
    cpiAccs: {
      zetaStaking: PublicKey;
      protocolState: PublicKey;
      stakeAccountManager: PublicKey;
      stakeAccount: PublicKey;
      stakeVault: PublicKey;
      zetaMint: PublicKey;
    },
    bitToUse: number,
    stakeAccName: string
  ): Promise<TransactionSignature> {
    const { amount, claimant, index, proof } = args;
    const [claimStatus, _] = findClaimStatusKey(claimant, this.key);

    const tx = new Transaction();

    let address = spl.getAssociatedTokenAddressSync(
      this.data.mint,
      args.claimant
    );
    try {
      await spl.getAccount(this.sdk.provider.connection, address);
    } catch (e) {
      tx.add(
        spl.createAssociatedTokenAccountInstruction(
          this.sdk.provider.publicKey,
          address,
          args.claimant,
          this.data.mint
        )
      );
    }

    tx.add(
      this.program.instruction.claimStake(
        index,
        amount,
        proof.map((p) => toBytes32Array(p)),
        bitToUse,
        stakeAccName,
        {
          accounts: {
            distributor: this.key,
            claimStatus,
            from: this.distributorATA,
            to: address,
            zetaStaking: cpiAccs.zetaStaking,
            cpiProtocolState: cpiAccs.protocolState,
            cpiStakeAccountManager: cpiAccs.stakeAccountManager,
            cpiStakeAccount: cpiAccs.stakeAccount,
            cpiStakeVault: cpiAccs.stakeVault,
            zetaMint: cpiAccs.zetaMint,
            claimant,
            payer: claimant,
            systemProgram: SystemProgram.programId,
            tokenProgram: spl.TOKEN_PROGRAM_ID,
          },
        }
      )
    );

    return processTransaction(this.sdk.provider, tx, args.signers);
  }

  async claim(args: ClaimArgs): Promise<TransactionSignature> {
    const { provider } = this.sdk;

    const tx = new Transaction().add(this.claimIX(args));

    let address = spl.getAssociatedTokenAddressSync(
      this.data.mint,
      args.claimant
    );
    let instruction: TransactionInstruction = undefined;
    try {
      await spl.getAccount(provider.connection, address);
    } catch (e) {
      instruction = spl.createAssociatedTokenAccountInstruction(
        provider.publicKey,
        address,
        args.claimant,
        this.data.mint
      );
    }

    if (instruction) {
      tx.instructions.unshift(instruction);
    }

    return processTransaction(provider, tx, args.signers);
  }

  async getClaimStatus(claimant: PublicKey): Promise<ClaimStatus> {
    const [key] = findClaimStatusKey(claimant, this.key);
    return this.program.account.claimStatus.fetch(key);
  }

  async reload(): Promise<void> {
    this.data = await this.program.account.merkleDistributor.fetch(this.key);
  }

  async update(args: UpdateDistributorArgs): Promise<TransactionSignature> {
    const ixs: TransactionInstruction[] = [];

    ixs.push(
      this.sdk.program.instruction.updateDistributor(
        toBytes32Array(args.root),
        args.maxTotalClaim,
        args.maxNumNodes,
        {
          accounts: {
            adminAuth: args.adminAuth.publicKey,
            distributor: this.key,
          },
        }
      )
    );

    return processTransaction(
      this.sdk.provider,
      new Transaction().add(...ixs),
      [args.adminAuth]
    );
  }

  async updateClaimWindow(
    args: UpdateDistributorClaimWindowArgs
  ): Promise<TransactionSignature> {
    const ixs: TransactionInstruction[] = [];

    ixs.push(
      this.sdk.program.instruction.updateDistributorClaimWindow(
        args.claimStartTs,
        args.claimEndTs,
        {
          accounts: {
            adminAuth: args.adminAuth.publicKey,
            distributor: this.key,
          },
        }
      )
    );

    return processTransaction(
      this.sdk.provider,
      new Transaction().add(...ixs),
      [args.adminAuth]
    );
  }

  async adminClaimAfterExpiry(
    adminAuth: Keypair
  ): Promise<TransactionSignature> {
    const ixs: TransactionInstruction[] = [];

    let address = spl.getAssociatedTokenAddressSync(
      this.data.mint,
      adminAuth.publicKey
    );
    try {
      await spl.getAccount(this.sdk.provider.connection, address);
    } catch (e) {
      ixs.push(
        spl.createAssociatedTokenAccountInstruction(
          this.sdk.provider.publicKey,
          address,
          adminAuth.publicKey,
          this.data.mint
        )
      );
    }

    ixs.push(
      this.sdk.program.instruction.adminClaimAfterExpiry({
        accounts: {
          distributor: this.key,
          from: this.distributorATA,
          to: address,
          adminAuth: adminAuth.publicKey,
          tokenProgram: spl.TOKEN_PROGRAM_ID,
        },
      })
    );

    return processTransaction(
      this.sdk.provider,
      new Transaction().add(...ixs),
      [adminAuth]
    );
  }
}
