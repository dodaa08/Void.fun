type LogLevel = "silent" | "error" | "warn" | "info" | "debug";
declare const logger: {
    setLevel(level: LogLevel): void;
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
};
export default logger;
//# sourceMappingURL=logger.d.ts.map