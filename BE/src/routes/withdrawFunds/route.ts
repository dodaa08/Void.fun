import { Router } from "express";
import { User } from "../../Db/schema.js";
import { Connection, PublicKey, Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import logger from "../../utils/logger.js";
import { Payout } from "../../Db/schema.js";

// Solana configuration
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const CASINO_PROGRAM_ID = process.env.CASINO_PROGRAM_ID || "7eoY2tr9vaZEEjX1q64q3ovND5Erg9ZjK8CfujxDfh8p";
const SOLANA_AUTHORITY_PRIVATE_KEY = process.env.SOLANA_AUTHORITY_PRIVATE_KEY || "";

const connection = new Connection(SOLANA_RPC_URL);
const programId = new PublicKey(CASINO_PROGRAM_ID);

// Create authority keypair with error handling
let authorityKeypair: Keypair;
try {
  const privateKeyArray = JSON.parse(SOLANA_AUTHORITY_PRIVATE_KEY);
  authorityKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
} catch (error) {
  console.error("Error parsing SOLANA_AUTHORITY_PRIVATE_KEY:", error);
  throw new Error("Invalid SOLANA_AUTHORITY_PRIVATE_KEY format");
}

// Derive casino PDA
const [casinoPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("casino"), authorityKeypair.publicKey.toBuffer()],
  programId
);

const WithdrawFundsRouter = Router();


const withdrawFunds = async (req: any, res: any) => {
    const {walletAddress, amount} = req.body;
    
    logger.info("[Withdraw] request", { walletAddress, amount });
    
    // Input validation
    if (!walletAddress || !amount || amount <= 0) {
        logger.warn("[Withdraw] invalid input", { walletAddress, amount });
        return res.status(400).json({ 
            success: false, 
            message: "Invalid input: walletAddress and positive amount required" 
        });
    }

    // Validate Solana wallet address format
    try {
        new PublicKey(walletAddress);
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            message: "Invalid Solana wallet address format" 
        });
    }

    // Minimum withdrawal amount check
    if (amount < 0.001) {
        logger.warn("[Withdraw] amount too small", amount);
        return res.status(400).json({ 
            success: false, 
            message: "Minimum withdrawal amount is 0.001 ETH" 
        });
    }
    
    try {
        // Find user
        const user = await User.findOne({walletAddress});
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        
        // Calculate total available balance (deposits + winnings)
        const totalAvailableBalance = (user.DepositBalance || 0) + (user.totalEarned || 0);
        
        
        
        // Check casino balance before attempting withdrawal
        const casinoBalance = await connection.getBalance(casinoPda);
        const amountInLamports = Math.floor(amount * 1e9); // Convert SOL to lamports
        
        logger.debug("[Withdraw] balance/req", { balance: casinoBalance / 1e9, amount });
        
        if (casinoBalance < amountInLamports) {
            const maxWithdrawable = casinoBalance / 1e9;
            return res.status(400).json({ 
                success: false, 
                message: `Casino has insufficient funds. Available: ${casinoBalance / 1e9} SOL, Requested: ${amount} SOL`,
                maxWithdrawable: maxWithdrawable
            });
        }
        
        // Execute withdrawal using direct Solana transfer from authority to user
        logger.debug("[Withdraw] calling direct Solana transfer", amountInLamports);
        
        // Transfer from authority account to user's wallet address
        const transaction = new Transaction();
        transaction.add(
            SystemProgram.transfer({
                fromPubkey: authorityKeypair.publicKey,
                toPubkey: new PublicKey(walletAddress), // Use user's wallet from request body
                lamports: amountInLamports,
            })
        );
        
        // Sign and send transaction
        const withdrawTx = await connection.sendTransaction(transaction, [authorityKeypair]);
        logger.info("[Withdraw] tx sent", withdrawTx);
        
        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(withdrawTx, 'confirmed');
        if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }
        
        logger.info("[Withdraw] tx confirmed", withdrawTx);
        
        // Use the transaction hash
        const txHash = withdrawTx;
        
        // Calculate actual winnings (total withdrawal - original deposit)
        const originalDeposit = user.DepositBalance || 0;
        const actualWinnings = amount - originalDeposit;
        
        logger.debug("[Withdraw] computed", { originalDeposit, amount, actualWinnings });
        
        // Reset deposit balance and add only actual winnings to totalEarned
        const updatedUser = await User.findOneAndUpdate(
            { walletAddress },
            {
                $set: {
                    DepositBalance: 0     // Reset deposit balance to 0 (cashed out)
                },
                $inc: {
                    roundsPlayed: 1,
                    totalEarned: Math.max(0, actualWinnings)  // Only add winnings, not deposit
                }
            },
            { new: true }
        );

        // Track all the withdrawals: from casino to user address in payouts db
        if(updatedUser == null) return res.status(400).json({ success: false, message: "User not found" });
        await Payout.create({user: updatedUser._id, amount, txHash: txHash});

        res.status(200).json({ 
            success: true, 
            message: "Funds withdrawn successfully", 
            data: {
                withdrawnAmount: amount,
                remainingBalance: updatedUser?.DepositBalance || 0,
                transactionHash: txHash
            }
        });
    } catch (error: any) {
        logger.error("Withdrawal error:", error);
        
        // Handle specific contract errors
        if (error.message?.includes("Insufficient balance")) {
            return res.status(400).json({ 
                success: false, 
                message: "Insufficient balance in contract" 
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}


// Get casino info endpoint
const getContractInfo = async (req: any, res: any) => {
    try {
        const casinoBalance = await connection.getBalance(casinoPda);
        const casinoBalanceSOL = casinoBalance / 1e9;
        
        res.status(200).json({
            success: true,
            data: {
                casinoAddress: casinoPda.toString(),
                casinoBalance: casinoBalanceSOL,
                casinoBalanceLamports: casinoBalance.toString(),
                programId: programId.toString()
            }
        });
    } catch (error: any) {
        logger.error("Casino info error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get casino info",
            error: error.message
        });
    }
};

WithdrawFundsRouter.post("/wd", withdrawFunds);
WithdrawFundsRouter.get("/contract-info", getContractInfo);

export default WithdrawFundsRouter;