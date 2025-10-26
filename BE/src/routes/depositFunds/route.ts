import { Router } from "express";
import { User } from "../../Db/schema.js";
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram, TransactionResponse, VersionedTransactionResponse, LoadedAddresses, MessageAccountKeys, MessageCompiledInstruction, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import logger from "../../utils/logger.js";
import dotenv from "dotenv";
import { Buffer } from 'buffer';
import * as anchor from "@coral-xyz/anchor"; // Added Anchor import
import idl_raw from "../../contracts/casino_simple.json" with { type: "json" }; // Added IDL import
import BN from 'bn.js'; // Import BN from bn.js
dotenv.config();

const idl: anchor.Idl = idl_raw as anchor.Idl; // Explicitly type idl

// Solana configuration
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const CASINO_PROGRAM_ID = process.env.CASINO_PROGRAM_ID || "7eoY2tr9vaZEEjX1q64q3ovND5Erg9ZjK8CfujxDfh8p";
const SOLANA_AUTHORITY_PRIVATE_KEY = process.env.SOLANA_AUTHORITY_PRIVATE_KEY || "";

const connection = new Connection(SOLANA_RPC_URL);
const programId: PublicKey = new PublicKey(CASINO_PROGRAM_ID); // Explicitly type programId

// Create authority keypair with error handling (needed for PDA derivation)
let authorityKeypair: Keypair;
try {
  const privateKeyArray = JSON.parse(SOLANA_AUTHORITY_PRIVATE_KEY);
  authorityKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
} catch (error: any) {
  console.error("Error parsing SOLANA_AUTHORITY_PRIVATE_KEY in depositFunds:", error);
  throw new Error("Invalid SOLANA_AUTHORITY_PRIVATE_KEY format. Please ensure it's a 64-byte JSON array.");
}

// Initialize Anchor Provider and Program without an explicit signer for user-initiated transactions
const provider: anchor.AnchorProvider = new anchor.AnchorProvider(connection, null as any, anchor.AnchorProvider.defaultOptions());

const program: anchor.Program<typeof idl> = new anchor.Program(idl, provider); // Explicitly typed program generic

const DepositFundsRouter = Router();

const depositFunds = async (req: any, res: any) => {
    const {walletAddress, amount, txHash, diedOnDeathTile, signedTransaction} = req.body;
    
    logger.info("[Deposit] request", { walletAddress, amount, txHash });
    logger.debug("[Deposit] types", {
        walletAddressType: typeof walletAddress,
        amountType: typeof amount,
        txHashType: typeof txHash,
        walletAddressValue: walletAddress,
        amountValue: amount,
        txHashValue: txHash,
        hasSignedTransaction: !!signedTransaction
    });
    
    // Input validation
    if (!walletAddress || !amount || !signedTransaction) {
        logger.warn("[Deposit] validation failed", {
            hasWalletAddress: !!walletAddress,
            hasAmount: !!amount,
            hasSignedTransaction: !!signedTransaction
        });
        return res.status(400).json({ 
            success: false, 
            message: "Missing required fields: walletAddress, amount, signedTransaction" 
        });
    }
    
    if (amount <= 0) {
        return res.status(400).json({ 
            success: false, 
            message: "Amount must be greater than 0" 
        });
    }
    
    try {
        logger.debug("[Deposit] Attempting to find or create user:", walletAddress);
        // Find or create user
        let user = await User.findOne({walletAddress});
        if (!user) {
            logger.info("[Deposit] creating user", walletAddress);
            user = await User.create({
                walletAddress: walletAddress,
                DepositBalance: 0,
                balance: 0,
                totalEarned: 0,
                roundsPlayed: 0,
                payouts: 0
            });
            logger.debug("[Deposit] User created successfully:", user);
        } else {
            logger.debug("[Deposit] User found:", user);
        }
       
        // Deserialize the partially signed transaction from the frontend
        logger.debug("[Deposit] Deserializing signed transaction...");
        const transaction = Transaction.from(Buffer.from(signedTransaction, 'base64'));
        logger.debug("[Deposit] Transaction deserialized.");

        // Set a fresh recent blockhash on the transaction before sending
        logger.debug("[Deposit] Fetching recent blockhash...");
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        logger.debug("[Deposit] Recent blockhash set:", transaction.recentBlockhash);
        
        logger.debug("[Deposit] Transaction signatures (before backend serialize):", transaction.signatures.map(s => s.publicKey.toBase58()));
        // Check if the transaction contains the expected deposit instruction
        const expectedProgramId = program.programId;
        const instruction = transaction.instructions[0]; // Assuming the deposit instruction is the first one
        logger.debug("[Deposit] First instruction programId:", instruction?.programId.toBase58());
        logger.debug("[Deposit] Expected programId:", expectedProgramId.toBase58());

        if (!instruction || !instruction.programId.equals(expectedProgramId)) {
            logger.warn("[Deposit] Transaction does not contain expected program instruction");
            return res.status(400).json({ success: false, message: "Invalid transaction: Program instruction mismatch" });
        }

        // Verify expected accounts in the instruction
        const expectedUserPubkey = new PublicKey(walletAddress);
        logger.debug("[Deposit] Expected user pubkey:", expectedUserPubkey.toBase58());

        const [casinoPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("casino"), authorityKeypair.publicKey.toBuffer()],
            programId
        );
        logger.debug("[Deposit] Casino PDA:", casinoPda.toBase58());

        const [userAccountPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("user"), expectedUserPubkey.toBuffer(), casinoPda.toBuffer()],
            programId
        );
        logger.debug("[Deposit] User Account PDA:", userAccountPda.toBase58());

        // Verify the instruction accounts match expected PDAs and user
        const accountMetaPubkeys = instruction.keys.map(key => key.pubkey.toBase58());
        logger.debug("[Deposit] Instruction account pubkeys:", accountMetaPubkeys);

        if (!accountMetaPubkeys.includes(expectedUserPubkey.toBase58())) {
            logger.warn("[Deposit] User not found in transaction accounts");
            return res.status(400).json({ success: false, message: "User account mismatch in transaction" });
        }
        if (!accountMetaPubkeys.includes(userAccountPda.toBase58())) {
            logger.warn("[Deposit] User account PDA not found in transaction accounts");
            return res.status(400).json({ success: false, message: "User PDA account mismatch in transaction" });
        }
        if (!accountMetaPubkeys.includes(casinoPda.toBase58())) {
            logger.warn("[Deposit] Casino PDA not found in transaction accounts");
            return res.status(400).json({ success: false, message: "Casino PDA account mismatch in transaction" });
        }

        // For deposit, the user has already signed the transaction
        // We don't need to add authority signature since authority is not part of deposit instruction
        // Send the transaction as-is (already signed by frontend wallet)
        let depositTx: string;
        try {
            logger.debug("[Deposit] Sending raw transaction...");
            depositTx = await connection.sendRawTransaction(transaction.serialize());
            logger.debug("[Deposit] Transaction sent, confirming:", depositTx);
            await connection.confirmTransaction(depositTx, 'confirmed');
            logger.debug("[Deposit] Transaction confirmed.");
        } catch (txError: any) {
            logger.error("[Deposit] sendAndConfirmTransaction failed:", txError);
            let errorMessage = txError.message || "Solana transaction failed during send.";
            if (txError.logs) {
                errorMessage += ` Logs: ${txError.logs.join(' | ')}`;
            }
            throw new Error(errorMessage);
        }
        
        logger.debug("[Deposit] Solana transaction sent and confirmed", depositTx);
        
        // Update user balance atomically
        logger.debug("[Deposit] Attempting to update user balance in DB for wallet:", walletAddress);
        const updatedUser = await User.findOneAndUpdate(
            { walletAddress },
            { $inc: { DepositBalance: amount, balance: amount } }, // Also update overall balance
            { new: true }
        );
        
        if (!updatedUser) {
            logger.error("[Deposit] Failed to find and update user after successful transaction.");
            return res.status(500).json({ 
                success: false, 
                message: "Failed to update user balance" 
            });
        }
        logger.debug("[Deposit] User balance updated successfully:", updatedUser);
        
        res.status(200).json({ 
            success: true, 
            message: "Funds deposited successfully", 
            user: updatedUser,
            transactionHash: depositTx
        });

    } catch (error: any) {
        logger.error("Deposit funds error (caught in outer try-catch):", error);
        res.status(500).json({ 
            success: false, 
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}


const FetchDepositFunds = async (req: any, res: any) => {
    try {
        const {walletAddress} = req.body;
        
        logger.debug("[FetchDepositFunds] fetch request", { walletAddress });
        
        if (!walletAddress) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing required field: walletAddress" 
            });
        }
        
        // Find or create user if they don't exist
        logger.debug("[FetchDepositFunds] Attempting to find or create user:", walletAddress);
        let user = await User.findOne({walletAddress});
        if (!user) {
            logger.info("[FetchDepositFunds] creating user on fetch", walletAddress);
            user = await User.create({
                walletAddress: walletAddress,
                DepositBalance: 0,
                balance: 0,
                totalEarned: 0,
                roundsPlayed: 0,
                payouts: 0
            });
            logger.debug("[FetchDepositFunds] User created on fetch:", user);
        } else {
            logger.debug("[FetchDepositFunds] User found on fetch:", user);
        }
        
        res.status(200).json({ 
            success: true, 
            message: "User balance fetched successfully", 
            user: user 
        });
        
    } catch (error: any) {
        logger.error("FetchDepositFunds error (caught in outer try-catch):", error);
        res.status(500).json({ 
            success: false, 
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}


DepositFundsRouter.post("/dp", depositFunds);
DepositFundsRouter.post("/fd", FetchDepositFunds);

export default DepositFundsRouter;