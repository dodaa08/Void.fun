"use client"

import { useGame } from "../store/useGame";
  import { useState, useEffect, useRef } from "react";
  import { cachePayouts, getCachedPayouts, clearCache } from "../services/api";
  import { useQuery, useQueryClient } from "@tanstack/react-query";
  import { toast } from "react-toastify";
  import DepositDialog from "./DepositDialog";
  import { FetchDepositFunds } from "../services/OnchainApi/api";
  import { WithdrawFunds } from "../services/OnchainApi/api";
  import { getReferredUser, getSession } from "@/app/services/api";
  import { ReferralRewardPayout } from "../services/OnchainApi/api";
import { useConnection, useWallet, Wallet as AdapterWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL, Transaction, Keypair, VersionedTransaction } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import * as anchor from '@coral-xyz/anchor';
import idl_raw from '../contracts/casino_simple.json'; // Corrected path to IDL

// Custom Anchor Wallet class to wrap the wallet adapter
class CustomAnchorWallet implements anchor.Wallet {
  constructor(
    public publicKey: PublicKey,
    public signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>,
    public signAllTransactions: <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>,
    public payer: Keypair = new Keypair()
  ) {}
}

const BottomBar = ()=>{
  const { publicKey, wallet, connected, sendTransaction, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();
  const programId = new PublicKey(process.env.NEXT_PUBLIC_CASINO_PROGRAM_ID!); // Moved inside the component
  const walletAddress = publicKey?.toBase58(); // Derive walletAddress from publicKey
  const queryClient = useQueryClient();
  const { isPlaying, roundEnded, diedOnDeathTile, start, startFunded, payoutAmount, cumulativePayoutAmount, rehydrate, setCumulativePayoutAmount, Replay, setReplay, totalLoss, sessionId, serverCommit } = useGame();
  const [finalPayoutAmount, setFinalPayoutAmount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const deathToastShownRef = useRef(false);
  const [finalPayoutAmountSOL, setFinalPayoutAmountSOL] = useState("0.0000"); // Final payout amount in SOL
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);
  const [depositFunds, setDepositFunds] = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [justStartedFresh, setJustStartedFresh] = useState(false);
  const [isMonitoringDeposit, setIsMonitoringDeposit] = useState(false);
  const [expectedBalance, setExpectedBalance] = useState<number | null>(null);
  const [referredUser, setReferredUser] = useState("");
  const [isReferredUser, setIsReferredUser] = useState(false);
  const [referredUserReward, setReferredUserReward] = useState(0);
  const [isWithdrawing, setIsWithdrawing] = useState(false); // Declare isWithdrawing state
  const [hasHitFirstSafeTile, setHasHitFirstSafeTile] = useState(false); // Track if user hit first safe tile
  const [hasWithdrawn, setHasWithdrawn] = useState(false); // Track if user has withdrawn
  const [isVerifying, setIsVerifying] = useState(false); // Track if verify button is processing


  useEffect(() => {
    if(walletAddress){
      getReferredUser(walletAddress).then((res) => {
        setReferredUser(res.referredUser);
        if(res.referredUser){
          setIsReferredUser(true);
        }
        else{
          setIsReferredUser(false);
        }
      });
    }
  }, [walletAddress, publicKey]); // Added publicKey to dependencies

  // Rehydrate commit after refresh when session exists
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!serverCommit && sessionId) {
        try {
          const res = await getSession(sessionId);
          const data = res?.data ?? res;
          if (!cancelled && data?.serverCommit) {
            useGame.setState({ serverCommit: data.serverCommit });
          }
        } catch (e) {
          // ignore
        }
      }
    })();
    return () => { cancelled = true };
  }, [serverCommit, sessionId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for first safe tile hit
  useEffect(() => {
    const handleFirstSafeTileHit = () => {
      setHasHitFirstSafeTile(true);
    };

    window.addEventListener('firstSafeTileHit', handleFirstSafeTileHit);
    return () => window.removeEventListener('firstSafeTileHit', handleFirstSafeTileHit);
  }, []);

  // Reset hasWithdrawn when round ends due to death (not withdrawal)
  useEffect(() => {
    if (roundEnded && !isPlaying && diedOnDeathTile) {
      setHasWithdrawn(false);
    }
  }, [roundEnded, isPlaying, diedOnDeathTile]);

    useEffect(() => {
      if(finalPayoutAmount > 0){
        const FinalSOL = finalPayoutAmount / LAMPORTS_PER_SOL;
        setFinalPayoutAmountSOL(FinalSOL.toFixed(4));
      } else {
        setFinalPayoutAmountSOL("0.0000");
      }
    }, [finalPayoutAmount]);

  // live cache while playing
  useEffect(() => {
    if (isPlaying && !roundEnded && walletAddress) {
      cachePayouts({ key: walletAddress, value: cumulativePayoutAmount, roundEnded: false, walletAddress });
      if(cumulativePayoutAmount > 0){
        const solEarned = (cumulativePayoutAmount / 150).toFixed(4); // Convert Death Points to SOL
        toast.success(`SOL Earned ${solEarned} ++`);
      }
    }
    }, [isPlaying, roundEnded, cumulativePayoutAmount, walletAddress, publicKey]);
    
    // lock final on end and commit
    useEffect(() => {
    if (roundEnded) {
      // Always set finalPayoutAmount to the current cumulativePayoutAmount when round ends
      setFinalPayoutAmount(cumulativePayoutAmount);
      // toast.success(`Round ended. You earned ${cumulativePayoutAmount.toFixed(2)}`);
    }
    }, [roundEnded, cumulativePayoutAmount]);
    
    // cache final payout while playing
    useEffect(() => {
    if (roundEnded && walletAddress) {
      if (diedOnDeathTile && !deathToastShownRef.current) {
        const totalLossSOL = (totalLoss / LAMPORTS_PER_SOL).toFixed(4);
        toast.error(`Death tile hit! You lost everything: ${totalLossSOL} SOL (stake + earnings). Round ended.`);
        deathToastShownRef.current = true;
      }
      cachePayouts({ key: walletAddress, value: cumulativePayoutAmount, roundEnded: true, walletAddress });
    }
    }, [roundEnded, cumulativePayoutAmount, walletAddress, diedOnDeathTile, totalLoss, publicKey]);
    
    // read cached payout on mount/reload (enabled when wallet exists, regardless of playing state)
    const { data: cachedData, isLoading: isCachedLoading } = useQuery({
    queryKey: ["cachedPayouts", walletAddress, roundEnded ? "final" : "live"],
    queryFn: () => getCachedPayouts(walletAddress as string),
    enabled: mounted && !!walletAddress,
    });
    
    const cachedRaw = cachedData?.payout as unknown;
    const cachedNum = cachedRaw != null ? Number(cachedRaw) : null;


    // Rehydrate earnings from cache when mounted (but not after fresh start or if Replay is set)
    useEffect(() => {
      if (mounted && cachedNum != null && Number.isFinite(cachedNum) && !justStartedFresh && !Replay) {
        if (isPlaying && !roundEnded && cumulativePayoutAmount === 0) {
          // Rehydrate during active play
          setCumulativePayoutAmount(cachedNum);
        } else if (roundEnded && finalPayoutAmount === 0 && !diedOnDeathTile) {
          // Only rehydrate final payout if we didn't die on death tile
          setFinalPayoutAmount(cachedNum);
          setCumulativePayoutAmount(cachedNum);
        }
      }
    }, [mounted, isPlaying, roundEnded, cachedNum, cumulativePayoutAmount, finalPayoutAmount, setCumulativePayoutAmount, justStartedFresh, Replay, diedOnDeathTile]);


    const handleStart = ()=>{
      start();
      deathToastShownRef.current = false; // Reset death toast flag for new game
      setReplay(false);
      setHasHitFirstSafeTile(false); // Reset first safe tile flag
      setHasWithdrawn(false); // Reset withdrawal flag
      setIsVerifying(false); // Reset verify state
      toast.success(`Round started.`);
    }


    const handleReplay = ()=>{
      start(); // ✅ Start the game
      deathToastShownRef.current = false;
      setReplay(true);
      toast.success(`Round replayed.`);
    }

    const handleVerify = () => {
      if (!sessionId) return;
      
      setIsVerifying(true);
      
      // 3-second delay before redirect
      setTimeout(() => {
        window.location.href = `/verify?sessionId=${sessionId}`;
      }, 2000);
    }


    const handleStartGame = async (isReplay: boolean = false) => {
      try {
        // Set this FIRST to prevent rehydration from running during start
        setJustStartedFresh(true); 
        setFinalPayoutAmount(0);
        deathToastShownRef.current = false;
        
        // Clear cache before starting any game (demo or replay)
        if (walletAddress) {
          await clearCache(walletAddress);
          
          // Invalidate React Query cache for this wallet
          queryClient.invalidateQueries({ 
            queryKey: ["cachedPayouts", walletAddress] 
          });
        }
        
        if (walletAddress) {
          await startFunded(walletAddress);
        } else {
          start(); // demo fallback
        }
        setReplay(isReplay);
        
        // Reset the flag after a brief delay
        setTimeout(() => setJustStartedFresh(false), 1000);
        
        const message = isReplay ? "Round replayed." : "Round started.";
        toast.success(message);
        
      } catch (error) {
        // Cache clear failed, continue with fresh start
        setJustStartedFresh(true); // Set this FIRST
        setFinalPayoutAmount(0);
        deathToastShownRef.current = false;
        if (walletAddress) {
          await startFunded(walletAddress);
        } else {
          start();
        }
        setReplay(isReplay);
        
        // Reset the flag after a brief delay
        setTimeout(() => setJustStartedFresh(false), 1000);
        
        const message = isReplay ? "Round replayed." : "Round started.";
        toast.success(message);
      }
    };


    const fetchUserBalance = async () => {
      if(walletAddress){
        setIsLoadingBalance(true);
        try {
          const res = await FetchDepositFunds(walletAddress);
          const newBalance = res.data.user.DepositBalance;
          setDepositFunds(newBalance);
          return newBalance;
        } catch (error) {
          // Balance fetch failed, rethrow for handling
          throw error;
        } finally {
          setIsLoadingBalance(false);
        }
      }
    };




    // Fetch deposit funds when wallet address changes
    useEffect(()=>{
      if (walletAddress) {
        fetchUserBalance();
      }
    }, [walletAddress])

    // Reset deposit funds to 0 ONLY when user dies (not when they win)
    useEffect(() => {
      if (diedOnDeathTile && roundEnded) {
        setDepositFunds(0);
      }
    }, [diedOnDeathTile, roundEnded])

    // Monitor backend balance after deposit
    useEffect(() => {
      let intervalId: NodeJS.Timeout;
      let timeoutId: NodeJS.Timeout;
      
      if (isMonitoringDeposit && expectedBalance !== null && walletAddress) {
        const checkBalance = async () => {
          try {
            const response = await FetchDepositFunds(walletAddress);
            const currentBalance = response.data.user.DepositBalance;
            
            if (currentBalance >= expectedBalance) {
              // Backend has processed the deposit!
              setIsMonitoringDeposit(false);
              setExpectedBalance(null);
              
              // Refresh the balance and show success
              await fetchUserBalance();
              toast.success("Deposit processed! You can now start playing.");
            }
          } catch (error) {
            // Balance check failed, continue silently
          }
        };
        
        // Check immediately, then every 2 seconds
        checkBalance();
        intervalId = setInterval(checkBalance, 2000);
        
        // Stop checking after 10 seconds (timeout)
        timeoutId = setTimeout(() => {
          setIsMonitoringDeposit(false);
          setExpectedBalance(null);
          fetchUserBalance();
          toast.info("Deposit processed - balance updated!");
        }, 10000);
      }
      
      return () => {
        if (intervalId) clearInterval(intervalId);
        if (timeoutId) clearTimeout(timeoutId);
      };
    }, [isMonitoringDeposit, expectedBalance, walletAddress]);

    // Function to start monitoring after deposit
    const startDepositMonitoring = (depositAmount: number) => {
      // Fix: Ensure depositFunds is not negative before adding
      const currentDepositFunds = Math.max(0, depositFunds);
      const newExpectedBalance = currentDepositFunds + depositAmount;
      
      // Optimistic UI update - immediately update frontend
      setDepositFunds(newExpectedBalance);
      
      setExpectedBalance(newExpectedBalance);
      setIsMonitoringDeposit(true);
      
      // toast.info("Processing deposit on blockchain...");
      try {
        // If an error occurs during deposit initiation, it might be caught here
        // However, the actual transaction rejection might be in DepositDialog
        // toast.info("Processing deposit...");
      } catch (error: any) {
        // Deposit initiation failed, handle user rejection
        if (error?.code === 4001 || error?.message?.includes("user denied") || error?.message?.includes("User rejected")) {
          toast.error("Deposit transaction rejected. Please confirm the transaction in your wallet to proceed.");
        } else {
          toast.error("Error processing deposit. Please try again.");
        }
        // Reset optimistic update on error
        setDepositFunds(Math.max(0, depositFunds));
        setExpectedBalance(null);
        setIsMonitoringDeposit(false);
      }
    };



    const LoadingSpinner = () => (
      <div className="flex items-center justify-center">
        <svg className="animate-spin h-6 w-6 text-lime-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="ml-2 text-lime-400">Loading...</span>
      </div>
    );


    const handleDialogOpen = () => {
      if (!connected || !publicKey) {
        toast.error("Please connect your Solana wallet");
        return;
      }
      if (depositFunds > 0 && depositFunds > (walletBalance || 0)) { // Assuming walletBalance will be fetched
        toast.error("You don't have enough SOL in your wallet to cover the deposit.");
        return;
      }
      if (!idl_raw) {
        toast.error("Program IDL not loaded. Please try again.");
        return;
      }
      setIsDepositDialogOpen(true);
    }
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!connected || !publicKey) {
      setWalletBalance(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        const lamports = await connection.getBalance(publicKey);
        setWalletBalance(lamports / LAMPORTS_PER_SOL);
      } catch (error) {
        console.error('Error fetching balance:', error);
        setWalletBalance(null);
      }
    };

    fetchBalance();
    const intervalId = setInterval(fetchBalance, 10000);
    return () => clearInterval(intervalId);
  }, [connected, publicKey, connection]);




    const handleWithdraw = async () => {
    if (!publicKey || !connected) {
      toast.error("Please connect your Solana wallet to withdraw.");
      return;
    }

    const currentEarnings = (cumulativePayoutAmount / 150);
    const totalWithdrawable = (depositFunds || 0) + currentEarnings;
    
    if (totalWithdrawable <= 0) {
      toast.error("No funds available to withdraw.");
      return;
    }

    if (!idl_raw) {
      toast.error("Program IDL not loaded. Please try again.");
      return;
    }

    try {
      setIsWithdrawing(true);
      let referralReward = 0;
      let adjustedWithdrawableSOL = 0;
      if (isReferredUser && referredUser) {
        referralReward = depositFunds * 0.05;
        toast.info(`5% of your deposit (${referralReward.toFixed(4)} SOL) will be shared with your referrer.`);
        setReferredUserReward(referredUserReward + referralReward);
        if (walletAddress) {
          try {
            const referralResponse = await ReferralRewardPayout(walletAddress, referralReward);
            if (referralResponse.status === 200) {
              const txhash = referralResponse.data.txHash;
              const copy = async () => {
                await navigator.clipboard.writeText(txhash);
                toast.success("TX hash copied", { autoClose: 2000 });
              };
              toast.success(
                <div className="text-sm">
                  <div className="font-semibold">Successfully transferred referral reward of {referralReward.toFixed(4)} SOL to referrer</div>
                  <div className="mt-1 font-mono break-all">{txhash}</div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={copy} className="px-2 py-1 rounded bg-gray-700 text-white hover:bg-gray-600">Copy</button>
                    <a href={`https://explorer.solana.com/tx/${txhash}?cluster=devnet`} target="_blank" rel="noreferrer" className="px-2 py-1 rounded bg-lime-400 text-black hover:bg-lime-300">View</a>
                  </div>
                </div>
                ,
                { autoClose: 12000 }
              );
              setReferredUserReward(0);
              setDepositFunds(Math.max(0, depositFunds - referralReward));
            } else {
              toast.error("Failed to transfer referral reward to referrer, proceeding with full withdrawal");
              referralReward = 0;
            }
          } catch (error) {
            toast.error("Failed to transfer referral reward to referrer, proceeding with full withdrawal");
            referralReward = 0;
          }
        }
      }
      // Only withdraw on-chain deposit funds (earnings are handled separately)
      adjustedWithdrawableSOL = Math.max(0, depositFunds - referralReward);
      
      if (adjustedWithdrawableSOL <= 0) {
        toast.error("No deposit funds to withdraw.");
        setIsWithdrawing(false);
        return;
      }
      
      toast.info("Processing withdrawal...");

      const provider = new AnchorProvider(connection, new CustomAnchorWallet(
        publicKey!,
        signTransaction!,
        (signAllTransactions || (async (txs: any[]) => txs)) as <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>
      ), AnchorProvider.defaultOptions());
      const program = new Program(idl_raw as anchor.Idl, provider);
      const [casinoPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("casino"), new PublicKey(process.env.NEXT_PUBLIC_AUTHORITY_ADDRESS!).toBuffer()],
        programId
      );
      const [userAccountPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("user"), publicKey.toBuffer(), casinoPda.toBuffer()],
          programId
      );
      const withdrawAmountInLamports = new BN(adjustedWithdrawableSOL * LAMPORTS_PER_SOL);
      const withdrawInstruction = await program.methods
        .withdraw(withdrawAmountInLamports)
        .accounts({
          casino: casinoPda,
          userAccount: userAccountPda,
          user: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      const transaction = new Transaction().add(withdrawInstruction);
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      transaction.feePayer = publicKey;
      console.log("Simulating withdrawal transaction...");
      const simulationResult = await connection.simulateTransaction(transaction);
      if (simulationResult.value.err) {
        console.error("Withdrawal transaction simulation failed:", simulationResult.value.err);
        if (simulationResult.value.logs) {
          console.error("Simulation logs:", simulationResult.value.logs);
        }
        throw new Error(`Withdrawal simulation failed: ${JSON.stringify(simulationResult.value.err)}`);
      }
      console.log("Withdrawal transaction simulation successful.");
      const signedTransactionFromWallet = await signTransaction!(transaction);
      const serializedTransaction = signedTransactionFromWallet.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
      const response = await WithdrawFunds(publicKey.toBase58(), adjustedWithdrawableSOL, serializedTransaction);
      if (response.status === 200) {
        const txHash = response.data.data?.transactionHash || 'unknown';
        // Process earnings payout after successful deposit withdrawal
        const currentEarnings = (cumulativePayoutAmount / 150);
        let earningsTxHash = '';
        
        if (currentEarnings > 0) {
          try {
            const earningsResponse = await fetch(`${process.env.NEXT_PUBLIC_BE_URL}/api/payouts/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                walletAddress: publicKey.toBase58(),
                amount: currentEarnings
              })
            });

            const earningsResult = await earningsResponse.json();
            
            if (earningsResult.success) {
              earningsTxHash = earningsResult.txHash || earningsResult.transactionHash || 'unknown';
              console.log("Earnings payout successful:", earningsTxHash);
            } else {
              console.error("Earnings payout failed:", earningsResult.message);
            }
          } catch (error: any) {
            console.error("Earnings payout error:", error);
          }
        }
        
        // Show success toast with both transaction hashes
        const successMessage = currentEarnings > 0 
          ? `Withdraw successful! ${adjustedWithdrawableSOL.toFixed(4)} SOL (deposit) + ${currentEarnings.toFixed(4)} SOL (earnings)`
          : `Withdraw successful! ${adjustedWithdrawableSOL.toFixed(4)} SOL (deposit)`;
          
        toast.success(
          <div className="text-sm">
            <div className="font-semibold">{successMessage}</div>
            <div className="mt-1 font-mono break-all">{txHash}</div>
            {earningsTxHash && earningsTxHash !== 'unknown' && (
              <div className="mt-1">
                <div className="text-xs text-gray-600">Earnings TX:</div>
                <div className="font-mono break-all text-xs">{earningsTxHash}</div>
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => {
                  const copy = async () => {
                    await navigator.clipboard.writeText(txHash);
                    toast.success("TX hash copied", { autoClose: 2000 });
                  };
                  copy();
                }}
                className="px-2 py-1 rounded bg-gray-700 text-white hover:bg-gray-600"
              >
                Copy
              </button>
              {txHash !== 'unknown' && (
                <a
                  href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2 py-1 rounded bg-lime-400 text-black hover:bg-lime-300"
                >
                  View
                </a>
              )}
              {earningsTxHash && earningsTxHash !== 'unknown' && (
                <a
                  href={`https://explorer.solana.com/tx/${earningsTxHash}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2 py-1 rounded bg-lime-400 text-black hover:bg-lime-300"
                >
                  View Earnings
                </a>
              )}
            </div>
          </div>,
          { autoClose: 15000 }
        );
        
        setCumulativePayoutAmount(0);
        setFinalPayoutAmount(0);
        setDepositFunds(0);
        setHasHitFirstSafeTile(false);
        setHasWithdrawn(true);
        deathToastShownRef.current = true;
        useGame.setState({
          isPlaying: false,
          roundEnded: true,
          diedOnDeathTile: false,
          cumulativePayoutAmount: 0,
          payoutAmount: 0,
          totalLoss: 0,
          Replay: false
        });
        if (walletAddress) {
          await clearCache(walletAddress);
          queryClient.invalidateQueries({ queryKey: ["cachedPayouts", walletAddress] });
        }
        await fetchUserBalance();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "Withdrawal failed";
      const maxWithdrawable = error.response?.data?.maxWithdrawable;
      if (error?.code === 4001 || errorMessage?.includes("user denied") || errorMessage?.includes("User rejected")) {
        toast.error("Withdrawal transaction rejected. Please confirm the transaction in your wallet to proceed.");
      } else if (maxWithdrawable && maxWithdrawable > 0) {
        toast.error(`${errorMessage}. You can withdraw up to ${maxWithdrawable.toFixed(4)} SOL currently.`);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsWithdrawing(false);
    }
  };

    
    
	
	return (
      <>
      <div className="fixed inset-x-0 bottom-6 flex justify-center px-4 ">
         <div className="w-full max-w-2xl bg-[#0b1206]/95 border border-gray-900 rounded-2xl px-6 pt-10 pb-6  shadow-gray-900 shadow-inner">
          
        <div className="flex flex-col justify-between items-center gap-4">
    {/* Commit badge (funded games) */}
    {!isPlaying && walletAddress && serverCommit && (
      <div className="w-full flex justify-center -mt-2">
        <div className="flex items-center gap-2 bg-[#121a29] border border-gray-700 rounded-lg px-3 py-1">
          <span className="text-gray-400 text-xs">Commit:</span>
          <span className="text-lime-400 font-mono text-xs">{serverCommit.slice(0, 8)}...</span>
          <button
            onClick={() => { navigator.clipboard.writeText(serverCommit); toast.success("Commit copied!", { autoClose: 2000 }); }}
            className="h-6 px-2 bg-gray-700 text-white rounded text-[10px] leading-6 hover:bg-gray-600 transition-colors"
          >
            Copy
          </button>
          {sessionId && roundEnded && walletAddress && !hasWithdrawn && (
            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className="h-6 px-2 bg-lime-400 text-black rounded text-[10px] leading-6 hover:bg-lime-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {isVerifying ? (
                <>
                  <div className="w-3 h-3 border border-black border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </>
              ) : (
                "Verify"
              )}
            </button>
          )}
        </div>
      </div>
    )}
    {/* Left */}
    <div>
      {!mounted || isLoadingBalance || isMonitoringDeposit ? (
        <LoadingSpinner />
      ) : !isPlaying && walletAddress && connected ? (
        <>
        {Math.max(0, depositFunds) > 0 ? (
          // User has deposited funds - show Start button and balance
          <div className="flex flex-col gap-4 items-center">
            <div className="flex justify-between items-center gap-4 w-full">
              <button 
                onClick={() => handleStartGame(diedOnDeathTile)} 
                 className="min-w-[200px] h-12 cursor-pointer rounded-md bg-lime-400 text-black font-bold tracking-wide hover:bg-lime-300 transition-colors text-lg"
              >
                {diedOnDeathTile ? "Replay" : "Start Game"}
              </button>
              
              <div className="flex flex-col items-center gap-1">
                <span className="text-gray-400 text-sm">Deposited Balance</span>
                <span className="text-lime-400 text-xl font-bold">{Math.max(0, depositFunds).toFixed(4)} SOL</span>
              </div>
            </div>
          </div>
        ) : (
          // User hasn't deposited - show demo and deposit options
          <>
          <div className="flex justify-between items-end gap-4">
            <div className="flex flex-col gap-2">
              <button 
                onClick={diedOnDeathTile ? handleReplay : handleStart} 
                className="min-w-[180px] h-12 cursor-pointer rounded-md bg-lime-400 text-black font-bold tracking-wide hover:bg-lime-300 transition-colors"
              >
                {diedOnDeathTile ? "Play Demo" : "Play Demo"}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={() => handleDialogOpen()}
                className="min-w-[180px] h-12 cursor-pointer rounded-md bg-lime-400 text-black font-bold tracking-wide hover:bg-lime-300 transition-colors"
              >
                Add Funds
              </button>
            </div>
          </div>
          <div className="w-full flex justify-center mt-2">
            <span className="text-lime-400 text-lg text-center">Connect Wallet & Add Funds to Play</span>
          </div>
          </>
        )}
        </>
      
      ) :
      
      !isPlaying && !walletAddress ? (
        <span>Connect Wallet To Play</span>
      ) : isPlaying ? (
        <span></span>
      ) : (
								<span>Round Ended</span>
      )}
				</div>

    {/* Right */}
    <div className="w-full flex justify-center">
    {!mounted ? (
      <span className="text-lime-400 text-sm">Earnings: ...</span>
    ) : isPlaying || roundEnded ? (
      <div className="flex flex-col gap-2">
      <span className="text-lime-400 text-xl">Earnings: { (cumulativePayoutAmount / 150).toFixed(4) } SOL</span>

      {hasHitFirstSafeTile && depositFunds > 0 && walletAddress && (
        <div className="flex justify-center">
          <button 
            onClick={handleWithdraw}
            disabled={isWithdrawing}
            className="bg-lime-400 text-black cursor-pointer hover:bg-lime-300 transition-colors font-semibold px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isWithdrawing ? "Withdrawing..." : `Withdraw ${((depositFunds || 0) + (cumulativePayoutAmount / 150)).toFixed(4)} SOL`}
          </button>
        </div>
      )}

      {/* {depositFunds === 0 && isPlaying && (
         <div className="flex justify-center">
          <button 
            onClick={() => {
              useGame.setState({ 
                isPlaying: false, 
                roundEnded: true, 
                diedOnDeathTile: true,
                cumulativePayoutAmount: 0,
                payoutAmount: 0
              });
            }}
            className="bg-red-500 text-white cursor-pointer hover:bg-red-400 transition-colors font-semibold px-4 py-2 rounded-md"
          >
            Exit Demo
          </button>
        </div>
      )} */}
					</div>
    ) : roundEnded ? (
      <div className="flex flex-row justify-between items-center gap-4">
        {sessionId && walletAddress && !hasWithdrawn && (
          <div className="w-full flex justify-center">
            <div className="flex items-center gap-2 bg-[#121a29] border border-gray-700 rounded-lg px-3 py-1">
              <span className="text-gray-400 text-xs">Session:</span>
              <span className="text-lime-400 font-mono text-xs">{sessionId.slice(0, 8)}...</span>
              <button 
                onClick={() => { navigator.clipboard.writeText(sessionId); toast.success("Session ID copied!", { autoClose: 2000 }); }}
                className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>
    ) : null}
  </div>
  
  </div>
			</div>
		</div>

      {/* Deposit Dialog */}
      <DepositDialog 
        isOpen={isDepositDialogOpen} 
        onClose={() => setIsDepositDialogOpen(false)}
        onDepositSuccess={startDepositMonitoring}
      />
    </>
	)
}

export default BottomBar;
