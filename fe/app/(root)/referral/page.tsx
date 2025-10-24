"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import Connectbutton from "../../components/Connectbutton";
import { ConnectWallet } from "@/app/services/api";
import { toast } from "react-toastify";


// Referral page content component
const ReferralPageContent = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const referrer = searchParams.get("ref") || "";
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (referrer) {
      localStorage.setItem("referrer", referrer);
    }
  }, [referrer]);

  useEffect(() => {
    if (isConnected && address) {
      const storedReferrer = localStorage.getItem("referrer") || "";
      if (storedReferrer) {
        sendReferralData(address, storedReferrer);
      } else {
        setTimeout(() => {
          router.push('/');
        }, 1000);
      }
    }
  }, [isConnected, address, router]);

  const sendReferralData = async (walletAddress: string, referrer: string) => {
    setIsLoading(true);
    try {
      const res = await ConnectWallet(walletAddress, referrer);
      if (res.data.success) {
        toast.success("Referral successful! 5% of your staked amount will be shared with your referrer.", { autoClose: 4000 });
        setTimeout(() => {
          router.push('/');
        }, 4000);
      } else {
        toast.error("Referral connection failed. Please try again.", { autoClose: 3000 });
        setTimeout(() => {
          router.push('/');
        }, 3000);
      }
    } catch (error) {
      console.error("Error connecting wallet with referral:", error);
      toast.error("Referral connection error. Please try again.", { autoClose: 3000 });
      setTimeout(() => {
        router.push('/');
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipReferral = () => {
    localStorage.removeItem("referrer");
    router.push('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080c14] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-[#0f172a]/90 border border-gray-800/60 p-8 shadow-lg">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-200">Welcome to Death Fun</h1>
        <p className="mb-8 text-center text-gray-400">You&apos;ve been invited through a referral. Connect your wallet to join the game!</p>
        
        <div className="mb-6 flex justify-center">
          <Connectbutton />
        </div>

        {isLoading && (
          <div className="mb-6 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-lime-400 border-t-transparent"></div>
          </div>
        )}

        <div className="mt-4 text-center">
          <button
            onClick={handleSkipReferral}
            className="mt-2 text-sm text-gray-500 underline hover:text-gray-300"
          >
            Skip and go to homepage
          </button>
        </div>
      </div>
    </div>
  );
};

// Main component with Suspense boundary
const ReferralPage = () => {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] text-white p-4">
        <div className="bg-[#0b1206]/80 rounded-xl p-6 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-lime-400 mb-4">Loading...</h1>
        </div>
      </div>
    }>
      <ReferralPageContent />
    </Suspense>
  );
};

export default ReferralPage;
