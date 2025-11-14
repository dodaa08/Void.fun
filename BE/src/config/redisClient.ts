import { createClient } from "redis";
import logger from "./../utils/logger.js";
import dotenv from "dotenv";

// Ensure .env is loaded before reading REDIS_URL
dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const isUpstash = redisUrl.includes('upstash.io') || redisUrl.includes('rediss://');

logger.info(`🔗 Connecting to Redis: ${redisUrl.replace(/:[^:@]+@/, ':****@')} (Upstash: ${isUpstash})`);

const client = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        logger.warn("⚠️  Redis stopped retrying after 3 attempts");
        return false; // Stop retrying after 3 attempts
      }
      return retries * 100;
    },
    // For Upstash/rediss://, TLS is automatically handled by the protocol
    // But we can explicitly enable it for upstash.io domains
    ...(isUpstash && !redisUrl.includes('rediss://') && { tls: true }),
  },
});

let isConnected = false;
let errorLogged = false;

client.on("error", (err: any) => {
  if (!errorLogged) {
    const errorMsg = err?.message || err?.toString() || JSON.stringify(err);
    logger.warn("❌ Redis Client Error:", errorMsg);
    errorLogged = true;
  }
  isConnected = false;
});

client.on("connect", () => {
  logger.info("✅ Connected to Redis");
  isConnected = true;
});

// Try to connect but don't crash the app if it fails
if (redisUrl) {
  client.connect().catch((err) => {
    logger.warn("⚠️  Redis connection failed, running without cache:", err.message);
    isConnected = false;
  });
} else {
  logger.warn("⚠️  Redis disabled - REDIS_URL not configured");
}

// Helper to add timeout to Redis operations
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Redis operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

export default client;
export { isConnected, withTimeout };