# Solana Casino Project

A decentralized casino application built on Solana blockchain with Next.js frontend and Node.js backend.

## Project Structure

```
Solana/
├── BE/                 # Backend API server
├── casino/            # Solana program (smart contract)
├── fe/                # Frontend Next.js application
└── README.md          # This file
```

## Components

### Backend (BE/)
- Node.js/Express API server
- Handles user authentication and game logic
- Connects to Solana blockchain for transactions
- Uses MongoDB for data persistence
- Redis for session management

### Casino Program (casino/)
- Solana smart contract written in Rust
- Handles on-chain game logic and fund management
- Implements deposit, withdraw, and payout functionality

### Frontend (fe/)
- Next.js React application
- User interface for casino games
- Wallet integration for Solana transactions
- Real-time game updates

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Rust and Solana CLI tools
- MongoDB
- Redis

### Installation

1. Clone the repository
2. Install dependencies for each component:
   ```bash
   # Backend
   cd BE && npm install
   
   # Frontend
   cd fe && npm install
   
   # Casino program
   cd casino && cargo build
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env` in each directory
   - Configure Solana RPC URL, program ID, and other settings

4. Start the services:
   ```bash
   # Backend
   cd BE && npm run dev
   
   # Frontend
   cd fe && npm run dev
   ```

## Environment Variables

### Backend (.env)
- `SOLANA_RPC_URL`: Solana RPC endpoint
- `CASINO_PROGRAM_ID`: Deployed program ID
- `SOLANA_AUTHORITY_PRIVATE_KEY`: Authority keypair
- `MONGO_DB_URL`: MongoDB connection string
- `REDIS_URL`: Redis connection string
- `PORT`: Server port (default: 8001)

### Frontend (.env.local)
- `NEXT_PUBLIC_CASINO_PROGRAM_ID`: Program ID for frontend
- `NEXT_PUBLIC_SOLANA_RPC_URL`: RPC URL for frontend

## Development

- Backend runs on port 8001
- Frontend runs on port 3000
- Casino program deploys to Solana devnet/testnet

## License

This project is for educational purposes.
