import { User } from "../../Db/schema.js";
import { Router } from "express";
import { Payout } from "../../Db/schema.js";
import { Connection, PublicKey, Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import logger from "../../utils/logger.js";
import dotenv from "dotenv";
dotenv.config();
// Solana configuration
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const CASINO_PROGRAM_ID = process.env.CASINO_PROGRAM_ID || "7eoY2tr9vaZEEjX1q64q3ovND5Erg9ZjK8CfujxDfh8p";
const SOLANA_AUTHORITY_PRIVATE_KEY = process.env.SOLANA_AUTHORITY_PRIVATE_KEY || "";
const connection = new Connection(SOLANA_RPC_URL);
const programId = new PublicKey(CASINO_PROGRAM_ID);
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
const PayoutsRouter = Router();
const payouts = async (req, res) => {
    const { walletAddress, amount } = req.body;
    try {
        const user = await User.findOne({ walletAddress });
        if (!user) {
            return res.status(400).json({ success: false, message: "User not found" });
        }
        // Execute payout using Solana transfer
        const amountInLamports = Math.floor(amount * 1e9); // Convert SOL to lamports
        const transaction = new Transaction();
        transaction.add(SystemProgram.transfer({
            fromPubkey: authorityKeypair.publicKey,
            toPubkey: new PublicKey(walletAddress),
            lamports: amountInLamports,
        }));
        const payoutTx = await connection.sendTransaction(transaction, [authorityKeypair]);
        const confirmation = await connection.confirmTransaction(payoutTx, 'confirmed');
        if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }
        logger.info("[Payout] tx=", payoutTx, "to=", walletAddress, "amount=", amount);
        if (payoutTx) {
            await Payout.create({ user: user._id, amount, txHash: payoutTx });
            await User.updateOne({ walletAddress }, {
                $inc: {
                    totalEarned: amount,
                    payouts: amount,
                    roundsPlayed: 1
                }
            });
            res.status(200).json({ success: true, message: "Payouts successful", txHash: payoutTx, user });
        }
        else {
            return res.status(400).json({ success: false, message: "Payout failed" });
        }
    }
    catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
// Separate function for referral reward payout
const referralPayout = async (req, res) => {
    const { walletAddress, amount } = req.body;
    try {
        const user = await User.findOne({ walletAddress });
        if (!user) {
            return res.status(400).json({ success: false, message: "User not found" });
        }
        if (!user.isReferred || !user.referrer) {
            return res.status(400).json({ success: false, message: "User has no referrer" });
        }
        const referralReward = amount * 0.05; // 5% of the specified amount
        logger.info("[Referral] reward=", referralReward, "to=", user.referrer);
        // Payout to referrer using Solana transfer
        const referralAmountInLamports = Math.floor(referralReward * 1e9);
        const referralTransaction = new Transaction();
        referralTransaction.add(SystemProgram.transfer({
            fromPubkey: authorityKeypair.publicKey,
            toPubkey: new PublicKey(user.referrer),
            lamports: referralAmountInLamports,
        }));
        const referrerPayoutTx = await connection.sendTransaction(referralTransaction, [authorityKeypair]);
        const referralConfirmation = await connection.confirmTransaction(referrerPayoutTx, 'confirmed');
        if (referralConfirmation.value.err) {
            throw new Error(`Referral transaction failed: ${referralConfirmation.value.err}`);
        }
        logger.info("[Referral] tx=", referrerPayoutTx);
        if (referrerPayoutTx) {
            const referrerUser = await User.findOne({ walletAddress: user.referrer });
            if (referrerUser) {
                await Payout.create({ user: referrerUser._id, amount: referralReward, txHash: referrerPayoutTx });
                await User.updateOne({ walletAddress: user.referrer }, {
                    $inc: {
                        DepositBalance: referralReward,
                        totalEarned: referralReward
                    }
                });
                logger.debug("[Referral] referrer balance updated");
                await User.updateOne({ walletAddress: walletAddress }, {
                    $inc: {
                        DepositBalance: -referralReward
                    }
                });
                logger.debug("[Referral] user balance deducted");
            }
            res.status(200).json({ success: true, message: "Referral payout successful", referralReward, txHash: referrerPayoutTx });
        }
        else {
            return res.status(400).json({ success: false, message: "Referral payout failed" });
        }
    }
    catch (error) {
        logger.error("Referral payout error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
PayoutsRouter.post("/", payouts);
PayoutsRouter.post("/referral", referralPayout);
export default PayoutsRouter;
//# sourceMappingURL=route.js.map