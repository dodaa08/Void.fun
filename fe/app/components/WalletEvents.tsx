'use client'
import { useEffect, useRef } from 'react'
import { useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createUser } from "../services/api";


export default function WalletEvents() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const walletAddress = publicKey?.toBase58();
  const last = useRef<string | null>(null)
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const lastCreatedRef = useRef<string | null>(null);


  useEffect(() => {
    if (!connected || !publicKey) {
      setUserBalance(null);
      return;
    }
    const fetchBalance = async () => {
      try {
        const lamports = await connection.getBalance(publicKey);
        setUserBalance(lamports / LAMPORTS_PER_SOL);
      } catch (error) {
        console.error('Error fetching balance:', error);
        setUserBalance(null);
      }
    };
    fetchBalance();
    const intervalId = setInterval(fetchBalance, 10000);
    return () => clearInterval(intervalId);
  }, [connected, publicKey, connection]);

  

  useEffect(() => {
    if (!connected || !walletAddress) return;
    if (lastCreatedRef.current === walletAddress) return;
  
    let cancelled = false;
    (async () => {
      try {
        const res = await createUser({ walletAddress, balance: 0 });
        if (cancelled) return;
        lastCreatedRef.current = walletAddress;
      } catch (e: any) {
        lastCreatedRef.current = walletAddress;
      }
    })();
  
    return () => { cancelled = true; };
  }, [connected, walletAddress]);

  return null
}