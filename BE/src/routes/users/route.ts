import { Router } from "express";
import { User } from "../../Db/schema.js";
import logger from "../../utils/logger.js";
const UserRouter = Router();


const createUser = async (req: any, res: any) => {
    const { walletAddress, balance } = req.body;
    try {
      if (!walletAddress || balance === undefined || balance === null) {
        return res.status(400).json({ success: false, message: "Wallet address and balance are required" });
      }
  
      const existing = await User.findOne({ walletAddress });
  
      if (existing) {
        if (existing.balance !== balance) {
          const updatedUser = await User.findOneAndUpdate(
            { walletAddress },
            { $set: { balance } },
            { new: true }
          );
          return res.status(200).json({ success: true, message: "User updated successfully", user: updatedUser });
        }
        return res.status(400).json({ success: false, message: "User already exists" });
      }
  
      const newUser = await User.create({
        walletAddress,
        balance,
        payouts: 0,
        totalEarned: 0,
        roundsPlayed: 0,
        DepositBalance: 0,
      });
  
      return res.status(200).json({ success: true, message: "User created successfully", user: newUser });
    } catch (error) {
      logger.error("Create user error:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  };

const getUser = async (req: any, res: any) => {
    const {walletAddress} = req.params;
    try{
        const user = await User.findOne({walletAddress});
        res.status(200).json({ success: true, user });
    }
    catch(error){
        logger.error("Database error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

const getAllUsersWithtotalEarned = async (req: any, res: any) => {
    try{
        const users = await User.find();
        const usersWithtotalEarned = users.map((user: any) => ({
            walletAddress: user.walletAddress,
            totalEarned: user.totalEarned,
            balance: user.balance,
        }));
        res.status(200).json({ success: true, usersWithtotalEarned });
    }
    catch(error){
        logger.error("Database error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Route to handle wallet connection and store referral details
const connectWallet = async (req: any, res: any) => {
  const { walletAddress, referrer } = req.body;

  logger.debug("[Users] wallet-connect", { walletAddress, referrer: !!referrer });

  // Input validation
  if (!walletAddress) {
    logger.warn("[Users] wallet-connect missing walletAddress");
    return res.status(400).json({ 
      success: false, 
      message: "Missing required field: walletAddress" 
    });
  }

  try {
    // Find or create user
    let user = await User.findOne({ walletAddress });
    if (!user) {
      logger.info("[Users] creating user", walletAddress);
      user = await User.create({
        walletAddress: walletAddress,
        DepositBalance: 0,
        balance: 0,
        totalEarned: 0,
        roundsPlayed: 0,
        payouts: 0,
        referrer: referrer || "",
        isReferred: !!referrer
      });
    } else {
      // If user exists, ensure referrer is not overwritten if already set
      if (!user.referrer && referrer) {
        logger.info("[Users] updating referrer", walletAddress);
        user = await User.findOneAndUpdate(
          { walletAddress },
          { referrer: referrer, isReferred: true },
          { new: true }
        );
      }
    }

    res.status(200).json({ 
      success: true, 
      message: "Wallet connected successfully", 
      user: user
    });
  } catch (error: any) {
    logger.error("Wallet connection error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


const getReferredUser = async (req: any, res: any) => {
  const { walletAddress } = req.body;
  try {
    const referredUser = await User.findOne({ walletAddress: walletAddress });
    logger.debug("[Users] get-referred-user", !!referredUser?.referrer);
    res.status(200).json({ success: true, referredUser: referredUser?.referrer });
  } catch (error) {
    logger.error("getReferredUser error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}


UserRouter.post("/get-user/:walletAddress", getUser);
UserRouter.post("/create-user", createUser);
UserRouter.post("/leaderboard-data", getAllUsersWithtotalEarned);
UserRouter.post("/wallet-connect", connectWallet);
UserRouter.post("/get-referred-user", getReferredUser);
export default UserRouter;
