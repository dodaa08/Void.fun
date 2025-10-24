"use client";

import { useEffect, useState } from "react";

import { FetchLeaderboardData } from "../services/OnchainApi/api";
// import { useEffect, useState } from "react";

type LeaderboardEntry = {
	rank: number;
	walletAddress: string;
	totalEarned: number;
	roundsPlayed: number;
}


const Leaderboard = ()=>{
	const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
	const [spinner, setSpinner] = useState(false);
	


	useEffect(() => {
		const fetchLeaderboardData = async () => {
			try {
				setSpinner(true);
				const response = await FetchLeaderboardData();
				setEntries(response.data.data.leaderboard);
				setSpinner(false);
			} catch (error) {
				console.error("Failed to fetch leaderboard:", error);
			}
		}
		fetchLeaderboardData();
	}, []);


	const LoadingSpinner = () => (
		<div className="flex items-center justify-center">
		  <svg className="animate-spin h-6 w-6 text-lime-400" fill="none" viewBox="0 0 24 24">
			<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
			<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
		  </svg>
		  <span className="ml-2 text-lime-400">Loading...</span>
		</div>
	  );



	return (
		<>
		
	    <div className=" flex justify-center min-h-max  select-none overflow-y-auto h-[calc(100vh-8rem)] w-full	">
			<div className="">
				<div className="py-5">
					<h3 className="text-lime-400 text-center tracking-widest text-sm font-bold py-5">LEADERBOARD</h3>
				</div>


                 {
					spinner ? (
						<>
						<div className="flex justify-center items-center h-full">
						<LoadingSpinner />
						</div>
						</>
					) : (
						<div className="bg-[#0b1206]/80 rounded-xl w-90">
					<ul className="divide-y divide-lime-900/40">
						{entries.map((e, i) => (
							<li key={i} className="flex items-center justify-between px-4 py-3">
								<div className="flex items-center gap-3">
									<span className="text-gray-400 text-xs w-4">{e.rank}</span>
									<span className="text-gray-200 text-sm truncate max-w-[180px]">{e.walletAddress}</span>
								</div>
								<div className="text-right">
									<span className="text-lime-400 font-semibold tabular-nums text-sm">+{e.totalEarned.toFixed(4)}</span>
									<span className="text-gray-400 text-xs ml-1">MON</span>
								</div>
							</li>
						))}
					</ul>
				</div>
					)
				 }
				
			</div>
		</div>
						</>
	)
}

export default Leaderboard;
