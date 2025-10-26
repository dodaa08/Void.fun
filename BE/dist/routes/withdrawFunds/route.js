import { Router } from "express";
import { User } from "../../Db/schema.js";
import { Connection, PublicKey, Keypair, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "@solana/web3.js"; // Added sendAndConfirmTransaction
import * as anchor from "@coral-xyz/anchor"; // Uncommented
import idl_raw from "../../contracts/casino_simple.json" with { type: "json" }; // Renamed to avoid conflict
const idl = idl_raw; // Explicitly type idl
import logger from "../../utils/logger.js";
import { Payout } from "../../Db/schema.js";
import dotenv from "dotenv";
import { Buffer } from 'buffer'; // Explicitly import Buffer
dotenv.config();
// const IDL_PATH = "../../../../casino-simple/target/idl/casino_simple.json"; // Commented out
// Solana configuration
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const CASINO_PROGRAM_ID = process.env.CASINO_PROGRAM_ID || "7eoY2tr9vaZEEjX1q64q3ovND5Erg9ZjK8CfujxDfh8p";
const SOLANA_AUTHORITY_PRIVATE_KEY = process.env.SOLANA_AUTHORITY_PRIVATE_KEY || "";
const connection = new Connection(SOLANA_RPC_URL);
const programId = new PublicKey(CASINO_PROGRAM_ID); // Explicitly type programId
// Create authority keypair with error handling
let authorityKeypair;
try {
    const privateKeyArray = JSON.parse(SOLANA_AUTHORITY_PRIVATE_KEY);
    authorityKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
}
catch (error) {
    console.error("Error parsing SOLANA_AUTHORITY_PRIVATE_KEY:", error);
    throw new Error("Invalid SOLANA_AUTHORITY_PRIVATE_KEY format");
}
// Derive casino PDA
const [casinoPda] = PublicKey.findProgramAddressSync([Buffer.from("casino"), authorityKeypair.publicKey.toBuffer()], programId);
// Initialize Anchor Provider and Program
const wallet = new anchor.Wallet(authorityKeypair); // Uncommented
const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions()); // Uncommented and explicitly typed
const program = new anchor.Program(idl, provider); // Explicitly typed program generic
const WithdrawFundsRouter = Router();
const withdrawFunds = async (req, res) => {
    const { walletAddress, amount, signedTransaction } = req.body;
    logger.info("[Withdraw] request", { walletAddress, amount });
    // Input validation
    if (!walletAddress || !amount || amount <= 0 || !signedTransaction) {
        logger.warn("[Withdraw] invalid input", { walletAddress, amount, hasSignedTransaction: !!signedTransaction });
        return res.status(400).json({
            success: false,
            message: "Invalid input: walletAddress, positive amount, and signedTransaction required"
        });
    }
    // Validate Solana wallet address format
    try {
        new PublicKey(walletAddress);
    }
    catch (error) {
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
            message: "Minimum withdrawal amount is 0.001 SOL"
        });
    }
    try {
        // Find user
        const user = await User.findOne({ walletAddress });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        // Calculate total available balance (deposits + winnings) in user's DB entry
        const userAvailableBalance = (user.DepositBalance || 0) + (user.totalEarned || 0);
        if (userAvailableBalance < amount) {
            return res.status(400).json({
                success: false,
                message: `Insufficient balance in your account. Available: ${userAvailableBalance} SOL, Requested: ${amount} SOL`,
                maxWithdrawable: userAvailableBalance
            });
        }
        // Check casino PDA balance before attempting withdrawal
        const casinoPda = PublicKey.findProgramAddressSync([Buffer.from("casino"), authorityKeypair.publicKey.toBuffer()], programId)[0];
        const casinoBalanceLamports = await connection.getBalance(casinoPda);
        const casinoBalanceSol = casinoBalanceLamports / LAMPORTS_PER_SOL;
        logger.debug("[Withdraw] casino balance/req", { balance: casinoBalanceSol, amount });
        if (casinoBalanceSol < amount) {
            return res.status(400).json({
                success: false,
                message: `Casino has insufficient funds. Available: ${casinoBalanceSol} SOL, Requested: ${amount} SOL`,
                maxWithdrawable: casinoBalanceSol
            });
        }
        logger.debug("[Withdraw] receiving and signing transaction");
        // Deserialize the partially signed transaction from the frontend
        const transaction = Transaction.from(Buffer.from(signedTransaction, 'base64'));
        // Verify the instruction and accounts (similar to deposit, but for withdraw)
        const expectedProgramId = program.programId;
        const instruction = transaction.instructions[0]; // Assuming the withdraw instruction is the first one
        if (!instruction || !instruction.programId.equals(expectedProgramId)) {
            logger.warn("[Withdraw] Transaction does not contain expected program instruction");
            return res.status(400).json({ success: false, message: "Invalid transaction: Program instruction mismatch" });
        }
        const expectedUserPubkey = new PublicKey(walletAddress);
        const [userAccountPda] = PublicKey.findProgramAddressSync([Buffer.from("user"), expectedUserPubkey.toBuffer(), casinoPda.toBuffer()], programId);
        const accountMetaPubkeys = instruction.keys.map(key => key.pubkey.toBase58());
        if (!accountMetaPubkeys.includes(expectedUserPubkey.toBase58())) {
            logger.warn("[Withdraw] User not found in transaction accounts");
            return res.status(400).json({ success: false, message: "User account mismatch in transaction" });
        }
        if (!accountMetaPubkeys.includes(userAccountPda.toBase58())) {
            logger.warn("[Withdraw] User account PDA not found in transaction accounts");
            return res.status(400).json({ success: false, message: "User PDA account mismatch in transaction" });
        }
        if (!accountMetaPubkeys.includes(casinoPda.toBase58())) {
            logger.warn("[Withdraw] Casino PDA not found in transaction accounts");
            return res.status(400).json({ success: false, message: "Casino PDA account mismatch in transaction" });
        }
        // For withdraw, the user has already signed the transaction
        // We don't need to add authority signature since authority is not part of withdraw instruction
        // Send the transaction as-is
        let withdrawalTx;
        try {
            withdrawalTx = await sendAndConfirmTransaction(connection, transaction, [] // No additional signers needed - user already signed
            );
        }
        catch (txError) {
            logger.error("[Withdraw] sendAndConfirmTransaction failed:", txError);
            let errorMessage = txError.message || "Solana transaction failed during send.";
            if (txError.logs) {
                errorMessage += ` Logs: ${txError.logs.join(' | ')}`;
            }
            throw new Error(errorMessage);
        }
        logger.info("[Withdraw] tx sent", withdrawalTx);
        logger.info("[Withdraw] tx confirmed", withdrawalTx);
        // Fetch full transaction details to inspect logs for instruction errors
        const confirmedTx = await connection.getTransaction(withdrawalTx, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
        });
        if (confirmedTx?.meta?.logMessages) {
            logger.debug("[Withdraw] Transaction log messages:", confirmedTx.meta.logMessages);
            const instructionError = confirmedTx.meta.logMessages.find(log => log.includes("failed"));
            if (instructionError) {
                logger.error("[Withdraw] Instruction execution failed:", instructionError);
                throw new Error(`Solana instruction failed: ${instructionError}`);
            }
        }
        // Use the transaction hash
        const txHash = withdrawalTx;
        // Update user balance in DB
        const updatedUser = await User.findOneAndUpdate({ walletAddress }, {
            $inc: {
                DepositBalance: -amount, // Deduct from deposited balance
                balance: -amount, // Deduct from overall balance
                payouts: amount, // Record as payout
            },
        }, { new: true });
        if (updatedUser == null)
            return res.status(400).json({ success: false, message: "User not found after update" });
        await Payout.create({ user: updatedUser._id, amount, txHash: txHash });
        res.status(200).json({
            success: true,
            message: "Funds withdrawn successfully",
            data: {
                withdrawnAmount: amount,
                remainingBalance: updatedUser?.DepositBalance || 0,
                transactionHash: txHash
            }
        });
    }
    catch (error) {
        logger.error("Withdrawal error:", error);
        let errorMessage = "Internal server error";
        if (error.message) {
            errorMessage = error.message;
        }
        // Attempt to extract more specific error from Solana RPC if available
        if (error.logs && Array.isArray(error.logs)) {
            const solanaError = error.logs.find((log) => log.includes("Program failed"));
            if (solanaError) {
                errorMessage = `Solana transaction failed: ${solanaError}`;
            }
        }
        res.status(500).json({
            success: false,
            message: errorMessage,
            error: process.env.NODE_ENV === 'development' ? error : undefined // Provide full error in dev
        });
    }
};
// Get casino info endpoint
const getContractInfo = async (req, res) => {
    try {
        const casinoBalance = await connection.getBalance(casinoPda);
        const casinoBalanceSOL = casinoBalance / LAMPORTS_PER_SOL; // Use LAMPORTS_PER_SOL for consistency
        res.status(200).json({
            success: true,
            data: {
                casinoAddress: casinoPda.toString(),
                casinoBalance: casinoBalanceSOL,
                casinoBalanceLamports: casinoBalance.toString(),
                programId: programId.toString()
            }
        });
    }
    catch (error) {
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
//# sourceMappingURL=route.js.map