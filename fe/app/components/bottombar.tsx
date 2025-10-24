"use client"

import { useAccount } from "wagmi";
import { useGame } from "../store/useGame";
  import { useState, useEffect, useRef } from "react";
  import { cachePayouts, getCachedPayouts, clearCache } from "../services/api";
  import { useQuery, useQueryClient } from "@tanstack/react-query";
  import { toast } from "react-toastify";
  import DepositDialog from "./DepositDialog";
  import { FetchDepositFunds } from "../services/OnchainApi/api";
  import { useBalance } from "wagmi";
  import { WithdrawFunds } from "../services/OnchainApi/api";
  import { useWalletClient } from "wagmi";
  import { getReferredUser, getSession } from "@/app/services/api";
  import { ReferralRewardPayout } from "../services/OnchainApi/api";

const BottomBar = ()=>{
  const { address: walletAddress } = useAccount();
  const queryClient = useQueryClient();
  const { isPlaying, roundEnded, diedOnDeathTile, start, startFunded, payoutAmount, cumulativePayoutAmount, rehydrate, setCumulativePayoutAmount, Replay, setReplay, totalLoss, sessionId, serverCommit } = useGame();
  const [finalPayoutAmount, setFinalPayoutAmount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const deathToastShownRef = useRef(false);
  const [finalPayoutAmountMON, setFinalPayoutAmountMON] = useState("0.0000"); // Final payout amount in MON
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);
  const [depositFunds, setDepositFunds] = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [justStartedFresh, setJustStartedFresh] = useState(false);
  const [isMonitoringDeposit, setIsMonitoringDeposit] = useState(false);
  const [expectedBalance, setExpectedBalance] = useState<number | null>(null);
  const { data: balance } = useBalance({address: walletAddress});
  const { data: walletClient } = useWalletClient();
  const [referredUser, setReferredUser] = useState("");
  const [isReferredUser, setIsReferredUser] = useState(false);
  const [referredUserReward, setReferredUserReward] = useState(0);


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
  }, [walletAddress]);

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

    useEffect(() => {
      if(finalPayoutAmount > 0){
        const FinalMONifDeath = finalPayoutAmount / 150;
        setFinalPayoutAmountMON(FinalMONifDeath.toFixed(4));
      } else {
        setFinalPayoutAmountMON("0.0000");
      }
    }, [finalPayoutAmount]);

  // live cache while playing
  useEffect(() => {
    if (isPlaying && !roundEnded && walletAddress) {
      cachePayouts({ key: walletAddress, value: cumulativePayoutAmount, roundEnded: false, walletAddress });
      if(cumulativePayoutAmount > 0){
        const ethEarned = (cumulativePayoutAmount / 150).toFixed(4); // Convert Death Points to ETH
        toast.success(`MON Earned ${ethEarned} ++`);
      }
    }
    }, [isPlaying, roundEnded, cumulativePayoutAmount, walletAddress]);
    
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
        const totalLossETH = totalLoss.toFixed(4);
        toast.error(`Death tile hit! You lost everything: ${totalLossETH} MON (stake + earnings). Round ended.`);  
        deathToastShownRef.current = true;
      }
      cachePayouts({ key: walletAddress, value: cumulativePayoutAmount, roundEnded: true, walletAddress });
    }
    }, [roundEnded, cumulativePayoutAmount, walletAddress, diedOnDeathTile, totalLoss]);
    
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
      toast.success(`Round started.`);
    }


    const handleReplay = ()=>{
      start(); // ✅ Start the game
      deathToastShownRef.current = false;
      setReplay(true);
      toast.success(`Round replayed.`);
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
        
        // Stop checking after 30 seconds (timeout)
        timeoutId = setTimeout(() => {
          setIsMonitoringDeposit(false);
          setExpectedBalance(null);
          fetchUserBalance();
          toast.info("Deposit processed - balance updated!");
        }, 30000);
      }
      
      return () => {
        if (intervalId) clearInterval(intervalId);
        if (timeoutId) clearTimeout(timeoutId);
      };
    }, [isMonitoringDeposit, expectedBalance, walletAddress]);

    // Function to start monitoring after deposit
    const startDepositMonitoring = (depositAmount: number) => {
      const newExpectedBalance = depositFunds + depositAmount;
      
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
        setDepositFunds(depositFunds);
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
      if(balance && parseFloat(balance.formatted) < depositFunds){
        toast.error("You don't have enough balance to deposit");
        return;
      } else {
        setIsDepositDialogOpen(true);
      }
    }


    // Handle withdraw

    const [isWithdrawing, setIsWithdrawing] = useState(false);

    const handleWithdraw = async () => {
      if (!walletClient || !depositFunds || depositFunds <= 0) {
        toast.error("No funds available to withdraw");
        return;
      }

      try {
        setIsWithdrawing(true);
        // Check if user has a referrer and calculate referral reward
        let referralReward = 0;
        let adjustedWithdrawable = 0;
        if (isReferredUser && referredUser) {
          referralReward = depositFunds * 0.05;
          toast.info(`5% of your deposit (${referralReward.toFixed(4)} MON) will be shared with your referrer.`);
          // Update the reward state
          setReferredUserReward(referredUserReward + referralReward);
          // Transfer referral reward before user withdrawal
          if (walletAddress) {
            try {
              const referralResponse = await ReferralRewardPayout(walletAddress, referralReward);
              if (referralResponse.status === 200) {
                const txhash = referralResponse.data.txHash;

                const EXPLORER_BASE = process.env.NEXT_PUBLIC_EXPLORER_BASE || "https://testnet.monadexplorer.com/tx/";

                const copy = async () => {
                  await navigator.clipboard.writeText(txhash);
                  toast.success("TX hash copied", { autoClose: 2000 });
                };

                toast.success(
                  <div className="text-sm">
                    <div className="font-semibold">Successfully transferred referral reward of {referralReward.toFixed(4)} MON to referrer</div>
                    <div className="mt-1 font-mono break-all">{txhash}</div>
                    <div className="mt-2 flex gap-2">
                      <button onClick={copy} className="px-2 py-1 rounded bg-gray-700 text-white hover:bg-gray-600">Copy</button>
                      <a href={`${EXPLORER_BASE}${txhash}`} target="_blank" rel="noreferrer" className="px-2 py-1 rounded bg-lime-400 text-black hover:bg-lime-300">View</a>
                    </div>
                  </div>
                  ,
                  { autoClose: 12000 }
                );
                setReferredUserReward(0);
                // Adjust the deposit funds to reflect the deduction
                setDepositFunds(depositFunds - referralReward);
              } else {
                toast.error("Failed to transfer referral reward to referrer, proceeding with full withdrawal");
                referralReward = 0; // Reset to avoid deduction if transfer fails
              }
            } catch (error) {
              // Referral reward transfer failed, proceed with withdrawal
              toast.error("Failed to transfer referral reward to referrer, proceeding with full withdrawal");
              referralReward = 0; // Reset to avoid deduction if transfer fails
            }
          }
        }

        const EXPLORER_BASE = process.env.NEXT_PUBLIC_EXPLORER_BASE || "https://testnet.monadexplorer.com/tx/";
  
        
        const currentEarnings = (cumulativePayoutAmount / 150); // Convert death points to ETH
        adjustedWithdrawable = (depositFunds - referralReward) + currentEarnings;
        
        toast.info("Processing withdrawal...");

        const { ethers } = await import("ethers");
        const provider = new ethers.BrowserProvider(walletClient);
        const signer = await provider.getSigner();
        
        const response = await WithdrawFunds(adjustedWithdrawable, signer);
        
        if (response.status === 200) {
          const txHash = response.data.data?.transactionHash || 'unknown';
          toast.success(
            <div className="text-sm">
              <div className="font-semibold">Withdraw successful</div>
              <div className="mt-1 font-mono break-all">{txHash}</div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => {
                    const EXPLORER_BASE = process.env.NEXT_PUBLIC_EXPLORER_BASE || "https://testnet.monadexplorer.com/tx/";
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
                    href={`${EXPLORER_BASE}${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-1 rounded bg-lime-400 text-black hover:bg-lime-300"
                  >
                    View
                  </a>
                )}
              </div>
            </div>,
            { autoClose: 12000 }
          );
          
          setCumulativePayoutAmount(0);
          setFinalPayoutAmount(0);
          setDepositFunds(0);
          
          deathToastShownRef.current = true;
          
          useGame.setState({
            isPlaying: false,
            roundEnded: true,
            diedOnDeathTile: true,
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
        // Withdrawal failed, show appropriate error message
        const errorMessage = error.response?.data?.message || error.message || "Withdrawal failed";
        const maxWithdrawable = error.response?.data?.maxWithdrawable;
        
        if (error?.code === 4001 || errorMessage?.includes("user denied") || errorMessage?.includes("User rejected")) {
          toast.error("Withdrawal transaction rejected. Please confirm the transaction in your wallet to proceed.");
        } else if (maxWithdrawable && maxWithdrawable > 0) {
          toast.error(`${errorMessage}. You can withdraw up to ${maxWithdrawable.toFixed(4)} ETH currently.`);
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
          {sessionId && roundEnded && (
            <button
              onClick={() => {
                window.location.href = `/verify?sessionId=${sessionId}`;
              }}
              className="h-6 px-2 bg-lime-400 text-black rounded text-[10px] leading-6 hover:bg-lime-300 transition-colors"
            >
              Verify
            </button>
          )}
        </div>
      </div>
    )}
    {/* Left */}
    <div>
      {!mounted || isLoadingBalance || isMonitoringDeposit ? (
        <LoadingSpinner />
      ) : !isPlaying && walletAddress ? (
        <>
        {depositFunds > 0 ? (
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
                <span className="text-lime-400 text-xl font-bold">{depositFunds.toFixed(4)} MON</span>
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
            <span className="text-lime-400 text-lg text-center">You need to add funds to play and earn</span>
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
      <span className="text-lime-400 text-xl">Earnings: { (cumulativePayoutAmount / 150).toFixed(4) } MON</span>

      {depositFunds > 0 && cumulativePayoutAmount > 0 && (
        <div className="flex justify-center">
          <button 
            onClick={handleWithdraw}
            disabled={isWithdrawing}
            className="bg-lime-400 text-black cursor-pointer hover:bg-lime-300 transition-colors font-semibold px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isWithdrawing ? "Withdrawing..." : "Withdraw"}
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
        {sessionId && (
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