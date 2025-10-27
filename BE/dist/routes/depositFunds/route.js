import { Router } from "express";
import { User } from "../../Db/schema.js";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import logger from "../../utils/logger.js";
import dotenv from "dotenv";
import { Buffer } from 'buffer';
import * as anchor from "@coral-xyz/anchor"; // Added Anchor import
import idl_raw from "../../contracts/casino_simple.json" with { type: "json" }; // Added IDL import
dotenv.config();
const idl = idl_raw; // Explicitly type idl
// Solana configuration
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const CASINO_PROGRAM_ID = process.env.CASINO_PROGRAM_ID || "7eoY2tr9vaZEEjX1q64q3ovND5Erg9ZjK8CfujxDfh8p";
const SOLANA_AUTHORITY_PRIVATE_KEY = process.env.SOLANA_AUTHORITY_PRIVATE_KEY || "";
const connection = new Connection(SOLANA_RPC_URL);
const programId = new PublicKey(CASINO_PROGRAM_ID); // Explicitly type programId
// Create authority keypair with error handling (needed for PDA derivation)
let authorityKeypair;
try {
    const privateKeyArray = JSON.parse(SOLANA_AUTHORITY_PRIVATE_KEY);
    authorityKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
}
catch (error) {
    console.error("Error parsing SOLANA_AUTHORITY_PRIVATE_KEY in depositFunds:", error);
    throw new Error("Invalid SOLANA_AUTHORITY_PRIVATE_KEY format. Please ensure it's a 64-byte JSON array.");
}
// Initialize Anchor Provider and Program without an explicit signer for user-initiated transactions
const provider = new anchor.AnchorProvider(connection, null, anchor.AnchorProvider.defaultOptions());
const program = new anchor.Program(idl, provider); // Explicitly typed program generic
const DepositFundsRouter = Router();
const depositFunds = async (req, res) => {
    const { walletAddress, amount, txHash, diedOnDeathTile, signedTransaction, lastValidBlockHeight: frontendLastValidBlockHeight } = req.body;
    logger.info("[Deposit] request", { walletAddress, amount, txHash });
    logger.debug("[Deposit] types", {
        walletAddressType: typeof walletAddress,
        amountType: typeof amount,
        txHashType: typeof txHash,
        walletAddressValue: walletAddress,
        amountValue: amount,
        txHashValue: txHash,
        hasSignedTransaction: !!signedTransaction,
        lastValidBlockHeightType: typeof frontendLastValidBlockHeight
    });
    // Input validation
    if (!walletAddress || !amount || !signedTransaction || typeof frontendLastValidBlockHeight === 'undefined') {
        logger.warn("[Deposit] validation failed", {
            hasWalletAddress: !!walletAddress,
            hasAmount: !!amount,
            hasSignedTransaction: !!signedTransaction,
            hasLastValidBlockHeight: typeof frontendLastValidBlockHeight !== 'undefined'
        });
        return res.status(400).json({
            success: false,
            message: "Missing required fields: walletAddress, amount, signedTransaction, lastValidBlockHeight"
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
        let user = await User.findOne({ walletAddress });
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
        }
        else {
            logger.debug("[Deposit] User found:", user);
        }
        // The frontend now sends a fully signed, serialized transaction.
        // The backend simply relays it and uses lastValidBlockHeight for confirmation.
        logger.debug("[Deposit] Received serialized transaction from frontend. Sending directly.");
        const rawTransaction = Buffer.from(signedTransaction, 'base64');
        const { blockhash, lastValidBlockHeight: backendLastValidBlockHeight } = await connection.getLatestBlockhash();
        logger.debug("[Deposit] Fresh backend blockhash:", blockhash);
        logger.debug("[Deposit] Fresh backend last valid block height:", backendLastValidBlockHeight);
        let depositTx;
        try {
            logger.debug("[Deposit] Sending raw transaction...");
            depositTx = await connection.sendRawTransaction(rawTransaction, { skipPreflight: true }); // skipPreflight for more reliability
            logger.debug("[Deposit] Transaction sent, confirming:", depositTx);
            await connection.confirmTransaction({ signature: depositTx, lastValidBlockHeight: frontendLastValidBlockHeight, blockhash: blockhash }, 'confirmed');
            logger.debug("[Deposit] Transaction confirmed.");
        }
        catch (txError) {
            logger.error("[Deposit] sendRawTransaction failed:", txError);
            let errorMessage = txError.message || "Solana transaction failed during send.";
            if (txError.logs) {
                errorMessage += ` Logs: ${txError.logs.join(' | ')}`;
            }
            throw new Error(errorMessage);
        }
        logger.debug("[Deposit] Solana transaction sent and confirmed", depositTx);
        // Update user balance atomically
        logger.debug("[Deposit] Attempting to update user balance in DB for wallet:", walletAddress);
        const updatedUser = await User.findOneAndUpdate({ walletAddress }, { $inc: { DepositBalance: amount, balance: amount } }, // Also update overall balance
        { new: true });
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
    }
    catch (error) {
        logger.error("Deposit funds error (caught in outer try-catch):", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
const FetchDepositFunds = async (req, res) => {
    try {
        const { walletAddress } = req.body;
        logger.debug("[FetchDepositFunds] fetch request", { walletAddress });
        if (!walletAddress) {
            return res.status(400).json({
                success: false,
                message: "Missing required field: walletAddress"
            });
        }
        // Find or create user if they don't exist
        logger.debug("[FetchDepositFunds] Attempting to find or create user:", walletAddress);
        let user = await User.findOne({ walletAddress });
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
        }
        else {
            logger.debug("[FetchDepositFunds] User found on fetch:", user);
        }
        res.status(200).json({
            success: true,
            message: "User balance fetched successfully",
            user: user
        });
    }
    catch (error) {
        logger.error("FetchDepositFunds error (caught in outer try-catch):", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
DepositFundsRouter.post("/dp", depositFunds);
DepositFundsRouter.post("/fd", FetchDepositFunds);
export default DepositFundsRouter;
//# sourceMappingURL=route.js.map