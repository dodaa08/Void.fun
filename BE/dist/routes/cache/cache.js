import express from "express";
const CacheRouter = express.Router();
import redisClient from "../../config/redisClient.js";
import { deleteCacheBatch } from "../../servicies/CacheService.js";
import { User } from "../../Db/schema.js";
import { generateServerSeed, generateServerCommit, generateClientSeed, generateRowCount, generateBoard, calculateAllDeathTiles } from "../../utils/crypto.js";
// Cache tile interactions
const CacheTilesRowsClicked = async (req, res) => {
    const { sessionId, rowIndex, tileIndex, isDeath, roundEnded, walletAddress } = req.body;
    try {
        if (!sessionId || rowIndex == undefined) {
            return res.status(400).json({ success: false, message: "Session ID and row index are required" });
        }
        if (tileIndex === undefined || tileIndex === null) {
            return res.status(400).json({ success: false, message: "Tile index is required" });
        }
        if (!sessionId || rowIndex == undefined) {
            return res.status(400).json({ success: false, message: "Session ID and row index are required" });
        }
        if (!walletAddress) {
            return res.status(400).json({ success: false, message: "Wallet address is required" });
        }
        if (roundEnded && !isDeath) {
            // Batch delete for better performance
            await deleteCacheBatch([
                `game:${sessionId}`,
                `game:${sessionId}:roundEnded`,
                `game:${walletAddress.toLowerCase()}:sessionId`
            ]);
            return res.status(200).json({
                success: true,
                message: `Round ended, cache cleared for session ${sessionId}`,
            });
        }
        const rowkey = `game:${sessionId}:row:${rowIndex}`;
        if (isDeath) {
            await redisClient.set(`${rowkey}:death`, tileIndex);
            await redisClient.set(`game:${sessionId}:roundEnded`, "true");
            await redisClient.set(`game:${sessionId}:isPlaying`, "false");
            await redisClient.del(`game:${walletAddress.toLowerCase()}:sessionId`);
            const user = await User.findOne({ walletAddress });
            if (user) {
                const currentBalance = user.DepositBalance || 0;
                await User.updateOne({ walletAddress }, {
                    $set: {
                        DepositBalance: 0,
                    },
                    $inc: {
                        roundsPlayed: 1
                    }
                });
                console.log(`[DEATH] User ${walletAddress} died. Balance reset from ${currentBalance} to 0`);
            }
            return res.status(200).json({
                success: true,
                message: `Death tile hit! Round ended`,
                rowIndex,
                death: tileIndex,
                roundEnded: true
            });
        }
        else {
            const roundEnded = await redisClient.get(`game:${sessionId}:roundEnded`);
            if (!roundEnded) {
                await redisClient.set(`${rowkey}:clicked`, tileIndex);
            }
            await redisClient.set(`game:${sessionId}:isPlaying`, "true");
            await redisClient.set(`game:${sessionId}:rowIndex`, String(rowIndex));
            await redisClient.set(`game:${String(walletAddress).toLowerCase()}:sessionId`, String(sessionId));
        }
        const clicked = await redisClient.get(`${rowkey}:clicked`);
        const death = await redisClient.get(`${rowkey}:death`);
        return res.status(200).json({
            success: true,
            message: "Tile cached successfully",
            rowIndex,
            clicked,
            death,
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
// Cache increasing payout; on round end persist and clear
export const CachetheIncreasingPayoutAmount = async (req, res) => {
    const { key, value, roundEnded, walletAddress } = req.body;
    try {
        const numericValue = Number(value);
        if (isNaN(numericValue)) {
            return res.status(400).json({ success: false, message: "Invalid payout value" });
        }
        if (roundEnded) {
            const user = await User.findOne({ walletAddress: key });
            if (!user) {
                return res.status(400).json({ success: false, message: "User not found" });
            }
            const finalPayout = await redisClient.get(key);
            const finalPayoutNum = finalPayout ? Number(finalPayout) : 0;
            const FinalPayoutMon = finalPayoutNum / 150;
            if (finalPayoutNum > 0) {
                await User.updateOne({ walletAddress: key }, {
                    $inc: {
                        totalEarned: FinalPayoutMon,
                        payouts: FinalPayoutMon
                    }
                });
                console.log(`[WIN] User ${key} won ${FinalPayoutMon} MON (${finalPayoutNum} death points)`);
            }
            else {
                await User.updateOne({ walletAddress: key }, {
                    $set: {
                        payouts: 0
                    }
                });
                console.log(`[DEATH] User ${key} died - payout saved as 0`);
            }
            await redisClient.del(key);
            return res.status(200).json({
                success: true,
                message: `Round ended, final payout amount saved for user ${key}`,
                data: finalPayoutNum,
            });
        }
        await redisClient.set(key, numericValue.toString());
        return res.status(200).json({
            success: true,
            message: `Cache set for key ${key}`,
            data: numericValue,
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
CacheRouter.get("/check-cache/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    const roundEnded = await redisClient.get(`game:${sessionId}:roundEnded`);
    const isPlaying = await redisClient.get(`game:${sessionId}:isPlaying`);
    const rowIndex = await redisClient.get(`game:${sessionId}:rowIndex`);
    const session = await redisClient.get(`game:${sessionId}`);
    res.set("Cache-Control", "no-store");
    res.json({
        session,
        roundEnded: roundEnded === "true",
        isPlaying: isPlaying === "true",
        lastClickedRow: rowIndex ? Number(rowIndex) : null,
    });
});
CacheRouter.get("/check-cache/:sessionId/:rowIndex", async (req, res) => {
    const { sessionId, rowIndex } = req.params;
    console.log("[check-cache] sessionId", sessionId, "rowIndex", rowIndex);
    const rowkey = `game:${sessionId}:row:${rowIndex}`;
    const clicked = await redisClient.get(`${rowkey}:clicked`);
    const death = await redisClient.get(`${rowkey}:death`);
    res.json({ clicked, death });
});
CacheRouter.get("/check-payout/:key", async (req, res) => {
    const { key } = req.params;
    const payout = await redisClient.get(key);
    // const roundEnded = await redisClient.get(``);
    res.json({ payout });
});
CacheRouter.get("/get-last-sessionId/:walletAddress", async (req, res) => {
    const { walletAddress } = req.params;
    if (!walletAddress) {
        return res.status(400).json({ success: false, message: "walletAddress is required" });
    }
    try {
        const key = `game:${walletAddress.toLowerCase()}:sessionId`;
        const lastSessionId = await redisClient.get(key);
        return res.status(200).json({
            success: true,
            message: "Last session id",
            walletAddress: walletAddress.toLowerCase(),
            lastSessionId: lastSessionId ?? null,
        });
    }
    catch (error) {
        console.error("[get-last-sessionId] error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});
// Verify if a session ID exists and is valid
CacheRouter.get("/verify-session/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    if (!sessionId) {
        return res.status(400).json({ success: false, message: "Session ID is required" });
    }
    try {
        // Check if this session exists or existed in Redis
        const isPlaying = await redisClient.get(`game:${sessionId}:isPlaying`);
        const roundEnded = await redisClient.get(`game:${sessionId}:roundEnded`);
        const rowIndex = await redisClient.get(`game:${sessionId}:rowIndex`);
        // Session is valid if any of these keys exist (or existed)
        const sessionExists = isPlaying !== null || roundEnded !== null || rowIndex !== null;
        if (sessionExists) {
            return res.status(200).json({
                success: true,
                valid: true,
                message: "Session ID is valid",
                data: {
                    sessionId,
                    isPlaying: isPlaying === "true",
                    roundEnded: roundEnded === "true"
                }
            });
        }
        else {
            return res.status(200).json({
                success: true,
                valid: false,
                message: "Session ID not found. This may be an invalid or expired session.",
                data: null
            });
        }
    }
    catch (error) {
        console.error("[verify-session] error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});
// Clear cache for a specific wallet address
const ClearCache = async (req, res) => {
    try {
        const { walletAddress } = req.body;
        if (!walletAddress) {
            return res.status(400).json({ success: false, message: "Wallet address is required" });
        }
        console.log(`[ClearCache] Clearing cache for wallet: ${walletAddress}`);
        // Clear payout cache
        const payoutKey = `payout:${walletAddress}`;
        await redisClient.del(payoutKey);
        // Clear last session ID
        const sessionKey = `game:${walletAddress.toLowerCase()}:sessionId`;
        await redisClient.del(sessionKey);
        console.log(`[ClearCache] Cleared cache keys: ${payoutKey}, ${sessionKey}`);
        return res.status(200).json({
            success: true,
            message: "Cache cleared successfully"
        });
    }
    catch (error) {
        console.error("[ClearCache] error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
/**
 * GET SESSION - Retrieve session data for frontend
 * This returns session info, board layout, and seeds (server seed only after game ends)
 * GET /api/cache/get-session/:sessionId
 */
const GetSession = async (req, res) => {
    const { sessionId } = req.params;
    if (!sessionId) {
        return res.status(400).json({
            success: false,
            message: "Session ID is required"
        });
    }
    try {
        // Get all session data from Redis
        const [serverSeed, serverCommit, clientSeed, boardLayout, deathTiles, timestamp, isPlaying, roundEnded, walletAddress] = await Promise.all([
            redisClient.get(`game:${sessionId}:serverSeed`),
            redisClient.get(`game:${sessionId}:serverCommit`),
            redisClient.get(`game:${sessionId}:clientSeed`),
            redisClient.get(`game:${sessionId}:boardLayout`),
            redisClient.get(`game:${sessionId}:deathTiles`),
            redisClient.get(`game:${sessionId}:timestamp`),
            redisClient.get(`game:${sessionId}:isPlaying`),
            redisClient.get(`game:${sessionId}:roundEnded`),
            redisClient.get(`game:${sessionId}:walletAddress`)
        ]);
        // Check if session exists
        if (!serverSeed || !serverCommit || !clientSeed) {
            return res.status(404).json({
                success: false,
                message: "Session not found or expired",
                data: null
            });
        }
        // Parse JSON data
        const parsedBoardLayout = boardLayout ? JSON.parse(boardLayout) : null;
        const parsedDeathTiles = deathTiles ? JSON.parse(deathTiles) : null;
        // Only reveal server seed and death tiles AFTER game ends
        const shouldRevealSecrets = roundEnded === "true";
        return res.status(200).json({
            success: true,
            message: "Session retrieved successfully",
            data: {
                sessionId,
                serverCommit,
                clientSeed,
                boardLayout: parsedBoardLayout,
                numRows: parsedBoardLayout ? parsedBoardLayout.length : 0,
                timestamp,
                isPlaying: isPlaying === "true",
                roundEnded: roundEnded === "true",
                walletAddress,
                // Only reveal these after game ends
                serverSeed: shouldRevealSecrets ? serverSeed : null,
                deathTiles: shouldRevealSecrets ? parsedDeathTiles : null
            }
        });
    }
    catch (error) {
        console.error("[GET_SESSION] error", error);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve session",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};
/**
 * START SESSION - Create a new provably fair game session
 * This generates all seeds, board layout, and death tiles BEFORE game starts
 * POST /api/cache/start-session
 */
const StartSession = async (req, res) => {
    const { walletAddress } = req.body;
    try {
        // Validate wallet address
        if (!walletAddress) {
            return res.status(400).json({
                success: false,
                message: "Wallet address is required"
            });
        }
        // Generate session ID (using crypto for better randomness)
        const sessionId = generateClientSeed(); // Reuse this function for UUID
        // Generate server seed (SECRET - determines all game outcomes)
        const serverSeed = generateServerSeed();
        // Generate server commit (hash of server seed - show to user BEFORE game)
        const serverCommit = await generateServerCommit(serverSeed);
        // Always generate client seed on server
        const finalClientSeed = generateClientSeed();
        // Generate deterministic board layout
        const numRows = await generateRowCount(serverSeed);
        const boardLayout = await generateBoard(serverSeed, numRows);
        // Pre-calculate ALL death tiles for this board
        const deathTiles = await calculateAllDeathTiles(serverSeed, boardLayout);
        // Get current timestamp
        const timestamp = new Date().toISOString();
        // Store everything in Redis with 24-hour expiry
        const TTL = 86400; // 24 hours in seconds
        await redisClient.setEx(`game:${sessionId}:serverSeed`, TTL, serverSeed);
        await redisClient.setEx(`game:${sessionId}:serverCommit`, TTL, serverCommit);
        await redisClient.setEx(`game:${sessionId}:clientSeed`, TTL, finalClientSeed);
        await redisClient.setEx(`game:${sessionId}:boardLayout`, TTL, JSON.stringify(boardLayout));
        await redisClient.setEx(`game:${sessionId}:deathTiles`, TTL, JSON.stringify(deathTiles));
        await redisClient.setEx(`game:${sessionId}:timestamp`, TTL, timestamp);
        await redisClient.setEx(`game:${sessionId}:isPlaying`, TTL, "false");
        await redisClient.setEx(`game:${sessionId}:roundEnded`, TTL, "false");
        await redisClient.setEx(`game:${sessionId}:walletAddress`, TTL, walletAddress.toLowerCase());
        // Link wallet to this session
        await redisClient.setEx(`game:${walletAddress.toLowerCase()}:sessionId`, TTL, sessionId);
        console.log(`[START_SESSION] Created session ${sessionId} for ${walletAddress}`);
        console.log(`[START_SESSION] Board: ${numRows} rows, Death tiles:`, deathTiles);
        // Return session data
        // ⚠️ DO NOT reveal serverSeed yet! Only after game ends
        return res.status(200).json({
            success: true,
            message: "Session created successfully",
            data: {
                sessionId,
                serverCommit, // User should save this BEFORE playing!
                clientSeed: finalClientSeed,
                boardLayout, // Show board structure
                numRows,
                timestamp
                // serverSeed: NOT REVEALED YET!
                // deathTiles: NOT REVEALED YET!
            }
        });
    }
    catch (error) {
        console.error("[START_SESSION] error", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create session",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};
/**
 * RESTORE SESSION (alias) - Simple shape for FE restore
 * GET /api/cache/restore-session/:sessionId
 */
const RestoreSession = async (req, res) => {
    const { sessionId } = req.params;
    try {
        const boardLayout = await redisClient.get(`game:${sessionId}:boardLayout`);
        if (!boardLayout) {
            return res.status(404).json({ success: false, message: "Session not found" });
        }
        const parsed = JSON.parse(boardLayout);
        return res.status(200).json({ success: true, session: { rows: parsed } });
    }
    catch (error) {
        console.error("[RESTORE_SESSION] error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
/**
 * DEATH INDEX - Deterministic death tile per row from stored data
 * GET /api/cache/death-index/:sessionId/:rowIndex
 */
const GetDeathIndex = async (req, res) => {
    const { sessionId, rowIndex } = req.params;
    try {
        const deathTilesStr = await redisClient.get(`game:${sessionId}:deathTiles`);
        if (!deathTilesStr) {
            return res.status(404).json({ success: false, message: "Session not found" });
        }
        const deathTiles = JSON.parse(deathTilesStr);
        const idx = Number(rowIndex);
        if (Number.isNaN(idx) || idx < 0 || idx >= deathTiles.length) {
            return res.status(400).json({ success: false, message: "Invalid row index" });
        }
        return res.status(200).json({ success: true, deathIndex: deathTiles[idx] });
    }
    catch (error) {
        console.error("[GET_DEATH_INDEX] error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
/**
 * REVEAL SEED - Reveal serverSeed only after round ends
 * GET /api/cache/reveal/:sessionId
 */
const RevealSeed = async (req, res) => {
    const { sessionId } = req.params;
    try {
        const [roundEnded, serverSeed, serverCommit] = await Promise.all([
            redisClient.get(`game:${sessionId}:roundEnded`),
            redisClient.get(`game:${sessionId}:serverSeed`),
            redisClient.get(`game:${sessionId}:serverCommit`),
        ]);
        if (!serverSeed || !serverCommit) {
            return res.status(404).json({ success: false, message: "Session not found" });
        }
        const ended = roundEnded === "true";
        if (!ended) {
            return res.status(403).json({ success: false, message: "Round not ended yet", serverCommit });
        }
        return res.status(200).json({ success: true, serverSeed, serverCommit });
    }
    catch (error) {
        console.error("[REVEAL_SEED] error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
CacheRouter.post("/cache-tiles", CacheTilesRowsClicked);
CacheRouter.post("/cache-payout", CachetheIncreasingPayoutAmount);
CacheRouter.post("/clear-cache", ClearCache);
CacheRouter.post("/start-session", StartSession);
CacheRouter.get("/get-session/:sessionId", GetSession);
CacheRouter.get("/restore-session/:sessionId", RestoreSession);
CacheRouter.get("/death-index/:sessionId/:rowIndex", GetDeathIndex);
CacheRouter.get("/reveal/:sessionId", RevealSeed);
export default CacheRouter;
//# sourceMappingURL=cache.js.map