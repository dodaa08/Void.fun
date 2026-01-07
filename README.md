# Void

A provably fair, on-chain casino game built on Solana. Navigate through tiles, avoid death traps, and cash out your winnings. Inspired by death.fun.

**Live Demo:** [void-fun.onrender.com](https://void-fun.onrender.com)

## How It Works

Players deposit SOL and navigate a randomly generated tile board. Each row contains one hidden "death tile" - hit it and you lose everything. Successfully navigate rows to multiply your stake. Cash out anytime or risk it all for higher multipliers.

The game is **provably fair**: death tile positions are determined by a server seed that's committed (hashed) before you play. After each round, you can verify that outcomes weren't manipulated.

## Features

- **On-chain deposits & withdrawals** - SOL moves directly through Solana smart contracts
- **Provably fair** - SHA-256 commit-reveal scheme, verify any game session
- **Real-time caching** - Redis-backed game state for seamless gameplay
- **Leaderboard** - Track top earners

## Contract Addresses

| Network | Address |
|---------|---------|
| **Casino Program** (Devnet) | `7eoY2tr9vaZEEjX1q64q3ovND5Erg9ZjK8CfujxDfh8p` |
| **Casino PDA** | `HbiPVZB2aUPxEz4V3GLy52jTfB3ChmBAj8hmjZun641t` |
| **Authority** | `CUcTGB5CyRhfh9jvVDZB734DG38XfZFX1a3L86FosSBu` |

## Architecture

```
├── fe/              # Next.js frontend
│   ├── components/  # React components (tileboard, leaderboard, etc.)
│   ├── store/       # Zustand game state
│   └── services/    # API + on-chain interactions
│
├── BE/              # Express.js backend
│   ├── routes/      # deposit, withdraw, payouts, cache
│   ├── servicies/   # Redis caching layer
│   └── Db/          # MongoDB schemas
│
└── contract/        # Anchor smart contract (Solana program)
    └── programs/    # deposit, withdraw, payout instructions
```

## Quick Start

### Prerequisites

- Node.js 18+
- Rust + Solana CLI (for contract development)
- MongoDB
- Redis

### Backend

```bash
cd BE
npm install
cp .env.example .env  # Configure your environment
npm run dev
```

Required env vars:
- `SOLANA_RPC_URL` - Devnet RPC endpoint
- `CASINO_PROGRAM_ID` - Deployed program ID
- `SOLANA_AUTHORITY_PRIVATE_KEY` - Authority keypair (JSON array format)
- `MONGO_DB_URL` - MongoDB connection string
- `REDIS_URL` - Redis connection string

### Frontend

```bash
cd fe
npm install
npm run dev
```

Frontend runs on `localhost:3000`, backend on `localhost:8001`.

### Smart Contract

```bash
cd contract
anchor build
anchor deploy --provider.cluster devnet
```

## Game Mechanics

1. **Deposit** - Send SOL to casino PDA, credited to your user account
2. **Play** - Click tiles row by row, avoiding death tiles
3. **Multipliers** - Each successful row increases your potential payout (starts ~1.10x, grows ~1.18x per row)
4. **Cash out** - Withdraw anytime to lock in winnings
5. **Death tile** - Hit it and lose your stake + accumulated earnings

## Provably Fair Verification

Each game session:
1. Server generates a random seed
2. `SHA-256(seed)` is committed before gameplay
3. Death tiles derived from `SHA-256(seed + "-row" + rowIndex)`
4. After round ends, seed is revealed - verify the commit matches

Visit `/verify?sessionId=<id>` to verify any session.

## Tech Stack

- **Frontend:** Next.js 14, Tailwind CSS, Zustand, Solana Wallet Adapter
- **Backend:** Express.js, MongoDB, Redis
- **Blockchain:** Solana, Anchor Framework
- **Deployment:** Render (backend), Vercel-compatible (frontend)

## API Routes

| Endpoint | Description |
|----------|-------------|
| `POST /api/depositFunds/dp` | Process deposit transaction |
| `POST /api/withdrawFunds/wd` | Process withdrawal |
| `POST /api/payouts/` | Payout winnings |
| `POST /api/cache/tile` | Cache tile selection |
| `GET /api/leaderboard/` | Fetch leaderboard |

---

Built for 100x Solana Hackathon
