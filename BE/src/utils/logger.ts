// Lightweight leveled logger with env-controlled verbosity
// Levels: silent < error < warn < info < debug

type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

const LEVELS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

function getCurrentLevel(): LogLevel {
  const envLevel = (process.env.LOG_LEVEL || "").toLowerCase() as LogLevel;
  if (envLevel && LEVELS[envLevel] !== undefined) return envLevel;
  return process.env.NODE_ENV === "production" ? "warn" : "debug";
}

let currentLevel: LogLevel = getCurrentLevel();

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] <= LEVELS[currentLevel];
}

const logger = {
  setLevel(level: LogLevel) {
    if (LEVELS[level] !== undefined) currentLevel = level;
  },
  debug: (...args: unknown[]) => {
    if (shouldLog("debug")) console.debug(...args);
  },
  info: (...args: unknown[]) => {
    if (shouldLog("info")) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    if (shouldLog("warn")) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (shouldLog("error")) console.error(...args);
  },
};

export default logger;






