import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import dotenv from "dotenv";
import { Buffer } from 'buffer';

dotenv.config({ path: './BE/.env' }); // Explicitly specify path to .env

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const CASINO_PROGRAM_ID = process.env.CASINO_PROGRAM_ID || "7eoY2tr9vaZEEjX1q64q3ovND5Erg9ZjK8CfujxDfh8p";
const SOLANA_AUTHORITY_PRIVATE_KEY = process.env.SOLANA_AUTHORITY_PRIVATE_KEY || "";

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
const programId = new PublicKey(CASINO_PROGRAM_ID);

let authorityKeypair;
try {
  const privateKeyString = SOLANA_AUTHORITY_PRIVATE_KEY.trim(); // Trim whitespace
  const privateKeyArray = JSON.parse(privateKeyString);
  authorityKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
} catch (error) {
  console.error("Error parsing SOLANA_AUTHORITY_PRIVATE_KEY:", error);
  console.error("Attempted private key string (trimmed):\n", SOLANA_AUTHORITY_PRIVATE_KEY.trim()); // Log the problematic string
  throw new Error("Invalid SOLANA_AUTHORITY_PRIVATE_KEY format. Please ensure it's a 64-byte JSON array.");
}

// Derive casino PDA
const [casinoPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("casino"), authorityKeypair.publicKey.toBuffer()],
    programId
);

async function fundCasino(amountSol) {
    const amountLamports = amountSol * LAMPORTS_PER_SOL;

    console.log(`Attempting to fund casino PDA: ${casinoPda.toBase58()} with ${amountSol} SOL`);

    try {
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: authorityKeypair.publicKey,
                toPubkey: casinoPda,
                lamports: amountLamports,
            })
        );

        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [authorityKeypair]
        );

        console.log(`Successfully funded casino. Transaction ID: ${signature}`);
        console.log(`Explorer link: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    } catch (error) {
        console.error("Error funding casino:", error);
    }
}

async function checkCasinoBalance() {
    console.log(`Checking balance for casino PDA: ${casinoPda.toBase58()}`);
    try {
        const balanceLamports = await connection.getBalance(casinoPda);
        const balanceSol = balanceLamports / LAMPORTS_PER_SOL;
        console.log(`Casino PDA balance: ${balanceSol} SOL (${balanceLamports} lamports)`);
        return balanceSol;
    } catch (error) {
        console.error("Error checking casino balance:", error);
        return 0;
    }
}

async function main() {
    console.log("Casino Program ID:", CASINO_PROGRAM_ID);
    console.log("Casino PDA Address:", casinoPda.toBase58());
    console.log("Authority Public Key:", authorityKeypair.publicKey.toBase58());

    // You can call fundCasino here with an amount, e.g., fundCasino(1);
    // await fundCasino(2); // Example: Fund with 2 SOL

    await checkCasinoBalance();
}

main().catch(err => {
    console.error("Script failed:", err);
});
