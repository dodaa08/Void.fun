import axios from "axios";

const base = (process.env.NEXT_PUBLIC_BE_URL as string) || "http://localhost:8001";


type CacheTilePayload = {
  sessionId: string | number;
  rowIndex: number | string;
  tileIndex: number | string;
  isDeath: boolean;
  roundEnded: boolean;
  walletAddress: string;
};

type CreateUserPayload = {
  walletAddress: string;
  balance: number;
};


type SessionPayload = {
  isDeath: boolean;
  roundEnded: boolean;
  walletAddress: string;
  sessionId: string;
  // roundNumber: number;
  rowIndex: number;
  tileIndex: number;
  // multiplier: number;
}

// Create Cache tile 

export async function cacheTile(p: CacheTilePayload) {
  const res = await fetch(`${base}/api/cache/cache-tiles`, {
    method: "POST", 
    headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify(p),
  });

  const data = await res.json();
  if (!res.ok) {
    // console.error("[API] cache-tiles failed", res.status, data);
    throw new Error(`cacheTile failed: ${res.status} - ${data.message || 'Unknown error'}`);
  }
  
  return data;
}

export async function cachePayout(p: { key: string; value: number; roundEnded: boolean; walletAddress?: string }) {
  const res = await fetch(`${base}/api/cache/cache-payout`, {
    method: "POST", 
    headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify(p),
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    // console.error("[API] cache-payout failed", res.status, errorData);
    throw new Error(`cachePayout failed: ${res.status} - ${errorData.message || 'Unknown error'}`);
  }
  
  return res.json();
}


// Create User
export async function createUser(payload: CreateUserPayload) {
  const res = await fetch(`${base}/api/users/create-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: payload.walletAddress, balance: payload.balance }),
  });

  const data = await res.json().catch(() => ({}));

  // Treat “already exists” as non-fatal
  if (res.status === 400 && data?.message === "User already exists") {
    return { success: true, exists: true };
  }

  if (!res.ok) {
    // console.error("[API] createUser failed", res.status, data);
    throw new Error(`createUser failed: ${res.status}`);
  }

  return data;
}

// Get User
export async function getUser(walletAddress : string){
  const res = await fetch(`${base}/api/users/get-user/${walletAddress}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
  });
  const data = await res.json();
  return data;
}


// get last session id
export async function getLastSessionId(walletAddress : string){
  const res = await fetch(`${base}/api/cache/get-last-sessionId/${walletAddress}`, {
    method: "GET", headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`getLastSessionId failed: ${res.status}`);
  const data = await res.json();
  return data;
}


// get session state (simplified)
export const getSessionState = async (sessionId: string) => {
  const ts = Date.now();
  const url = `${base}/api/cache/check-cache/${sessionId}?t=${ts}`;
  const res = await fetch(url, { method:"GET", headers:{ "Content-Type":"application/json" }, cache:"no-store" });
  return res.json();
};


// cache the incresing payouts 
export const cachePayouts = async (p: { key: string; value: number; roundEnded: boolean, walletAddress: string })=>{
  if(!p.walletAddress) throw new Error(`walletAddress is required`);
  const res = await fetch(`${base}/api/cache/cache-payout`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p),
  });
  if (!res.ok) throw new Error(`cachePayouts failed: ${res.status}`); 
  const data = await res.json();
  return data;
}


// get cached payouts
export const getCachedPayouts = async (walletAddress: string)=>{
  const res = await fetch(`${base}/api/cache/check-payout/${walletAddress}`, {
    method: "GET", headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`getCachedPayouts failed: ${res.status}`);
  return res.json();
};

// clear cache for replay
export const clearCache = async (walletAddress: string)=>{
  const res = await fetch(`${base}/api/cache/clear-cache`, {
    method: "POST", 
    headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify({ walletAddress }),
  });
  if (!res.ok) throw new Error(`clearCache failed: ${res.status}`); 
  const data = await res.json();
  return data;
};



// Connect wallet for referral

export const ConnectWallet = async (walletAddress: string, referrer: string)=>{
  try{
    const res = await axios.post(`${process.env.NEXT_PUBLIC_BE_URL}/api/users/wallet-connect`, {
      walletAddress: walletAddress,
      referrer: referrer
    });
    return res;
  } catch(error){
    // console.error("ConnectWallet error:", error);
    throw error;
  }

}


// get referred user
export const getReferredUser = async (walletAddress: string)=>{
  const res = await fetch(`${base}/api/users/get-referred-user`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress }),
  });
  return res.json();
}



// get Total Earnings
export const getTotalEarnings = async (walletAddress: string)=>{
  const res = await fetch(`${base}/api/leaderboard/get-total-earnings`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress }),
  });
  return res.json();
}

// Verify if session ID is valid (exists in backend)
export const verifySessionId = async (sessionId: string)=>{
  const res = await fetch(`${base}/api/cache/verify-session/${sessionId}`, {
    method: "GET", headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`verifySessionId failed: ${res.status}`);
  return res.json();
}

// ===== PROVABLY FAIR GAME API FUNCTIONS =====

// Start a new provably fair game session
export const startSession = async (walletAddress: string) => {
  const res = await fetch(`${base}/api/cache/start-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    // console.error("[API] start-session failed", res.status, errorData);
    throw new Error(`startSession failed: ${res.status} - ${errorData.message || 'Unknown error'}`);
  }
  
  return res.json();
};

// Get session data (reveals server seed after game ends)
export const getSession = async (sessionId: string) => {
  const res = await fetch(`${base}/api/cache/get-session/${sessionId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    // console.error("[API] get-session failed", res.status, errorData);
    throw new Error(`getSession failed: ${res.status} - ${errorData.message || 'Unknown error'}`);
  }
  
  return res.json();
};

// Verify session exists and is valid
export const verifySession = async (sessionId: string) => {
  const res = await fetch(`${base}/api/cache/verify-session/${sessionId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    // console.error("[API] verify-session failed", res.status, errorData);
    throw new Error(`verifySession failed: ${res.status} - ${errorData.message || 'Unknown error'}`);
  }
  
  return res.json();
};

// Start a new session with Redis storage
export const StartSession = async (walletAddress: string, numRows: number = 12) => {
  const res = await fetch(`${base}/api/cache/start-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      walletAddress
    }),
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    // console.error("[API] StartSession failed", res.status, errorData);
    throw new Error(`StartSession failed: ${res.status} - ${errorData.message || 'Unknown error'}`);
  }
  
  return res.json();
};

// Restore session data from Redis
export const RestoreSession = async (sessionId: string) => {
  const res = await fetch(`${base}/api/cache/restore-session/${sessionId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    // console.error("[API] RestoreSession failed", res.status, errorData);
    throw new Error(`RestoreSession failed: ${res.status} - ${errorData.message || 'Unknown error'}`);
  }
  
  return res.json();
};

// Get deterministic death index for a row from server
export const GetDeathIndex = async (sessionId: string, rowIndex: number) => {
  const res = await fetch(`${base}/api/cache/death-index/${sessionId}/${rowIndex}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    // console.error("[API] GetDeathIndex failed", res.status, errorData);
    throw new Error(`GetDeathIndex failed: ${res.status} - ${errorData.message || 'Unknown error'}`);
  }
  
  return res.json();
};

// Reveal server seed (only after round ends; otherwise returns commit)
export const RevealServerSeed = async (sessionId: string) => {
  const res = await fetch(`${base}/api/cache/reveal/${sessionId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    // console.error("[API] RevealServerSeed failed", res.status, errorData);
    throw new Error(`RevealServerSeed failed: ${res.status} - ${errorData.message || 'Unknown error'}`);
  }
  
  return res.json();
};

// ===== TYPES FOR PROVABLY FAIR SYSTEM =====

export type StartSessionPayload = {
  walletAddress: string;
};

export type StartSessionResponse = {
  success: boolean;
  message: string;
  data: {
    sessionId: string;
    serverCommit: string;
    clientSeed: string;
    boardLayout: number[];
    numRows: number;
    timestamp: string;
  };
};

export type GetSessionResponse = {
  success: boolean;
  message: string;
  data: {
    sessionId: string;
    serverSeed: string;
    serverCommit: string;
    clientSeed: string;
    boardLayout: number[];
    deathTiles: Record<number, number>;
    numRows: number;
    timestamp: string;
    isPlaying: boolean;
    roundEnded: boolean;
  };
};

export type VerifySessionResponse = {
  success: boolean;
  valid: boolean;
  message: string;
  data: {
    sessionId: string;
    isPlaying: boolean;
    roundEnded: boolean;
  } | null;
};