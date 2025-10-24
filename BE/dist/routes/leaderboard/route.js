import { Router } from "express";
import { User } from "../../Db/schema.js";
import logger from "../../utils/logger.js";
const LeaderboardRouter = Router();
LeaderboardRouter.get("/leaderboard-data", async (req, res) => {
    try {
        // Get top 100 users with highest earnings, excluding users with 0 earnings
        const users = await User.find({ totalEarned: { $gt: 0 } })
            .sort({ totalEarned: -1 }) // Sort by totalEarned descending
            .limit(100) // Limit to top 100
            .select('walletAddress totalEarned roundsPlayed'); // Only return needed fields
        const leaderboardData = users.map((user, index) => ({
            rank: index + 1,
            walletAddress: user.walletAddress,
            totalEarned: user.totalEarned,
            roundsPlayed: user.roundsPlayed || 0
        }));
        res.status(200).json({
            success: true,
            data: {
                leaderboard: leaderboardData,
                totalPlayers: leaderboardData.length
            }
        });
    }
    catch (error) {
        logger.error("Leaderboard error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});
const getTotalEarnings = async (req, res) => {
    const { walletAddress } = req.body;
    try {
        const user = await User.findOne({ walletAddress });
        if (!user) {
            return res.status(400).json({ success: false, message: "User not found" });
        }
        res.status(200).json({ success: true, data: user.totalEarned });
    }
    catch (error) {
        logger.error("Leaderboard error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
LeaderboardRouter.post("/get-total-earnings", getTotalEarnings);
export default LeaderboardRouter;
//# sourceMappingURL=route.js.map