"use client";

import { useState } from "react";
import Connectbutton from "./Connectbutton";
import { useAccount } from "wagmi";
import { getTotalEarnings } from "../services/api";
import { useEffect } from "react";


const Navbar = () => {
  const { address } = useAccount();
  const [isReferralDialogOpen, setIsReferralDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [isLoadingTotalEarnings, setIsLoadingTotalEarnings] = useState(false);
  // const [totalEarnings, setTotalEarnings] = useState(0);

  const handleReferralClick = () => {
    setIsReferralDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsReferralDialogOpen(false);
  };

  const handleGenerateLink = () => {
    // Placeholder for generating referral link
    if (address) {
      return `https://casino-onchain-monad.vercel.app/referral?ref=${address}`;
    }
    return "";
  };

  useEffect(() => {
    const fetchTotalEarnings = async () => {
      setIsLoadingTotalEarnings(true);
      const totalEarnings = await getTotalEarnings(address || "");
      setTotalEarnings(totalEarnings.data); 
      setIsLoadingTotalEarnings(false);
    };
    fetchTotalEarnings();
  }, [address]);



  // useEffect(() => {
  //   const fetchTotalEarnings = async () => {
  //     const totalEarnings = await getTotalEarnings();
  //     setTotalEarnings(totalEarnings);
  //   };
  //   fetchTotalEarnings();
  // }, []);



  const handleCopyLink = () => {
    const link = handleGenerateLink();
    if (link) {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <div className="flex justify-center py-5 w-full border-b border-lime-900 bg-black/90">
        <div className="flex justify-between items-center w-full px-4">
          {/* Left side components */}
          <div className="flex items-center gap-6 text-xl">
            <button 
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors cursor-pointer"
              onClick={handleReferralClick}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-lime-400/70">
                <path fill="currentColor" d="M12 12a5 5 0 1 0-5-5a5 5 0 0 0 5 5m4 1h-1.26a7.004 7.004 0 0 1-5.48 0H8a5 5 0 0 0-5 5v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-1a5 5 0 0 0-5-5"/>
              </svg>
              <span className="text-lg" >Referrals</span>
            </button>
          </div>  

          {/* Center components */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-lime-400/10 flex items-center justify-center shadow-[0_0_20px_rgba(163,230,53,0.35)]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-6 h-6 text-lime-400">
                <rect x="4" y="4" width="16" height="16" rx="3" ry="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/>
                <circle cx="15.5" cy="8.5" r="1.3" fill="currentColor"/>
                <circle cx="12" cy="12" r="1.3" fill="currentColor"/>
                <circle cx="8.5" cy="15.5" r="1.3" fill="currentColor"/>
                <circle cx="15.5" cy="15.5" r="1.3" fill="currentColor"/>
              </svg>
            </div>
            <div>
              <h1 className="flex justify-center items-center text-lime-400 text-center tracking-widest text-2xl font-serif" style={{ textShadow: "0 0 10px rgba(163, 230, 53, 0.7), 0 0 24px rgba(163, 230, 53, 0.45)" }}>
                Void.fun
              </h1>
            </div>
          </div>

          {/* Right side components */}
          <div className="flex items-center">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm">

               <div className="flex flex-row gap-2">

                
                {
                    address && !isLoadingTotalEarnings && (
                      <>
                    {
                      isLoadingTotalEarnings ? (
                        <span className="text-lime-400 font-semibold">...</span>
                      ) : (
                        <>
                        <div className="w-5 h-5 rounded-full bg-lime-400 flex items-center justify-center shadow-[0_0_12px_rgba(163,230,53,0.6)]">
                  <span className="text-black text-xs">☺</span>

                </div>
                        <span className="text-lime-400 font-semibold text-xs flex items-center">{
                          totalEarnings > 0 ? totalEarnings.toFixed(4) : "0.0000"
                        }</span>
                        </>
                      ) 
                    }
                   
                    </>
                  ) 
                }
                </div>
                
              </div>

              <div className="mr-2">
                <Connectbutton />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Referral Dialog */}
      {isReferralDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f172a]/95 border border-gray-800/60 rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Referral Link</h2>
              <button
                onClick={handleCloseDialog}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-4">
              <p className="text-gray-300 mb-2">Share this link with friends to earn rewards from their deposits:</p>
              {address ? (
                <div className="bg-[#121a29] border border-gray-700/60 rounded-md p-3 flex items-center justify-between">
                  <p className="text-sm text-white truncate flex-1">{handleGenerateLink()}</p>
                  <button
                    onClick={handleCopyLink}
                    className="ml-2 px-3 py-1 bg-gray-700 text-white text-sm rounded-md hover:bg-gray-600 transition-colors"
                  >
                    {copied ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              ) : (
                <p className="text-gray-400 italic">Connect your wallet to generate a referral link.</p>
              )}
            </div>
            <div className="flex justify-between items-center mb-4">
             
              <button
                onClick={handleCloseDialog}
                className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;