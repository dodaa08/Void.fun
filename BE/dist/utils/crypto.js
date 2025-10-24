import crypto from 'crypto';
/**
 * Generate SHA-256 hash of input string
 * Used for: server commit, death tile calculation
 */
export async function sha256Hex(input) {
    const hash = crypto.createHash('sha256');
    hash.update(input);
    return hash.digest('hex');
}
/**
 * Generate HMAC-SHA256 hash
 * Used for: additional seed derivation
 */
export async function hmacSha256Hex(key, data) {
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(data);
    return hmac.digest('hex');
}
/**
 * Generate a random server seed (256-bit)
 * This is the SECRET that determines all game outcomes
 */
export function generateServerSeed() {
    return crypto.randomBytes(32).toString('hex'); // 256 bits = 32 bytes
}
/**
 * Generate server commit (hash of server seed)
 * This is shown to the user BEFORE the game starts
 * Proves the seed existed before the game
 */
export async function generateServerCommit(serverSeed) {
    return sha256Hex(serverSeed);
}
/**
 * Generate a random client seed
 * User can provide their own or we generate one
 */
export function generateClientSeed() {
    return crypto.randomBytes(16).toString('hex'); // 128 bits
}
/**
 * Calculate which tile is the "death tile" for a specific row
 * This is DETERMINISTIC - same inputs always give same output
 *
 * @param serverSeed - The secret server seed
 * @param rowIndex - Which row (0-based)
 * @param tiles - Number of tiles in this row
 * @returns Index of the death tile (0 to tiles-1)
 */
export async function getDeathTileIndex(serverSeed, rowIndex, tiles) {
    if (tiles <= 0)
        return 0;
    // Create unique hash for this specific row
    const rowSeed = `${serverSeed}-row${rowIndex}`;
    const hash = await sha256Hex(rowSeed);
    // Convert part of hash to number and mod by tile count
    // Use slice(8, 16) to diversify - avoids always picking index 0
    const hashNum = parseInt(hash.slice(8, 16), 16);
    return ((hashNum % tiles) + 1) % tiles;
}
/**
 * Generate deterministic board layout (number of tiles per row)
 * Based on server seed, so it's provably fair
 *
 * @param serverSeed - The secret server seed
 * @param numRows - How many rows to generate (12-15 typically)
 * @returns Array of tile counts [3, 4, 5, 2, ...]
 */
export async function generateBoard(serverSeed, numRows) {
    const tileCounts = [];
    for (let i = 0; i < numRows; i++) {
        // Hash for this specific row's tile count
        const rowHash = await sha256Hex(`${serverSeed}:row${i}:tiles`);
        // Use first 2 chars of hash to determine tile count (2-7 tiles)
        const tileCount = 2 + (parseInt(rowHash.slice(0, 2), 16) % 6);
        tileCounts.push(tileCount);
    }
    return tileCounts;
}
/**
 * Generate deterministic number of rows
 * Returns 12-15 rows based on server seed
 */
export async function generateRowCount(serverSeed) {
    const hash = await sha256Hex(`${serverSeed}:rowCount`);
    return 12 + (parseInt(hash.slice(0, 2), 16) % 4); // 12-15
}
/**
 * Pre-calculate all death tiles for a board
 * This is done ONCE when session starts
 * Stored in Redis for fast lookup during game
 *
 * @param serverSeed - The secret server seed
 * @param boardLayout - Array of tile counts per row
 * @returns Object mapping row index to death tile index
 */
export async function calculateAllDeathTiles(serverSeed, boardLayout) {
    const deathTiles = {};
    for (let rowIndex = 0; rowIndex < boardLayout.length; rowIndex++) {
        const tileCount = boardLayout[rowIndex];
        if (tileCount) {
            const deathTileIndex = await getDeathTileIndex(serverSeed, rowIndex, tileCount);
            deathTiles[rowIndex] = deathTileIndex;
        }
    }
    return deathTiles;
}
/**
 * Verify that a server commit matches the server seed
 * Used in verification to prove the seed wasn't changed
 *
 * @param serverSeed - The revealed server seed
 * @param serverCommit - The commit shown before game
 * @returns true if commit matches, false otherwise
 */
export async function verifyServerCommit(serverSeed, serverCommit) {
    const calculatedCommit = await generateServerCommit(serverSeed);
    return calculatedCommit === serverCommit;
}
//# sourceMappingURL=crypto.js.map