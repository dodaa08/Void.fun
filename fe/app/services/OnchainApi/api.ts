import axios from "axios";
import { toast } from "react-toastify";


// Deposit funds using user's connected Solana wallet
export const DepositFunds = async (walletAddress: string, amount: number, signedTransaction: string) => {
    if (!walletAddress || !amount || amount <= 0 || !signedTransaction) {
        throw new Error("Missing required fields for deposit: walletAddress, amount, signedTransaction");
    }
    try {
        const backendResponse = await axios.post(`${process.env.NEXT_PUBLIC_BE_URL}/api/depositFunds/dp`, {
            walletAddress,
            amount,
            signedTransaction
        });
        if (backendResponse.status !== 200) {
            throw new Error("Failed to deposit funds via backend");
        }
        return backendResponse;
    } catch (error: any) {
        console.error("DepositFunds error:", error);
        if (error.response) {
            console.error("Backend error response:", error.response.status, error.response.data);
            throw new Error(`Backend error: ${error.response.data?.message || error.response.statusText}`);
        }
        throw error;
    }
};


export const FetchDepositFunds = async (walletAddress: string) => {
    const backendResponse = await axios.post(`${process.env.NEXT_PUBLIC_BE_URL}/api/depositFunds/fd`, {
        walletAddress: walletAddress
    });
    return backendResponse;
}




// Withdraw funds


export const WithdrawFunds = async (walletAddress: string, amount: number, signedTransaction: string) => {
    if (!walletAddress || !amount || amount <= 0 || !signedTransaction) {
        throw new Error("Missing required fields for withdrawal: walletAddress, amount, signedTransaction");
    }
    try {
        const backendResponse = await axios.post(`${process.env.NEXT_PUBLIC_BE_URL}/api/withdrawFunds/wd`, {
            walletAddress,
            amount,
            signedTransaction
        });
        if (backendResponse.status !== 200) {
            throw new Error("Failed to withdraw funds via backend");
        }
        return backendResponse;
    } catch (error: any) {
        console.error("WithdrawFunds error:", error);
        if (error.response) {
            console.error("Backend error response:", error.response.status, error.response.data);
            throw new Error(`Backend error: ${error.response.data?.message || error.response.statusText}`);
        }
        throw error;
    }
};



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







