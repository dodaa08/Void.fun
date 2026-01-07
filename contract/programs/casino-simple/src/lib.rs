use anchor_lang::prelude::*;

declare_id!("7eoY2tr9vaZEEjX1q64q3ovND5Erg9ZjK8CfujxDfh8p");

#[program]
pub mod casino_simple {
    use super::*;

    // Initialize the casino
    pub fn initialize_casino(ctx: Context<InitializeCasino>) -> Result<()> {
        let casino = &mut ctx.accounts.casino;
        casino.authority = ctx.accounts.authority.key();
        casino.total_deposits = 0;
        casino.total_withdrawals = 0;
        casino.bump = ctx.bumps.casino;
        
        msg!("Casino initialized with authority: {}", casino.authority);
        Ok(())
    }

    // Deposit SOL to casino
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let user_account: &mut Account<'_, UserAccount> = &mut ctx.accounts.user_account;
        
        // Transfer SOL from user to casino
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.casino.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, amount)?;

        // Update user account
        user_account.balance = user_account.balance.checked_add(amount).unwrap();
        user_account.total_deposits = user_account.total_deposits.checked_add(amount).unwrap();
        
        // Update casino stats
        let casino = &mut ctx.accounts.casino;
        casino.total_deposits = casino.total_deposits.checked_add(amount).unwrap();
        
        msg!("Deposited {} lamports to casino", amount);
        Ok(())
    }

    // Withdraw SOL from casino
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        
        // Check if user has sufficient balance
        require!(user_account.balance >= amount, ErrorCode::InsufficientBalance);
        
        // Manual lamport transfer (can't use system_program::transfer for PDA with data)
        **ctx.accounts.casino.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += amount;

        // Update user account
        user_account.balance = user_account.balance.checked_sub(amount).unwrap();
        user_account.total_withdrawals = user_account.total_withdrawals.checked_add(amount).unwrap();
        
        // Update casino stats
        let casino = &mut ctx.accounts.casino;
        casino.total_withdrawals = casino.total_withdrawals.checked_add(amount).unwrap();
        
        msg!("Withdrew {} lamports from casino", amount);
        Ok(())
    }

    // Emergency withdraw (only for authority) - transfer all SOL to authority
    pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>) -> Result<()> {
        // Only authority can call this
        require!(ctx.accounts.authority.key() == ctx.accounts.casino.authority, ErrorCode::Unauthorized);
        
        // Get casino balance (excluding rent-exempt minimum)
        let casino_balance = ctx.accounts.casino.to_account_info().lamports();
        let rent_exempt_minimum = Rent::get()?.minimum_balance(ctx.accounts.casino.to_account_info().data_len());
        let withdrawable_balance = casino_balance.saturating_sub(rent_exempt_minimum);
        
        require!(withdrawable_balance > 0, ErrorCode::InsufficientBalance);
        
        // Manual lamport transfer (can't use system_program::transfer for PDA with data)
        **ctx.accounts.casino.to_account_info().try_borrow_mut_lamports()? -= withdrawable_balance;
        **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? += withdrawable_balance;
        
        msg!("Emergency withdrawal of {} lamports", withdrawable_balance);
        Ok(())
    }

    // Owner deposit function - authority can deposit SOL to casino
    pub fn owner_deposit(ctx: Context<OwnerDeposit>, amount: u64) -> Result<()> {
        require!(ctx.accounts.authority.key() == ctx.accounts.casino.authority, ErrorCode::Unauthorized);
        require!(amount > 0, ErrorCode::InvalidBetAmount);
        
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.casino.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, amount)?;
        
        msg!("Owner deposited {} lamports to casino", amount);
        Ok(())
    }

    // Payout function - transfer amount to address (authority only)
    pub fn payout(ctx: Context<Payout>, amount: u64) -> Result<()> {
        require!(ctx.accounts.authority.key() == ctx.accounts.casino.authority, ErrorCode::Unauthorized);
        require!(amount > 0, ErrorCode::InvalidBetAmount);
        
        // Manual lamport transfer from casino to recipient
        **ctx.accounts.casino.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.recipient.to_account_info().try_borrow_mut_lamports()? += amount;
        
        msg!("Payout of {} lamports to {}", amount, ctx.accounts.recipient.key());
        Ok(())
    }

    // Get casino balance
    pub fn get_balance(ctx: Context<GetBalance>) -> Result<u64> {
        let casino_balance = ctx.accounts.casino.to_account_info().lamports();
        let rent_exempt_minimum = Rent::get()?.minimum_balance(ctx.accounts.casino.to_account_info().data_len());
        let available_balance = casino_balance.saturating_sub(rent_exempt_minimum);
        
        msg!("Casino balance: {} lamports", available_balance);
        Ok(available_balance)
    }

    // Get user balance
    pub fn get_user_balance(ctx: Context<GetUserBalance>) -> Result<u64> {
        let user_balance = ctx.accounts.user_account.balance;
        
        msg!("User balance: {} lamports", user_balance);
        Ok(user_balance)
    }

    // Initialize a user account for the casino
    pub fn initialize_user_account(ctx: Context<InitializeUserAccount>) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        user_account.user = ctx.accounts.user.key();
        user_account.casino = ctx.accounts.casino.key();
        user_account.balance = 0;
        user_account.total_deposits = 0;
        user_account.total_withdrawals = 0;
        user_account.total_winnings = 0;
        user_account.total_losses = 0;
        user_account.bump = ctx.bumps.user_account;
        msg!("User account initialized for user: {}", user_account.user);
        Ok(())
    }
}

// Account structures
#[derive(Accounts)]
pub struct InitializeCasino<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Casino::INIT_SPACE,
        seeds = [b"casino", authority.key().as_ref()],
        bump
    )]
    pub casino: Account<'info, Casino>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"casino", casino.authority.as_ref()],
        bump = casino.bump
    )]
    pub casino: Account<'info, Casino>,
    
    #[account(
        mut,
        has_one = user,
        seeds = [b"user", user.key().as_ref(), casino.key().as_ref()],
        bump = user_account.bump
    )]
    pub user_account: Account<'info, UserAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"casino", casino.authority.as_ref()],
        bump = casino.bump
    )]
    pub casino: Account<'info, Casino>,
    
    #[account(
        mut,
        seeds = [b"user", user.key().as_ref(), casino.key().as_ref()],
        bump = user_account.bump
    )]
    pub user_account: Account<'info, UserAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    #[account(
        mut,
        seeds = [b"casino", casino.authority.as_ref()],
        bump = casino.bump
    )]
    pub casino: Account<'info, Casino>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OwnerDeposit<'info> {
    #[account(
        mut,
        seeds = [b"casino", casino.authority.as_ref()],
        bump = casino.bump
    )]
    pub casino: Account<'info, Casino>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Payout<'info> {
    #[account(
        mut,
        seeds = [b"casino", casino.authority.as_ref()],
        bump = casino.bump
    )]
    pub casino: Account<'info, Casino>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetBalance<'info> {
    #[account(
        seeds = [b"casino", casino.authority.as_ref()],
        bump = casino.bump
    )]
    pub casino: Account<'info, Casino>,
}

#[derive(Accounts)]
pub struct GetUserBalance<'info> {
    #[account(
        seeds = [b"casino", casino.authority.as_ref()],
        bump = casino.bump
    )]
    pub casino: Account<'info, Casino>,
    
    #[account(
        seeds = [b"user", user.key().as_ref(), casino.key().as_ref()],
        bump = user_account.bump
    )]
    pub user_account: Account<'info, UserAccount>,
    
    pub user: SystemAccount<'info>,
}

#[derive(Accounts)]
pub struct InitializeUserAccount<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + UserAccount::INIT_SPACE,
        seeds = [b"user", user.key().as_ref(), casino.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        seeds = [b"casino", casino.authority.as_ref()],
        bump = casino.bump
    )]
    pub casino: Account<'info, Casino>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// Data structures
#[account]
pub struct Casino {
    pub authority: Pubkey,
    pub total_deposits: u64,
    pub total_withdrawals: u64,
    pub bump: u8,
}

impl Casino {
    pub const INIT_SPACE: usize = 32 + 8 + 8 + 1;
}

#[account]
pub struct UserAccount {
    pub user: Pubkey,
    pub casino: Pubkey,
    pub balance: u64,
    pub total_deposits: u64,
    pub total_withdrawals: u64,
    pub total_winnings: u64,
    pub total_losses: u64,
    pub bump: u8,
}

impl UserAccount {
    pub const INIT_SPACE: usize = 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1;
}

// Error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid bet amount")]
    InvalidBetAmount,
}