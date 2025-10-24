import { ethers } from "ethers";
import { PoolABI } from "@/app/contracts/abi";
import axios from "axios";
import { toast } from "react-toastify";


const poolAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

// Deposit funds using user's connected wallet
export const DepositFunds = async (amount: number, signer: ethers.Signer) => {
    if (!amount || amount <= 0) {
        throw new Error("Amount must be greater than 0");
    }
    
    if (!signer) {
        throw new Error("Wallet not connected");
    }
    
    try {
        const poolContract = new ethers.Contract(poolAddress, PoolABI, signer);
        
        const depositTx = await poolContract.userDeposit({
            value: ethers.parseEther(amount.toString()),
        });
        
        const receipt = await depositTx.wait();

        // Get wallet address
        const walletAddress = await signer.getAddress();
        
        const txHash = receipt?.hash || depositTx.hash;

        if(txHash == null){
            throw new Error("Transaction hash is null");
        }

        let backendResponse = null;
        if(txHash && txHash.length > 0 && walletAddress && amount){
            backendResponse = await axios.post(`${process.env.NEXT_PUBLIC_BE_URL}/api/depositFunds/dp`, {
                walletAddress: walletAddress,
                amount: amount,
                txHash: txHash
            });
            
            if(backendResponse.status !== 200){
                throw new Error("Failed to deposit funds");
            }
        }
        if(backendResponse == null) return;

        return backendResponse;
    } catch (error: any) {
        console.error("DepositFunds error:", error);
        
        // If it's an axios error, log the response details
        if (error.response) {
            console.error("Backend error:", error.response.status);
            throw new Error(`Backend error: ${error.response.data?.message || error.response.statusText}`);
        }
        
        throw error;
    }
}


export const FetchDepositFunds = async (walletAddress: string) => {
    const backendResponse = await axios.post(`${process.env.NEXT_PUBLIC_BE_URL}/api/depositFunds/fd`, {
        walletAddress: walletAddress
    });
    return backendResponse;
}




// Withdraw funds


export const WithdrawFunds = async (amount: number, signer: ethers.Signer) => {
    const walletAddress = await signer.getAddress();
    try{
        const backendResponse = await axios.post(`${process.env.NEXT_PUBLIC_BE_URL}/api/withdrawFunds/wd`, {
            walletAddress: walletAddress,
            amount: amount
        });

        if(backendResponse.status !== 200){
            throw new Error("Failed to withdraw funds");
        }

        return backendResponse;

    }
    catch(error: any){
        console.error("WithdrawFunds error:", error);
        throw error;
    }
}



// Leaderboard data

export const FetchLeaderboardData = async () => {
    const backendResponse = await axios.get(`${process.env.NEXT_PUBLIC_BE_URL}/api/leaderboard/leaderboard-data`);
    return backendResponse;
}


// Referral reward payout
export const ReferralRewardPayout = async (walletAddress: string, amount: number) => {
    const backendResponse = await axios.post(`${process.env.NEXT_PUBLIC_BE_URL}/api/payouts/referral`, {
        walletAddress: walletAddress,
        amount: amount
    });

    return backendResponse;
}







