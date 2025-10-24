"use client";

import Tileboard from "./tileboard";
import Bottombar from "./bottombar";
import Leaderboard from "./leaderboard";
import { useGame } from "../store/useGame";
import { useEffect } from "react";
import { useAccount } from "wagmi";

const Hero = ()=>{
    const { start } = useGame();
    const { address: walletAddress } = useAccount();


    useEffect(() => {
        // Removed auto setSessionId on wallet connect to preserve session across reloads
    }, [walletAddress]);
    
    return(
        <>
        <div className="flex w-full items-stretch overflow-x-hidden">
            <div className="flex flex-row w-full gap-0">
                {/* Left: Scrollable Tileboard sidebar touching leaderboard border */}
                <aside className="flex-1 min-w-[720px] h-[calc(100vh-8rem)] overflow-y-auto pr-4">
                    <Tileboard />
                </aside>

                {/* Right: Leaderboard pinned to the far right with narrow width */}
                <div className="ml-auto w-[400px] shrink-0 border-l border-gray-800 pl-4 pr-2">
                    <Leaderboard />
                </div>
            </div>
        </div>

        {/* Sticky bottom bar overlaying at the bottom, independent from sidebar scroll */}
        <div className="sticky bottom-0 left-0 right-0 z-20">
            <Bottombar />
        </div>
        </>
    )
}

export default Hero;
