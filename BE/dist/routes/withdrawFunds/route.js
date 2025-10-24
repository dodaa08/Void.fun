import { Router } from "express";
import { User } from "../../Db/schema.js";
import { ethers } from "ethers";
import logger from "../../utils/logger.js";
import { PoolABI } from "../../contracts/abi.js";
import { Payout } from "../../Db/schema.js";
const poolAddress = process.env.Contract_Address || "";
const provider = new ethers.JsonRpcProvider(process.env.MONAD_TESTNET_RPC || "");
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const poolContract = new ethers.Contract(poolAddress, PoolABI, signer);
const WithdrawFundsRouter = Router();
const withdrawFunds = async (req, res) => {
    const { walletAddress, amount } = req.body;
    logger.info("[Withdraw] request", { walletAddress, amount });
    // Input validation
    if (!walletAddress || !amount || amount <= 0) {
        logger.warn("[Withdraw] invalid input", { walletAddress, amount });
        return res.status(400).json({
            success: false,
            message: "Invalid input: walletAddress and positive amount required"
        });
    }
    // Validate wallet address format
    if (!ethers.isAddress(walletAddress)) {
        return res.status(400).json({
            success: false,
            message: "Invalid wallet address format"
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
        const user = await User.findOne({ walletAddress });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        // Calculate total available balance (deposits + winnings)
        const totalAvailableBalance = (user.DepositBalance || 0) + (user.totalEarned || 0);
        // Check contract balance before attempting withdrawal
        const contractBalance = await poolContract.getBalance();
        const amountInWei = ethers.parseEther(amount.toString());
        logger.debug("[Withdraw] balance/req", { balance: ethers.formatEther(contractBalance), amount });
        if (contractBalance < amountInWei) {
            // Option: Allow partial withdrawal up to available balance
            const maxWithdrawable = parseFloat(ethers.formatEther(contractBalance));
            return res.status(400).json({
                success: false,
                message: `Contract has insufficient funds. Available: ${ethers.formatEther(contractBalance)} ETH, Requested: ${amount} ETH`,
                maxWithdrawable: maxWithdrawable
            });
        }
        // Execute withdrawal transaction - send funds to user's wallet  
        logger.debug("[Withdraw] calling payout", amountInWei.toString());
        // Note: userWithdraw sends to msg.sender, so we need the user to call it
        // For now, let's use payout (owner function) but we should track balances properly
        const withdrawTx = await poolContract.payout(walletAddress, amountInWei);
        logger.info("[Withdraw] tx sent", withdrawTx.hash);
        const receipt = await withdrawTx.wait();
        logger.info("[Withdraw] tx mined", receipt.hash || receipt.transactionHash || withdrawTx.hash);
        // Use the transaction hash from withdrawTx if receipt doesn't have it
        const txHash = receipt.hash || receipt.transactionHash || withdrawTx.hash;
        if (receipt.status === 1) { // Transaction successful
            // Calculate actual winnings (total withdrawal - original deposit)
            const originalDeposit = user.DepositBalance || 0;
            const actualWinnings = amount - originalDeposit;
            logger.debug("[Withdraw] computed", { originalDeposit, amount, actualWinnings });
            // Reset deposit balance and add only actual winnings to totalEarned
            const updatedUser = await User.findOneAndUpdate({ walletAddress }, {
                $set: {
                    DepositBalance: 0 // Reset deposit balance to 0 (cashed out)
                },
                $inc: {
                    roundsPlayed: 1,
                    totalEarned: Math.max(0, actualWinnings) // Only add winnings, not deposit
                }
            }, { new: true });
            // Track all the withdrawls: from contract to user address in payouts db
            if (updatedUser == null)
                return res.status(400).json({ success: false, message: "User not found" });
            await Payout.create({ user: updatedUser._id, amount, txHash: txHash });
            res.status(200).json({
                success: true,
                message: "Funds withdrawn successfully",
                data: {
                    withdrawnAmount: amount,
                    remainingBalance: updatedUser?.DepositBalance || 0,
                    transactionHash: txHash,
                    blockNumber: receipt.blockNumber
                }
            });
        }
        else {
            return res.status(400).json({
                success: false,
                message: "Withdrawal transaction failed"
            });
        }
    }
    catch (error) {
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
};
// Get contract info endpoint
const getContractInfo = async (req, res) => {
    try {
        const contractBalance = await poolContract.getBalance();
        const contractBalanceETH = ethers.formatEther(contractBalance);
        res.status(200).json({
            success: true,
            data: {
                contractAddress: poolAddress,
                contractBalance: contractBalanceETH,
                contractBalanceWei: contractBalance.toString()
            }
        });
    }
    catch (error) {
        logger.error("Contract info error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get contract info",
            error: error.message
        });
    }
};
WithdrawFundsRouter.post("/wd", withdrawFunds);
WithdrawFundsRouter.get("/contract-info", getContractInfo);
export default WithdrawFundsRouter;
//# sourceMappingURL=route.js.map