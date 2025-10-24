// Lightweight leveled logger with env-controlled verbosity
// Levels: silent < error < warn < info < debug
const LEVELS = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
};
function getCurrentLevel() {
    const envLevel = (process.env.LOG_LEVEL || "").toLowerCase();
    if (envLevel && LEVELS[envLevel] !== undefined)
        return envLevel;
    return process.env.NODE_ENV === "production" ? "warn" : "debug";
}
let currentLevel = getCurrentLevel();
function shouldLog(level) {
    return LEVELS[level] <= LEVELS[currentLevel];
}
const logger = {
    setLevel(level) {
        if (LEVELS[level] !== undefined)
            currentLevel = level;
    },
    debug: (...args) => {
        if (shouldLog("debug"))
            console.debug(...args);
    },
    info: (...args) => {
        if (shouldLog("info"))
            console.info(...args);
    },
    warn: (...args) => {
        if (shouldLog("warn"))
            console.warn(...args);
    },
    error: (...args) => {
        if (shouldLog("error"))
            console.error(...args);
    },
};
export default logger;
//# sourceMappingURL=logger.js.map