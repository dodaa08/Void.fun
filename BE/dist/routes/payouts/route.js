import { User } from "../../Db/schema.js";
import { Router } from "express";
import { Payout } from "../../Db/schema.js";
import { PoolABI } from "../../contracts/abi.js";
import { ethers } from "ethers";
import { JsonRpcProvider, Wallet } from "ethers";
import logger from "../../utils/logger.js";
import dotenv from "dotenv";
dotenv.config();
const rawPk = (process.env.PRIVATE_KEY || "").trim();
if (!rawPk)
    throw new Error("Missing PRIVATE_KEY");
const pk = rawPk.startsWith("0x") ? rawPk : `0x${rawPk}`;
if (!/^0x[0-9a-fA-F]{64}$/.test(pk))
    throw new Error("PRIVATE_KEY must be 0x + 64 hex");
const rpcUrl = (process.env.MONAD_TESTNET_RPC || "").trim();
if (!rpcUrl)
    throw new Error("Missing MONAD_TESTNET_RPC");
const provider = new JsonRpcProvider(rpcUrl);
export const payoutWallet = new Wallet(pk, provider);
const poolAddress = (process.env.Contract_Address || "").trim();
if (!/^0x[0-9a-fA-F]{40}$/.test(poolAddress)) {
    throw new Error("Invalid Contract_Address");
}
// const provider = new JsonRpcProvider(process.env.MONAD_TESTNET_RPC || "");
const signer = new ethers.Wallet(pk, provider);
const poolContract = new ethers.Contract(poolAddress, PoolABI, signer);
const PayoutsRouter = Router();
const payouts = async (req, res) => {
    const { walletAddress, amount } = req.body;
    try {
        const user = await User.findOne({ walletAddress });
        if (!user) {
            return res.status(400).json({ success: false, message: "User not found" });
        }
        const payoutTx = await poolContract.payout(walletAddress, ethers.parseEther(amount.toString()));
        await payoutTx.wait();
        logger.info("[Payout] tx=", payoutTx.hash, "to=", walletAddress, "amount=", amount);
        if (payoutTx) {
            await Payout.create({ user: user._id, amount, txHash: payoutTx.hash });
            await User.updateOne({ walletAddress }, {
                $inc: {
                    DepositBalance: -amount, // ✅
                    balance: amount, // ✅
                    totalEarned: amount, // ✅
                    roundsPlayed: 1 // ✅
                },
                $set: {
                    payouts: 0
                }
            });
            res.status(200).json({ success: true, message: "Payouts successful", user });
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
        // Payout to referrer
        const referrerPayoutTx = await poolContract.payout(user.referrer, ethers.parseEther(referralReward.toString()));
        await referrerPayoutTx.wait();
        logger.info("[Referral] tx=", referrerPayoutTx.hash);
        if (referrerPayoutTx) {
            const referrerUser = await User.findOne({ walletAddress: user.referrer });
            if (referrerUser) {
                await Payout.create({ user: referrerUser._id, amount: referralReward, txHash: referrerPayoutTx.hash });
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
            res.status(200).json({ success: true, message: "Referral payout successful", referralReward, txHash: referrerPayoutTx.hash });
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