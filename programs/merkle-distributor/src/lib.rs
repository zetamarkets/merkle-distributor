//! A program for distributing tokens efficiently via uploading a [Merkle root](https://en.wikipedia.org/wiki/Merkle_tree).
//!
//! This program is largely based off of [Uniswap's Merkle Distributor](https://github.com/Uniswap/merkle-distributor).
//!
//! # Rationale
//!
//! Although Solana has low fees for executing transactions, it requires staking tokens to pay for storage costs, also known as "rent". These rent costs can add up when sending tokens to thousands or tens of thousands of wallets, making it economically unreasonable to distribute tokens to everyone.
//!
//! The Merkle distributor, pioneered by [Uniswap](https://github.com/Uniswap/merkle-distributor), solves this issue by deriving a 256-bit "root hash" from a tree of balances. This puts the gas cost on the claimer. Solana has the additional advantage of being able to reclaim rent from closed token accounts, so the net cost to the user should be around `0.000010 SOL` (at the time of writing).
//!
//! The Merkle distributor is also significantly easier to manage from an operations perspective, since one does not need to send a transaction to each individual address that may be redeeming tokens.
//!
//! # License
//!
//! The Merkle distributor program and SDK is distributed under the GPL v3.0 license.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::{self, Mint, Token, TokenAccount};
use zeta_staking::program::ZetaStaking;

pub mod merkle_proof;

declare_id!("4nFsEC3VPbU13QpNCqbkQVbPm8HHZp1njqnL5YDruuAn");

const PERCENT_100: u64 = 100_000000;

/// The [merkle_distributor] program.
#[program]
pub mod merkle_distributor {
    #[allow(deprecated)]
    use super::*;

    /// Creates a new [MerkleDistributor].
    /// After creating this [MerkleDistributor], the account should be seeded with tokens via its ATA.
    pub fn new_distributor(
        ctx: Context<NewDistributor>,
        root: [u8; 32],
        max_total_claim: u64,
        max_num_nodes: u64,
        claim_start_ts: u64,
        claim_end_ts: u64,
        stake_claim_only: bool,
        immediate_claim_percentage: u64,
        later_claim_offset_seconds: u64,
    ) -> Result<()> {
        let distributor = &mut ctx.accounts.distributor;

        distributor.base = ctx.accounts.base.key();
        distributor.admin_auth = ctx.accounts.admin_auth.key();

        distributor.bump = ctx.bumps.distributor;

        distributor.root = root;
        distributor.mint = ctx.accounts.mint.key();

        distributor.max_total_claim = max_total_claim;
        distributor.max_num_nodes = max_num_nodes;
        distributor.total_amount_claimed = 0;
        distributor.num_nodes_claimed = 0;

        assert!(claim_end_ts > claim_start_ts);
        distributor.claim_start_ts = claim_start_ts;
        distributor.claim_end_ts = claim_end_ts;
        distributor.stake_claim_only = stake_claim_only;

        assert!(later_claim_offset_seconds + claim_start_ts < claim_end_ts);
        assert!(immediate_claim_percentage <= PERCENT_100);
        distributor.immediate_claim_percentage = immediate_claim_percentage;
        distributor.later_claim_offset_seconds = later_claim_offset_seconds;

        Ok(())
    }

    pub fn update_distributor(
        ctx: Context<UpdateDistributor>,
        root: [u8; 32],
        max_total_claim: u64,
        max_num_nodes: u64,
    ) -> Result<()> {
        let distributor = &mut ctx.accounts.distributor;
        require!(distributor.root != root, ErrorCode::UpdateRootNoChange);

        distributor.root = root;
        distributor.max_total_claim = max_total_claim;
        distributor.max_num_nodes = max_num_nodes;
        distributor.num_nodes_claimed = 0;

        Ok(())
    }

    pub fn update_distributor_admin_auth(ctx: Context<UpdateDistributorAdminAuth>) -> Result<()> {
        let distributor = &mut ctx.accounts.distributor;

        distributor.admin_auth = ctx.accounts.new_admin.key();

        Ok(())
    }

    pub fn update_distributor_claim_window(
        ctx: Context<UpdateDistributor>,
        claim_start_ts: u64,
        claim_end_ts: u64,
    ) -> Result<()> {
        let distributor = &mut ctx.accounts.distributor;
        assert!(claim_end_ts > claim_start_ts);
        distributor.claim_start_ts = claim_start_ts;
        distributor.claim_end_ts = claim_end_ts;

        Ok(())
    }

    pub fn update_distributor_claim_percentages(
        ctx: Context<UpdateDistributor>,
        immediate_claim_percentage: u64,
        later_claim_offset_seconds: u64,
    ) -> Result<()> {
        let distributor = &mut ctx.accounts.distributor;
        assert!(later_claim_offset_seconds + distributor.claim_start_ts < distributor.claim_end_ts);
        distributor.immediate_claim_percentage = immediate_claim_percentage;
        distributor.later_claim_offset_seconds = later_claim_offset_seconds;

        Ok(())
    }

    /// Claims tokens from the [MerkleDistributor].
    #[allow(deprecated)]
    pub fn claim(ctx: Context<Claim>, index: u64, amount: u64, proof: Vec<[u8; 32]>) -> Result<()> {
        let distributor = &ctx.accounts.distributor;
        require!(
            distributor.stake_claim_only == false,
            ErrorCode::MustClaimDirectToStake
        );
        let now = Clock::get()?.unix_timestamp as u64;
        require!(
            now >= distributor.claim_start_ts && now <= distributor.claim_end_ts,
            ErrorCode::OutsideClaimWindow
        );

        let claim_status = &mut ctx.accounts.claim_status;
        require!(
            claim_status.claimed_amount < amount,
            ErrorCode::NoClaimableAmount
        );

        let claimant_account = &ctx.accounts.claimant;

        // Check whether payer is the admin or the claimant
        if (ctx.accounts.payer.key() != claimant_account.key())
            && (ctx.accounts.payer.key() != distributor.admin_auth)
        {
            return Err(ErrorCode::Unauthorized)?;
        }

        require!(claimant_account.is_signer, ErrorCode::Unauthorized);
        // Verify the merkle proof.
        let node = anchor_lang::solana_program::keccak::hashv(&[
            &index.to_le_bytes(),
            &claimant_account.key().to_bytes(),
            &amount.to_le_bytes(),
        ]);
        require!(
            merkle_proof::verify(proof, distributor.root, node.0),
            ErrorCode::InvalidProof
        );

        let claim_amount = amount.checked_sub(claim_status.claimed_amount).unwrap();

        // Mark it claimed and send the tokens.
        claim_status.claimed_amount = amount;
        let clock = Clock::get()?;
        claim_status.claimed_at = clock.unix_timestamp;
        claim_status.claimant = claimant_account.key();

        let seeds = [
            b"MerkleDistributor".as_ref(),
            &distributor.base.to_bytes(),
            &[ctx.accounts.distributor.bump],
        ];

        let ata = get_associated_token_address(&ctx.accounts.distributor.key(), &distributor.mint);
        require!(
            ata == ctx.accounts.from.key(),
            ErrorCode::InvalidDistributorTokenAccount
        );

        let transfer_amount =
            if now < distributor.claim_start_ts + distributor.later_claim_offset_seconds {
                let percent_to_get = get_time_scaled_percentage(
                    distributor.immediate_claim_percentage,
                    now.checked_sub(distributor.claim_start_ts).unwrap(),
                    distributor.later_claim_offset_seconds,
                );
                get_percentage(claim_amount, percent_to_get)
            } else {
                claim_amount
            };

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.from.to_account_info(),
                    to: ctx.accounts.to.to_account_info(),
                    authority: ctx.accounts.distributor.to_account_info(),
                },
            )
            .with_signer(&[&seeds[..]]),
            transfer_amount,
        )?;

        let distributor = &mut ctx.accounts.distributor;

        distributor.total_amount_claimed = distributor
            .total_amount_claimed
            .checked_add(claim_amount)
            .unwrap();
        require!(
            distributor.total_amount_claimed <= distributor.max_total_claim,
            ErrorCode::ExceededMaxClaim
        );

        distributor.num_nodes_claimed = distributor.num_nodes_claimed.checked_add(1).unwrap();
        require!(
            distributor.num_nodes_claimed <= distributor.max_num_nodes,
            ErrorCode::ExceededMaxNumNodes
        );

        emit!(ClaimedEvent {
            root: distributor.root,
            index,
            claimant: claimant_account.key(),
            claim_amount: claim_amount,
        });
        Ok(())
    }

    /// Claims tokens from the [MerkleDistributor] direct to stake.
    #[allow(deprecated)]
    pub fn claim_stake(
        ctx: Context<ClaimStake>,
        index: u64,
        amount: u64,
        proof: Vec<[u8; 32]>,
        zeta_stake_bit_to_use: u8,
        stake_acc_name: String,
        stake_duration_epochs: u32,
    ) -> Result<()> {
        let distributor = &ctx.accounts.distributor;
        let now = Clock::get()?.unix_timestamp as u64;
        require!(
            now >= distributor.claim_start_ts && now <= distributor.claim_end_ts,
            ErrorCode::OutsideClaimWindow
        );

        let claim_status = &mut ctx.accounts.claim_status;
        require!(
            claim_status.claimed_amount < amount,
            ErrorCode::NoClaimableAmount
        );

        let claimant_account = &ctx.accounts.claimant;

        // Check whether payer is the admin or the claimant
        if (ctx.accounts.payer.key() != claimant_account.key())
            && (ctx.accounts.payer.key() != distributor.admin_auth)
        {
            return Err(ErrorCode::Unauthorized)?;
        }

        require!(claimant_account.is_signer, ErrorCode::Unauthorized);
        // Verify the merkle proof.
        let node = anchor_lang::solana_program::keccak::hashv(&[
            &index.to_le_bytes(),
            &claimant_account.key().to_bytes(),
            &amount.to_le_bytes(),
        ]);
        require!(
            merkle_proof::verify(proof, distributor.root, node.0),
            ErrorCode::InvalidProof
        );

        let claim_amount = amount.checked_sub(claim_status.claimed_amount).unwrap();

        // Mark it claimed and send the tokens.
        claim_status.claimed_amount = amount;
        let clock = Clock::get()?;
        claim_status.claimed_at = clock.unix_timestamp;
        claim_status.claimant = claimant_account.key();

        let seeds = [
            b"MerkleDistributor".as_ref(),
            &distributor.base.to_bytes(),
            &[ctx.accounts.distributor.bump],
        ];

        let ata = get_associated_token_address(&ctx.accounts.distributor.key(), &distributor.mint);
        require!(
            ata == ctx.accounts.from.key(),
            ErrorCode::InvalidDistributorTokenAccount
        );

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.from.to_account_info(),
                    to: ctx.accounts.to.to_account_info(),
                    authority: ctx.accounts.distributor.to_account_info(),
                },
            )
            .with_signer(&[&seeds[..]]),
            claim_amount,
        )?;

        require!(
            stake_duration_epochs <= ctx.accounts.cpi_protocol_state.max_n_epochs
                && stake_duration_epochs
                    >= ctx.accounts.cpi_protocol_state.min_stake_duration_epochs,
            ErrorCode::InvalidStakeDuration
        );

        let cpi_accs = zeta_staking::cpi::accounts::Stake {
            protocol_state: ctx.accounts.cpi_protocol_state.to_account_info(),
            zeta_token_account: ctx.accounts.to.to_account_info(),
            stake_account_manager: ctx.accounts.cpi_stake_account_manager.to_account_info(),
            stake_account: ctx.accounts.cpi_stake_account.to_account_info(),
            stake_vault: ctx.accounts.cpi_stake_vault.to_account_info(),
            authority: ctx.accounts.claimant.to_account_info(),
            zeta_mint: ctx.accounts.zeta_mint.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.zeta_staking.to_account_info(), cpi_accs);

        if distributor.stake_claim_only {
            assert!(stake_duration_epochs >= 90)
        }

        zeta_staking::cpi::stake(
            cpi_ctx,
            zeta_stake_bit_to_use,
            stake_duration_epochs,
            claim_amount,
            stake_acc_name,
        )?;

        let distributor = &mut ctx.accounts.distributor;

        distributor.total_amount_claimed = distributor
            .total_amount_claimed
            .checked_add(claim_amount)
            .unwrap();
        require!(
            distributor.total_amount_claimed <= distributor.max_total_claim,
            ErrorCode::ExceededMaxClaim
        );

        distributor.num_nodes_claimed = distributor.num_nodes_claimed.checked_add(1).unwrap();
        require!(
            distributor.num_nodes_claimed <= distributor.max_num_nodes,
            ErrorCode::ExceededMaxNumNodes
        );

        emit!(ClaimedEvent {
            root: distributor.root,
            index,
            claimant: claimant_account.key(),
            claim_amount: claim_amount,
        });
        Ok(())
    }

    pub fn admin_claim_after_expiry(ctx: Context<AdminClaimAfterExpiry>) -> Result<()> {
        let distributor = &mut ctx.accounts.distributor;
        let now = Clock::get()?.unix_timestamp;
        require!(
            now as u64 > distributor.claim_end_ts,
            ErrorCode::InsideClaimWindow
        );

        let seeds = [
            b"MerkleDistributor".as_ref(),
            &distributor.base.to_bytes(),
            &[ctx.accounts.distributor.bump],
        ];

        // Transfer remaining tokens in the ata to admin auth ata instead.
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.from.to_account_info(),
                    to: ctx.accounts.to.to_account_info(),
                    authority: ctx.accounts.distributor.to_account_info(),
                },
            )
            .with_signer(&[&seeds[..]]),
            ctx.accounts.from.amount,
        )?;

        Ok(())
    }

    pub fn update_admin_auth(ctx: Context<UpdateAdminAuth>) -> Result<()> {
        let distributor = &mut ctx.accounts.distributor;
        distributor.admin_auth = ctx.accounts.new_admin_auth.key();

        Ok(())
    }
}

/// Accounts for [merkle_distributor::new_distributor].
#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct NewDistributor<'info> {
    /// Base key of the distributor.
    pub base: Signer<'info>,
    /// Admin key of the distributor.
    pub admin_auth: Signer<'info>,

    /// [MerkleDistributor].
    #[account(
    init,
    seeds = [
    b"MerkleDistributor".as_ref(),
    base.key().to_bytes().as_ref(),
    ],
    bump,
    payer = payer,
    space = 8 + MerkleDistributor::LEN,
    )]
    pub distributor: Account<'info, MerkleDistributor>,

    /// The mint to distribute.
    pub mint: Account<'info, Mint>,

    /// Payer to create the distributor.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The [System] program.
    pub system_program: Program<'info, System>,
}

/// Accounts for [merkle_distributor::update_distributor_admin_auth].
#[derive(Accounts)]
pub struct UpdateDistributorAdminAuth<'info> {
    /// Admin key of the distributor.
    pub admin_auth: Signer<'info>,

    /// CHECK: Just have new admin not be signer
    pub new_admin: AccountInfo<'info>,

    #[account(mut, has_one = admin_auth @ ErrorCode::DistributorAdminMismatch)]
    pub distributor: Account<'info, MerkleDistributor>,
}

/// Accounts for [merkle_distributor::update_distributor].
#[derive(Accounts)]
pub struct UpdateDistributor<'info> {
    /// Admin key of the distributor.
    pub admin_auth: Signer<'info>,

    #[account(mut, has_one = admin_auth @ ErrorCode::DistributorAdminMismatch)]
    pub distributor: Account<'info, MerkleDistributor>,
}

/// [merkle_distributor::claim] accounts.
#[derive(Accounts)]
pub struct Claim<'info> {
    /// The [MerkleDistributor].
    #[account(mut)]
    pub distributor: Account<'info, MerkleDistributor>,

    /// Status of the claim.
    #[account(
    init_if_needed,
    seeds = [
    b"ClaimStatus".as_ref(),
    distributor.key().to_bytes().as_ref(),
    claimant.key().to_bytes().as_ref()
    ],
    bump,
    payer = payer,
    space = 8 + ClaimStatus::LEN,
    )]
    pub claim_status: Account<'info, ClaimStatus>,

    /// Distributor ATA containing the tokens to distribute.
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,

    /// Account to send the claimed tokens to.
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,

    /// Who is claiming the tokens.
    #[account(address = to.owner @ ErrorCode::OwnerMismatch)]
    pub claimant: Signer<'info>,

    /// Payer of the claim.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The [System] program.
    pub system_program: Program<'info, System>,

    /// SPL [Token] program.
    pub token_program: Program<'info, Token>,
}

/// [merkle_distributor::claim_stake] accounts.
#[derive(Accounts)]
pub struct ClaimStake<'info> {
    /// The [MerkleDistributor].
    #[account(mut)]
    pub distributor: Account<'info, MerkleDistributor>,

    /// Status of the claim.
    #[account(
    init_if_needed,
    seeds = [
    b"ClaimStatus".as_ref(),
    distributor.key().to_bytes().as_ref(),
    claimant.key().to_bytes().as_ref()
    ],
    bump,
    payer = payer,
    space = 8 + ClaimStatus::LEN,
    )]
    pub claim_status: Account<'info, ClaimStatus>,

    /// Distributor ATA containing the tokens to distribute.
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,

    /// Account to send the claimed tokens to.
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,

    /// Zeta staking account
    pub zeta_staking: Program<'info, ZetaStaking>,

    /// Zeta protocol state
    #[account(mut)]
    pub cpi_protocol_state: Account<'info, zeta_staking::state::ProtocolState>,

    /// Zeta staking stake manager
    #[account(mut)]
    pub cpi_stake_account_manager: Account<'info, zeta_staking::state::StakeAccountManager>,

    /// CHECK: Zeta staking stake account PDA will be uninitialized and checked in the CPI
    #[account(mut)]
    pub cpi_stake_account: AccountInfo<'info>,

    /// CHECK: Zeta staking stake vault PDA will be uninitialized and checked in the CPI
    #[account(mut)]
    pub cpi_stake_vault: AccountInfo<'info>,

    /// Zeta mint, address is checked in the CPI
    pub zeta_mint: Account<'info, Mint>,

    /// Who is claiming the tokens.
    #[account(address = to.owner @ ErrorCode::OwnerMismatch)]
    pub claimant: Signer<'info>,

    /// Payer of the claim.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The [System] program.
    pub system_program: Program<'info, System>,

    /// SPL [Token] program.
    pub token_program: Program<'info, Token>,
}

/// [merkle_distributor::admin_claim_after_expiry] accounts.
#[derive(Accounts)]
pub struct AdminClaimAfterExpiry<'info> {
    /// The [MerkleDistributor].
    #[account(mut, has_one = admin_auth @ ErrorCode::DistributorAdminMismatch)]
    pub distributor: Account<'info, MerkleDistributor>,

    /// Distributor ATA containing the tokens to distribute.
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,

    /// Account to send the claimed tokens to.
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,

    /// Who is claiming the tokens and the payer.
    #[account(
        mut,
        address = to.owner @ ErrorCode::OwnerMismatch
    )]
    pub admin_auth: Signer<'info>,

    /// SPL [Token] program.
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateAdminAuth<'info> {
    pub new_admin_auth: Signer<'info>,

    pub admin_auth: Signer<'info>,

    #[account(mut, has_one = admin_auth @ ErrorCode::DistributorAdminMismatch)]
    pub distributor: Account<'info, MerkleDistributor>,
}

/// State for the account which distributes tokens.
#[account]
#[derive(Default)]
pub struct MerkleDistributor {
    /// Base key used to generate the PDA.
    pub base: Pubkey, // 32
    /// Admin key used to generate the PDA.
    pub admin_auth: Pubkey, // 32
    /// Bump seed.
    pub bump: u8, // 1

    /// The 256-bit merkle root.
    pub root: [u8; 32], // 32

    /// [Mint] of the token to be distributed.
    pub mint: Pubkey, // 32
    /// Maximum number of tokens that can ever be claimed from this [MerkleDistributor].
    pub max_total_claim: u64, // 8
    /// Maximum number of nodes that can ever be claimed from this [MerkleDistributor].
    pub max_num_nodes: u64, // 8
    /// Total amount of tokens that have been claimed.
    pub total_amount_claimed: u64, // 8
    /// Number of nodes that have been claimed.
    pub num_nodes_claimed: u64, // 8
    /// Timestamp you can start claiming // 8
    pub claim_start_ts: u64,
    /// Timestamp you can no longer claim at // 8
    pub claim_end_ts: u64,
    /// Whether this merkle tree will be directly staked // 1
    pub stake_claim_only: bool,
    /// Percentage of allocated tokens you get if you claim immediately, 6dp percentage e.g 60_000000 = 60%
    pub immediate_claim_percentage: u64,
    /// the offset from claim_start_ts in seconds when there is no more discount on claim
    pub later_claim_offset_seconds: u64,
}

impl MerkleDistributor {
    pub const LEN: usize = 194;
}

/// Holds whether or not a claimant has claimed tokens.
///
/// TODO: this is probably better stored as the node that was verified.
#[account]
#[derive(Default)]
pub struct ClaimStatus {
    /// Authority that claimed the tokens.
    pub claimant: Pubkey, // 64
    /// When the tokens were claimed.
    pub claimed_at: i64, // 8
    /// Amount of tokens claimed.
    pub claimed_amount: u64, // 8
}

impl ClaimStatus {
    pub const LEN: usize = 80;
}

/// Emitted when tokens are claimed.
#[event]
pub struct ClaimedEvent {
    pub root: [u8; 32],
    /// Index of the claim.
    pub index: u64,
    /// User that claimed.
    pub claimant: Pubkey,
    /// Amount of tokens to distribute.
    pub claim_amount: u64,
}

// Percentage is 6dp e.g 60% = 60_000000;
pub fn get_percentage(amount: u64, percentage: u64) -> u64 {
    (amount as u128)
        .checked_mul(percentage as u128)
        .unwrap()
        .checked_div(PERCENT_100 as u128)
        .unwrap()
        .try_into()
        .unwrap()
}

// Base percentage is the immediate claim_percentage, so the scale is from base_percentage - 100%
// e.g if total_offset_time is 1000 seconds, and elapsed time has been 600 seconds,
// base percetnage is 60% = 60_000000
// the scaled percetange should be 60_000000 + (100_000000 - 60_000000) * elapsed_time / total_offset_time
pub fn get_time_scaled_percentage(
    base_percentage: u64,
    elapsed_time: u64,
    total_offset_time: u64,
) -> u64 {
    let percentage_diff = PERCENT_100.checked_sub(base_percentage).unwrap();
    let a = (percentage_diff as u128)
        .checked_mul(elapsed_time as u128)
        .unwrap();

    let scaled_percentage = (base_percentage as u128)
        .checked_add((a as u128).checked_div(total_offset_time as u128).unwrap())
        .unwrap();

    scaled_percentage.try_into().unwrap()
}

/// Error codes.
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid Merkle proof.")]
    InvalidProof,
    #[msg("Drop already claimed.")]
    DropAlreadyClaimed,
    #[msg("Exceeded maximum claim amount.")]
    ExceededMaxClaim,
    #[msg("Exceeded maximum number of claimed nodes.")]
    ExceededMaxNumNodes,
    #[msg("Account is not authorized to execute this instruction")]
    Unauthorized,
    #[msg("Token account owner did not match intended owner")]
    OwnerMismatch,
    #[msg("Admin account not match distributor creator")]
    DistributorAdminMismatch,
    #[msg("no claimable amount")]
    NoClaimableAmount,
    #[msg("update root no change")]
    UpdateRootNoChange,
    #[msg("Invalid distributor token account")]
    InvalidDistributorTokenAccount,
    #[msg("Outside the claim window")]
    OutsideClaimWindow,
    #[msg("Must claim tokens direct to stake")]
    MustClaimDirectToStake,
    #[msg("Can only admin claim after the claim window is over")]
    InsideClaimWindow,
    #[msg("Invalid stake duration")]
    InvalidStakeDuration,
}
