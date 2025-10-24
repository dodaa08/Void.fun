/**
 * Generate SHA-256 hash of input string
 * Used for: server commit, death tile calculation
 */
export declare function sha256Hex(input: string): Promise<string>;
/**
 * Generate HMAC-SHA256 hash
 * Used for: additional seed derivation
 */
export declare function hmacSha256Hex(key: string, data: string): Promise<string>;
/**
 * Generate a random server seed (256-bit)
 * This is the SECRET that determines all game outcomes
 */
export declare function generateServerSeed(): string;
/**
 * Generate server commit (hash of server seed)
 * This is shown to the user BEFORE the game starts
 * Proves the seed existed before the game
 */
export declare function generateServerCommit(serverSeed: string): Promise<string>;
/**
 * Generate a random client seed
 * User can provide their own or we generate one
 */
export declare function generateClientSeed(): string;
/**
 * Calculate which tile is the "death tile" for a specific row
 * This is DETERMINISTIC - same inputs always give same output
 *
 * @param serverSeed - The secret server seed
 * @param rowIndex - Which row (0-based)
 * @param tiles - Number of tiles in this row
 * @returns Index of the death tile (0 to tiles-1)
 */
export declare function getDeathTileIndex(serverSeed: string, rowIndex: number, tiles: number): Promise<number>;
/**
 * Generate deterministic board layout (number of tiles per row)
 * Based on server seed, so it's provably fair
 *
 * @param serverSeed - The secret server seed
 * @param numRows - How many rows to generate (12-15 typically)
 * @returns Array of tile counts [3, 4, 5, 2, ...]
 */
export declare function generateBoard(serverSeed: string, numRows: number): Promise<number[]>;
/**
 * Generate deterministic number of rows
 * Returns 12-15 rows based on server seed
 */
export declare function generateRowCount(serverSeed: string): Promise<number>;
/**
 * Pre-calculate all death tiles for a board
 * This is done ONCE when session starts
 * Stored in Redis for fast lookup during game
 *
 * @param serverSeed - The secret server seed
 * @param boardLayout - Array of tile counts per row
 * @returns Object mapping row index to death tile index
 */
export declare function calculateAllDeathTiles(serverSeed: string, boardLayout: number[]): Promise<Record<number, number>>;
/**
 * Verify that a server commit matches the server seed
 * Used in verification to prove the seed wasn't changed
 *
 * @param serverSeed - The revealed server seed
 * @param serverCommit - The commit shown before game
 * @returns true if commit matches, false otherwise
 */
export declare function verifyServerCommit(serverSeed: string, serverCommit: string): Promise<boolean>;
//# sourceMappingURL=crypto.d.ts.map