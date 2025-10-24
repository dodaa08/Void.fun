"use client"

import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import { DepositFunds } from "../services/OnchainApi/api";
import { toast } from "react-toastify";
import { useBalance } from "wagmi";
import { FetchDepositFunds } from "../services/OnchainApi/api";


interface DepositDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDepositSuccess?: (depositAmount: number) => void;
}

const DepositDialog = ({ isOpen, onClose, onDepositSuccess }: DepositDialogProps) => {
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const { data: balance } = useBalance({address: address});




  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!walletClient || !address) {
      toast.error("Please connect your wallet");
      return;
    }

    try {

      if(balance && parseFloat(balance.formatted) < parseFloat(amount)){
        toast.error("You don't have enough balance to deposit");
        return;
      }

      setIsLoading(true);

      // Note: We can't check balance here without fetching it first
      // The wallet address doesn't contain balance information
      // Balance checking would need to be done separately if needed
      
      // Convert wagmi client to ethers signer
      const provider = new ethers.BrowserProvider(walletClient);
      const signer = await provider.getSigner();
      
      const depositAmount = parseFloat(amount);
      const txhash = await DepositFunds(depositAmount, signer);
      console.log("txhash", txhash);
      

      const EXPLORER_BASE ="https://testnet.monadexplorer.com/tx/";

      const copy = async () => {
        await navigator.clipboard.writeText(txhash?.data?.transactionHash);
        toast.success("TX hash copied", { autoClose: 2000 });
      };
      toast.success(
        <div className="text-sm">
          <div className="font-semibold">
            Deposit successful {amount} MON!
          </div>
          <div className="mt-1 font-mono break-all">{txhash?.data?.transactionHash}</div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={copy}
              className="px-2 py-1 rounded bg-gray-700 text-white hover:bg-gray-600"
            >
              Copy
            </button>
            {txhash?.data?.transactionHash && (
              <a
                href={`${EXPLORER_BASE}${txhash?.data?.transactionHash}`}
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
      
      
      // toast.success(`Successfully deposited ${amount} ETH! ${txhash}`);
      setAmount("");
      onClose();
      
      // Start monitoring the deposit in the parent component
      if (onDepositSuccess) {
        console.log("[DepositDialog] Starting deposit monitoring for amount:", depositAmount);
        onDepositSuccess(depositAmount);
      }
    } catch (error: any) {
      console.error("Deposit error:", error);
      toast.error(error.message || "Deposit failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setAmount("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Dialog */}
      <div className="relative w-full max-w-md mx-4 bg-[#0f172a]/95 border border-gray-800/60 rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Add Funds</h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-white transition-colors p-1 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Amount Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Amount (ETH)
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.0001"
              min="0"
              disabled={isLoading}
              className="w-full px-4 py-3 bg-[#121a29] border border-gray-700/60 rounded-md text-white placeholder-gray-500 focus:outline-none  transition-colors disabled:opacity-50"
            />
            {/* <span className="absolute right-3 top-3 text-gray-400 text-sm"></span> */}
          </div>
        </div>

        {/* Quick Amount Buttons */}
        <div className="mb-6">
          <p className="text-sm text-gray-400 mb-3">Quick amounts:</p>
          <div className="grid grid-cols-4 gap-2">
            {["0.01", "0.05", "0.1", "0.5"].map((quickAmount) => (
              <button
                key={quickAmount}
                onClick={() => setAmount(quickAmount)}
                disabled={isLoading}
                className="px-3 py-2 bg-[#121a29] border border-gray-700/60 rounded-md text-white text-sm hover:border-emerald-500 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {quickAmount}
              </button>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDeposit}
            disabled={isLoading || !amount || parseFloat(amount) <= 0}
            className="flex-1 px-4 py-3 bg-lime-400 text-black font-bold rounded-md hover:bg-lime-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Depositing...
              </>
            ) : (
              "Deposit"
            )}
          </button>
        </div>

        {/* Wallet Info */}
        {address && (
          <div className="mt-4 pt-4 border-t border-gray-700/60">
            <p className="text-xs text-gray-400">
              Connected: {address.slice(0, 6)}...{address.slice(-4)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DepositDialog;