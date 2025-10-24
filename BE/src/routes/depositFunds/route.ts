import { Router } from "express";
import { User } from "../../Db/schema.js";
import { ethers } from "ethers";
import logger from "../../utils/logger.js";


const poolAddress = (process.env.CONTRACT_ADDRESS || process.env.Contract_Address || "").trim();
const provider = new ethers.JsonRpcProvider(process.env.MONAD_TESTNET_RPC || "");
 


const DepositFundsRouter = Router();

const depositFunds = async (req: any, res: any) => {
    const {walletAddress, amount, txHash, diedOnDeathTile} = req.body;
    
    logger.info("[Deposit] request", { walletAddress, amount, txHash });
    logger.debug("[Deposit] types", {
        walletAddressType: typeof walletAddress,
        amountType: typeof amount,
        txHashType: typeof txHash,
        walletAddressValue: walletAddress,
        amountValue: amount,
        txHashValue: txHash
    });
    
    // Input validation
    if (!walletAddress || !amount || !txHash) {
        logger.warn("[Deposit] validation failed", {
            hasWalletAddress: !!walletAddress,
            hasAmount: !!amount,
            hasTxHash: !!txHash
        });
        return res.status(400).json({ 
            success: false, 
            message: "Missing required fields: walletAddress, amount, txHash" 
        });
    }
    
    if (amount <= 0) {
        return res.status(400).json({ 
            success: false, 
            message: "Amount must be greater than 0" 
        });
    }
    
    try {
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
        }

       

        // Verify transaction exists and is valid
        logger.debug("[Deposit] fetching tx", txHash);
        const tx = await provider.getTransaction(txHash);
        if (!tx) {
            logger.warn("[Deposit] tx not found");
            return res.status(400).json({ success: false, message: "Transaction not found" });
        }
        
        logger.debug("[Deposit] waiting for confirmation");
        // Wait for transaction to be mined
        const receipt = await provider.waitForTransaction(txHash);
        if (!receipt || receipt.status !== 1) {
            logger.warn("[Deposit] tx failed or unconfirmed");
            return res.status(400).json({ 
                success: false, 
                message: "Transaction failed or not confirmed" 
            });
        }

        logger.debug("[Deposit] verify contract address", { expected: poolAddress, to: tx.to });
        // Verify transaction is to the correct contract
        if (tx.to?.toLowerCase() !== poolAddress.toLowerCase()) {
            logger.warn("[Deposit] contract mismatch");
            return res.status(400).json({ 
                success: false, 
                message: `Transaction is not to the pool contract. Expected: ${poolAddress}, Got: ${tx.to}` 
            });
        }
        
        
        // Update user balance atomically
        const updatedUser = await User.findOneAndUpdate(
            { walletAddress },
            { $inc: { DepositBalance: amount } },
            { new: true }
        );
        
        if (!updatedUser) {
            return res.status(500).json({ 
                success: false, 
                message: "Failed to update user balance" 
            });
        }
        
        res.status(200).json({ 
            success: true, 
            message: "Funds deposited successfully", 
            user: updatedUser,
            transactionHash: txHash
        });

    } catch (error: any) {
        logger.error("Deposit funds error:", error);
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
        
        logger.debug("[Deposit] fetch request", { walletAddress });
        
        if (!walletAddress) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing required field: walletAddress" 
            });
        }
        
        // Find or create user if they don't exist
        let user = await User.findOne({walletAddress});
        if (!user) {
            logger.info("[Deposit] creating user on fetch", walletAddress);
            user = await User.create({
                walletAddress: walletAddress,
                DepositBalance: 0,
                balance: 0,
                totalEarned: 0,
                roundsPlayed: 0,
                payouts: 0
            });
        }
        
       
        
        res.status(200).json({ 
            success: true, 
            message: "User balance fetched successfully", 
            user: user 
        });
        
    } catch (error: any) {
        logger.error("FetchDepositFunds error:", error);
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