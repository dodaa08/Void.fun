import express from "express";
import logger from "./utils/logger.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";


const PORT = parseInt(process.env.PORT || "8001", 10);
const MONGO_URL = process.env.MONGO_DB_URL || "";

// routes
import CacheRouter from "./routes/cache/cache.js";
import PayoutsRouter from "./routes/payouts/route.js";
import DepositFundsRouter from "./routes/depositFunds/route.js";
import UserRouter from "./routes/users/route.js";
import WithdrawFundsRouter from "./routes/withdrawFunds/route.js";
import LeaderboardRouter from "./routes/leaderboard/route.js";

const app = express();
app.use(express.json());


app.use(cors({
    origin: "*",
    methods: ["GET","POST","PUT","DELETE","OPTIONS"],
    allowedHeaders: ["Content-Type","Authorization"],
  }));

app.use("/api/cache", CacheRouter);
app.use("/api/payouts", PayoutsRouter);
app.use("/api/depositFunds", DepositFundsRouter);
app.use("/api/users", UserRouter);
app.use("/api/withdrawFunds", WithdrawFundsRouter);
app.use("/api/leaderboard", LeaderboardRouter);

app.get("/", (req, res)=>{
    res.send("Hello World");
});

app.get("/health", (req, res)=>{
    res.send("OK");
});

const connectDB_and_cache = async () => {
     try{
        await mongoose.connect(MONGO_URL, {
            maxPoolSize: 10, // Maintain up to 10 socket connections
            serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        });
        logger.info("Connected to MongoDB");
        
    }
    catch(error){
        logger.error(error);
    }   
}

app.listen(PORT, "0.0.0.0", () => {
    connectDB_and_cache();
    logger.info(`Server is running on port ${PORT}`);
});