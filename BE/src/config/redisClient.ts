import { createClient } from "redis";
import logger from "./../utils/logger.js";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const client = createClient({
  url: redisUrl,
});

let isConnected = false;

client.on("error", (err) => {
  logger.warn("❌ Redis Client Error", err.message);
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

export default client;
export { isConnected };
