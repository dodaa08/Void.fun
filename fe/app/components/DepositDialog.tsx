"use client"

import { useState, useEffect, useCallback, useRef } from 'react';
import { useConnection, useWallet, Wallet as AdapterWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { toast } from 'react-toastify';
import { DepositFunds } from '@/app/services/OnchainApi/api';
import idl_raw from '../contracts/casino_simple.json'; // Ensure this path is correct
import { Buffer } from 'buffer'; // Re-add Buffer import

// Custom Anchor Wallet class to wrap the wallet adapter
class CustomAnchorWallet implements anchor.Wallet {
  constructor(public wallet: AdapterWallet) {}

  get publicKey(): PublicKey {
    return this.wallet.adapter.publicKey!;
  }

  async signAllTransactions<T extends Transaction>(transactions: T[]): Promise<T[]> {
    return this.wallet.adapter.signAllTransactions!(transactions);
  }

  async signTransaction<T extends Transaction>(transaction: T): Promise<T> {
    return this.wallet.adapter.signTransaction!(transaction);
  }
}

interface DepositDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDepositSuccess: (amount: number) => void;
}

const DepositDialog: React.FC<DepositDialogProps> = ({ isOpen, onClose, onDepositSuccess }) => {
  const { connection } = useConnection();
  const { publicKey, wallet, connected, signTransaction } = useWallet();
  const [amount, setAmount] = useState<number>(0.01); // Default to minimum deposit
  const [isLoading, setIsLoading] = useState(false);
  const [isAccountInitializing, setIsAccountInitializing] = useState(false);
  const [idlError, setIdlError] = useState<string | null>(null);
  const programId = new PublicKey(process.env.NEXT_PUBLIC_CASINO_PROGRAM_ID!); // Moved inside the component

  const idl: anchor.Idl = idl_raw as anchor.Idl;

  const checkAndInitializeAccounts = useCallback(async () => {
    if (!publicKey || !connected || !idl) {
      return;
    }

    setIsAccountInitializing(true);
    try {
      const provider = new AnchorProvider(connection, new CustomAnchorWallet(wallet!), AnchorProvider.defaultOptions());
      const program = new Program(idl, provider);

      const [casinoPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("casino"), new PublicKey(process.env.NEXT_PUBLIC_AUTHORITY_ADDRESS!).toBuffer()],
        programId
      );

      const [userAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user"), publicKey.toBuffer(), casinoPda.toBuffer()],
        programId
      );

      // 1. Check and initialize Casino PDA if it doesn't exist
      try {
        await program.account.casino.fetch(casinoPda);
      } catch (e) {
        console.warn("Casino PDA not found.");
        toast.error("Casino account not initialized. Please ensure the casino is deployed and initialized by the authority.");
        setIsAccountInitializing(false);
        onClose(); // Close dialog on critical error
        return;
      }

      // 2. Check and initialize User Account PDA if it doesn't exist
      try {
        await program.account.userAccount.fetch(userAccountPda);
      } catch (e) {
        console.warn("User account PDA not found, attempting to initialize...");
        const initializeUserAccountIx = await program.methods
          .initializeUserAccount()
          .accounts({
            userAccount: userAccountPda,
            user: publicKey,
            casino: casinoPda,
            systemProgram: SystemProgram.programId,
          })
          .instruction();

        const initializeUserAccountTx = new Transaction().add(initializeUserAccountIx);
        initializeUserAccountTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        initializeUserAccountTx.feePayer = publicKey; // User pays for their account initialization

        const signedInitializeUserAccountTx = await signTransaction!(initializeUserAccountTx);

        const txid = await connection.sendRawTransaction(signedInitializeUserAccountTx.serialize());
        await connection.confirmTransaction(txid, 'confirmed');
        toast.success("User account initialized!");
      }
    } catch (error: any) {
      console.error("Error checking/initializing accounts:", error);
      toast.error(`Failed to initialize accounts: ${error.message || error}`);
      onClose(); // Close dialog on critical error
    } finally {
      setIsAccountInitializing(false);
    }
  }, [publicKey, connected, connection, wallet, idl, signTransaction, onClose]);

  useEffect(() => {
    if (isOpen && connected && publicKey && idl) {
      checkAndInitializeAccounts();
    }
  }, [isOpen, connected, publicKey, idl, checkAndInitializeAccounts]);

  const handleDeposit = async () => {
    if (!publicKey || !connected || !idl) {
      toast.error("Please connect your Solana wallet.");
      return;
    }
    if (amount <= 0) {
      toast.error("Deposit amount must be greater than 0.");
      return;
    }

    setIsLoading(true);
    try {
      const provider = new AnchorProvider(connection, new CustomAnchorWallet(wallet!), AnchorProvider.defaultOptions());
      const program = new Program(idl, provider);

      const [casinoPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("casino"), new PublicKey(process.env.NEXT_PUBLIC_AUTHORITY_ADDRESS!).toBuffer()],
        programId
      );

      const [userAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user"), publicKey.toBuffer(), casinoPda.toBuffer()],
        programId
      );

      // Fetch user's current SOL balance
      const userSolBalance = await connection.getBalance(publicKey);
      const amountInLamports = new BN(amount * LAMPORTS_PER_SOL);

      if (userSolBalance < amountInLamports.toNumber()) {
        toast.error(`Insufficient SOL in wallet. You have ${userSolBalance / LAMPORTS_PER_SOL} SOL.`);
        setIsLoading(false);
        return;
      }
      
      const depositInstruction = await program.methods
        .deposit(amountInLamports)
        .accounts({
          casino: casinoPda,
          userAccount: userAccountPda,
          user: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      const transaction = new Transaction().add(depositInstruction);

      console.log("Deposit transaction BEFORE setting blockhash/feePayer:", transaction);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(); // Fetch lastValidBlockHeight
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      console.log("Deposit transaction AFTER setting blockhash/feePayer:", transaction);
      console.log("  Blockhash AFTER setting:", transaction.recentBlockhash);
      console.log("  Last Valid Block Height AFTER setting:", lastValidBlockHeight); // Log lastValidBlockHeight
      console.log("  Fee Payer AFTER setting:", transaction.feePayer?.toBase58());
      console.log("  Instructions AFTER setting:", transaction.instructions.map(ix => ({ programId: ix.programId.toBase58(), data: ix.data.toString('hex') })));

      // Simulate the transaction before sending
      console.log("Simulating deposit transaction...");
      const simulationResult = await connection.simulateTransaction(transaction);
      if (simulationResult.value.err) {
        console.error("Deposit transaction simulation failed:", simulationResult.value.err);
        if (simulationResult.value.logs) {
            console.error("Simulation logs:", simulationResult.value.logs);
        }
        throw new Error(`Deposit simulation failed: ${JSON.stringify(simulationResult.value.err)}`);
      }
      console.log("Deposit transaction simulation successful.");

      const signedTransactionFromWallet = await signTransaction!(transaction);
      console.log("Deposit transaction AFTER signing:", signedTransactionFromWallet);
      console.log("  Signatures AFTER signing:", signedTransactionFromWallet.signatures.map(s => ({ publicKey: s.publicKey.toBase58(), signature: s.signature ? Buffer.from(s.signature).toString('hex') : 'N/A' })));

      const serializedTransaction = signedTransactionFromWallet.serialize(); // Serialize to Uint8Array
      const serializedTransactionBase64 = Buffer.from(serializedTransaction).toString('base64'); // Convert to base64 for API
      console.log("Serialized transaction (Uint8Array) to be sent to backend:", serializedTransaction);
      console.log("Serialized transaction (base64) to be sent to backend:", serializedTransactionBase64);
      
      const response = await DepositFunds(publicKey.toBase58(), amount, serializedTransactionBase64, lastValidBlockHeight); // Pass lastValidBlockHeight

      if (response.status === 200) {
        console.log("Deposit successful! Transaction Hash:", response.data?.transactionHash);
        toast.success(`Deposit successful! Tx: ${response.data?.transactionHash}`);
        onDepositSuccess(amount);
        onClose();
      } else {
        toast.error(response.data?.message || "Deposit failed.");
      }
    } catch (error: any) {
      console.error("Deposit error:", error);
      if (error?.code === 4001 || error?.message?.includes("user denied") || error?.message?.includes("User rejected")) {
        toast.error("Deposit transaction rejected. Please confirm the transaction in your wallet to proceed.");
      } else if (error.message.includes("custom program error: 0x11be")) {
        toast.error("Deposit failed: Insufficient funds in the casino's treasury. Please contact support.");
      }
       else {
        toast.error(`Deposit failed: ${error.message || "Unknown error"}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#0b1206] border border-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-lime-400 mb-6 text-center">Deposit Funds</h2>
        {isAccountInitializing ? (
          <div className="flex flex-col items-center justify-center py-10">
            <svg className="animate-spin h-8 w-8 text-lime-400 mb-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-white">Initializing your casino accounts...</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label htmlFor="amount" className="block text-gray-300 text-sm font-bold mb-2">
                Amount (SOL):
              </label>
              <input
                type="number"
                id="amount"
                className="shadow appearance-none border border-gray-700 rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:shadow-outline bg-gray-900"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value))}
                min="0.001"
                step="0.001"
                disabled={isLoading}
              />
            </div>
            <div className="flex justify-between mt-6">
              <button
                onClick={onClose}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleDeposit}
                className="bg-lime-500 hover:bg-lime-600 text-black font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex items-center justify-center"
                disabled={!connected || isLoading}
              >
                {isLoading ? (
                  <svg className="animate-spin h-5 w-5 text-black mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : null}
                {isLoading ? "Depositing..." : "Deposit"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DepositDialog;
