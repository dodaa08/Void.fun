'use client'
import { useEffect, useRef } from 'react'
import { useState } from 'react'
// import { useAccount, useBalance } from 'wagmi'
// import { createUser } from '@/app/services/api'
import { useAccount, useBalance } from "wagmi";
import { createUser } from "../services/api";


export default function WalletEvents() {
  // const { address, isConnected } = useAccount()
  const { address: walletAddress, isConnected } = useAccount();
  const last = useRef<string | null>(null)
  const {data, isLoading} = useBalance({address: walletAddress})
  const [userbalance, setUserbalance] = useState(0)
  const lastCreatedRef = useRef<string | null>(null);


  useEffect(() => {
    if(isLoading){
     console.log("Loading... userbalance")
        return;
    }
    if(walletAddress && data){
      setUserbalance(Number(data?.value))
    }       
  }, [walletAddress, data])

  

  useEffect(() => {
    if (!isConnected || !walletAddress) return;
    if (lastCreatedRef.current === walletAddress) return;
  
    let cancelled = false;
    (async () => {
      try {
        const res = await createUser({ walletAddress, balance: 0 });
        if (cancelled) return;
        lastCreatedRef.current = walletAddress;
        console.log("[USER] ensured", res);
      } catch (e: any) {
        lastCreatedRef.current = walletAddress;
        console.log("[USER] ensure skipped/exists", e?.message || e);
      }
    })();
  
    return () => { cancelled = true; };
  }, [isConnected, walletAddress]);

  return null
}