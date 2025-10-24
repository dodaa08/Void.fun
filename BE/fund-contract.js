import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.MONAD_TESTNET_RPC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contractAddress = process.env.Contract_Address;

async function fundContract() {
    try {
        console.log("Funding contract:", contractAddress);
        console.log("From wallet:", wallet.address);
        
        // Check wallet balance first
        const balance = await provider.getBalance(wallet.address);
        console.log("Wallet balance:", ethers.formatEther(balance), "ETH");
        
        if (balance < ethers.parseEther("100.1")) {
            console.log("❌ Insufficient balance for funding + gas fees");
            return;
        }
        
        // Create contract instance
        const PoolABI = [
            {
                "inputs": [],
                "name": "ownerDeposit",
                "outputs": [],
                "stateMutability": "payable",
                "type": "function"
            }
        ];
        
        const contract = new ethers.Contract(contractAddress, PoolABI, wallet);
        
        // Call ownerDeposit function with 5 ETH
        const tx = await contract.ownerDeposit({
            value: ethers.parseEther("100.0"),
            gasLimit: 100000
        });
        
        console.log("📤 Transaction sent:", tx.hash);
        console.log("⏳ Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed!");
        console.log("Block number:", receipt.blockNumber);
        
        // Check new contract balance
        console.log("\n🔍 Checking new contract balance...");
        const response = await fetch("http://localhost:8001/api/withdrawFunds/contract-info");
        const data = await response.json();
        console.log("New contract balance:", data.data.contractBalance, "ETH");
        
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

fundContract();
