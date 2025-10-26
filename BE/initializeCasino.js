import { Connection, PublicKey, Keypair, SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import idl_raw from "./src/contracts/casino_simple.json" assert { type: "json" };
import dotenv from "dotenv";
import { Buffer } from 'buffer';

dotenv.config({ path: './BE/.env' });

const idl = idl_raw;

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const CASINO_PROGRAM_ID = process.env.CASINO_PROGRAM_ID || "7eoY2tr9vaZEEjX1q64q3ovND5Erg9ZjK8CfujxDfh8p";
const SOLANA_AUTHORITY_PRIVATE_KEY = process.env.SOLANA_AUTHORITY_PRIVATE_KEY || "";

const connection = new Connection(SOLANA_RPC_URL);
const programId = new PublicKey(CASINO_PROGRAM_ID);

let authorityKeypair;
try {
  const privateKeyString = SOLANA_AUTHORITY_PRIVATE_KEY.trim();
  const privateKeyArray = JSON.parse(privateKeyString);
  authorityKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
} catch (error) {
  console.error("Error parsing SOLANA_AUTHORITY_PRIVATE_KEY:", error);
  throw new Error("Invalid SOLANA_AUTHORITY_PRIVATE_KEY format. Please ensure it's a 64-byte JSON array.");
}

const wallet = new anchor.Wallet(authorityKeypair);
const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions());
const program = new anchor.Program(idl, programId, provider);

const [casinoPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("casino"), authorityKeypair.publicKey.toBuffer()],
  programId
);

async function initializeCasino() {
    try {
        console.log("Attempting to initialize casino PDA...");

        const tx = await program.methods
            .initializeCasino()
            .accounts({
                casino: casinoPda,
                authority: authorityKeypair.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .signers([authorityKeypair])
            .rpc();

        console.log("Casino initialized. Transaction hash:", tx);
        console.log("Casino PDA address:", casinoPda.toBase58());

        const casinoAccount = await program.account.casino.fetch(casinoPda);
        console.log("Casino account details:", casinoAccount);

    } catch (error) {
        if (error.message.includes("already in use")) {
            console.warn("Casino PDA already initialized. Skipping initialization.");
            console.log("Fetching existing casino account details...");
            try {
                const casinoAccount = await program.account.casino.fetch(casinoPda);
                console.log("Existing casino account details:", casinoAccount);
            } catch (fetchError) {
                console.error("Error fetching existing casino account:", fetchError);
            }
        } else {
            console.error("Error initializing casino:", error);
        }
    }
}

initializeCasino();
