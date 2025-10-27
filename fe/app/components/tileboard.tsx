"use client"

import { useEffect, useMemo, useRef, useState, useCallback, memo } from "react";
import { useGame } from "../store/useGame";
import { useWallet } from '@solana/wallet-adapter-react';
import { getSessionState, getLastSessionId, GetDeathIndex } from "@/app/services/api";
import deathtile from "../../public/death-skull.svg";



type BoardRow = {
	multiplier: number
	tiles: number
}

const TileBoard = ()=>{
	const [rows, setRows] = useState<BoardRow[]>([]);
	const { isPlaying, selectTile, endRound, sessionId, rehydrate, setSessionId, Replay, setReplay, shuffleBoard, setShuffleBoard } = useGame();
	const { publicKey } = useWallet();
	const [activeRow, setActiveRow] = useState(0);
	const [clickedByRow, setClickedByRow] = useState<Record<number, boolean>>({});
	const [clickedTileIndex, setClickedTileIndex] = useState<Record<number, number>>({}); // row -> clicked tile index
	const [deathTiles, setDeathTiles] = useState<Record<number, number>>({}); // row -> death tile index
	const skipNextStartResetRef = useRef(false);
	const fetchedLastSessionRef = useRef(false);
	const [spinner, setSpinner] = useState(false);
	const isProcessingClickRef = useRef(false);
	

	const LoadingSpinner = ({ message = "Loading..." }) => (
		<div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
		  <div className="flex flex-col items-center gap-4">
			<div className="w-16 h-16 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
			<p className="text-emerald-400 text-lg font-semibold">{message}</p>
		  </div>
		</div>
	  );


	

    const formatMultiplier = useCallback((mult: number): string => {
	   return `${mult.toFixed(2)}x`
    }, []);

	const visualRows = useMemo(() => [...rows].reverse(), [rows]);

	useEffect(() => {
		// Generate 12–15 boards
		const numRows = 12 + Math.floor(Math.random() * 4) // 12..15
		const startMultiplier = 1.10
		const growthPerRow = 1.18
		const generated: BoardRow[] = []
		for (let i = 0; i < numRows; i++) {
			const tiles = 2 + Math.floor(Math.random() * 6)
			const multiplier = startMultiplier * Math.pow(growthPerRow, i)
			generated.push({ multiplier, tiles })
		}
		setRows(generated)
		setClickedByRow({})
		setClickedTileIndex({})
		setDeathTiles({})
	}, []);

	useEffect(() => {
		// reset progression on start
		if (!isPlaying) return;
		if (skipNextStartResetRef.current) { skipNextStartResetRef.current = false; return; }
		setClickedByRow({})
		setClickedTileIndex({})
		setDeathTiles({})
		setActiveRow(Math.max(visualRows.length - 1, 0))
	}, [isPlaying, visualRows.length]);

	// If sessionId is empty on reload, fetch the last session for this wallet
	useEffect(() => {
		if (sessionId || !publicKey || fetchedLastSessionRef.current) return;
		let cancelled = false;
		(async () => {
			try {
				const res = await getLastSessionId(publicKey.toBase58());
				if (cancelled) return;
				const last = res?.sessionId ?? res?.lastSessionId ?? null;
				if (last) {
					setSessionId(last);
					fetchedLastSessionRef.current = true;
				}
			} catch (e) {
				// Session fetch failed, continue without session
			}
		})();
		return () => { cancelled = true };
	}, [sessionId, publicKey, setSessionId]);

	// Rehydrate from backend cache when session and rows are ready
	useEffect(() => {
		if (!sessionId || rows.length === 0) return;

		let cancelled = false;
		(async () => {
			try {
				const sessionState = await getSessionState(sessionId);
				if (cancelled) return;

				// Restore playing flag from server
				if (sessionState && sessionState.isPlaying) {
					skipNextStartResetRef.current = true;
					rehydrate({ isPlaying: true, roundEnded: false });
				}

				if (sessionState.roundEnded || !sessionState.isPlaying) {
					setSpinner(false);
					return;
				}

				const lastClickedRow = sessionState.lastClicked ?? sessionState.lastClickedRow;
				if (lastClickedRow !== null && lastClickedRow !== undefined) {
					// Restore to next row after last clicked
					const nextRow = parseInt(lastClickedRow) + 1;
					if (nextRow < rows.length) {
						const visualIdx = rows.length - 1 - nextRow;
						setActiveRow(visualIdx);
						skipNextStartResetRef.current = true;
						rehydrate({ isPlaying: true, roundEnded: false, rowIndex: nextRow });
					}	
				}
				setSpinner(false);
			} catch (e) {
				// Session rehydration failed, stop spinner and continue
				setSpinner(false);
			}
		})();
		return () => { cancelled = true };
	}, [sessionId, rows.length, rehydrate]);


	// Maintain game state using : 

	async function sha256Hex(input: string) {
		const data = new TextEncoder().encode(input)
                const hash = await crypto.subtle.digest("SHA-256", data.buffer as ArrayBuffer)
		return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("")
	}

	async function getDeathTileIndex(seed: string, rowIdx: number, tiles: number) {
		const h = await sha256Hex(`${seed}-row${rowIdx}`)
				// diversify selection to avoid index 0 too often
		const n = parseInt(h.slice(8, 16), 16)
		return tiles > 0 ? ((n % tiles) + 1) % tiles : 0
	}

	const handleTileClick = useCallback(async (visualIdx: number, clickedTileIdx: number)=>{
		if(!publicKey || !isPlaying) return;
		if (visualIdx !== activeRow || clickedByRow[visualIdx]) return; // only current row once
		
		// Prevent multiple simultaneous clicks
		if (isProcessingClickRef.current) return;
		
		isProcessingClickRef.current = true;

		// Ensure session exists if user skipped Play
		if (!sessionId) {
			const id = crypto.randomUUID();
			setSessionId(id);
		}
		

		// Map visual index back to original rows index
		const actualIdx = rows.length - 1 - visualIdx;
		const tiles = rows[actualIdx]?.tiles ?? 0
		let deathIdx: number;
		if (sessionId) {
			try {
				const res = await GetDeathIndex(sessionId, actualIdx);
				deathIdx = Number(res?.deathIndex);
				if (!Number.isFinite(deathIdx)) {
					deathIdx = await getDeathTileIndex(sessionId || "local-seed", actualIdx, tiles)
				}
			} catch (e) {
				deathIdx = await getDeathTileIndex(sessionId || "local-seed", actualIdx, tiles)
			}
		} else {
			deathIdx = await getDeathTileIndex(sessionId || "local-seed", actualIdx, tiles)
		}
		const isDeath = clickedTileIdx === deathIdx
		// setIsSession(true);
		

		// Mark the tile as clicked and show the result
		setClickedByRow(prev => ({ ...prev, [visualIdx]: true }))
		setClickedTileIndex(prev => ({ ...prev, [visualIdx]: clickedTileIdx }))
		
		// Store the death tile index for this row
		setDeathTiles(prev => ({ ...prev, [visualIdx]: deathIdx }))
		
		const rowMult = rows[actualIdx]?.multiplier ?? 1;
        await selectTile(actualIdx, clickedTileIdx, publicKey.toBase58(), isDeath, rowMult);
		// await selectTile(actualIdx, clickedTileIdx, walletAddress, isDeath);
		
		if(isDeath){
			endRound();
			isProcessingClickRef.current = false;
			return;
		}
		// move downward or finish at the bottom row
		if (activeRow <= 0) {
			endRound();
			// setIsSession(false);
			// setReplay(true);
			isProcessingClickRef.current = false;
		} else {
			// Move to next row after showing the result
			setTimeout(() => {
				setActiveRow(prev => prev - 1)
				isProcessingClickRef.current = false;
			}, 300);
		}
	}, [publicKey, isPlaying, activeRow, clickedByRow, sessionId, rows, selectTile, endRound, setSessionId]);



	const regenerateBoard = () => {
		setSpinner(true);
		
		setTimeout(() => {
			// Generate new board
			const numRows = 12 + Math.floor(Math.random() * 4);
			const startMultiplier = 1.10;
			const growthPerRow = 1.18;
			const generated: BoardRow[] = [];
			
			for (let i = 0; i < numRows; i++) {
				const tiles = 2 + Math.floor(Math.random() * 6);
				const multiplier = startMultiplier * Math.pow(growthPerRow, i);
				generated.push({ multiplier, tiles });
			}
			
			setRows(generated);
			setClickedByRow({});
			setClickedTileIndex({});
			setDeathTiles({});
			setActiveRow(Math.max(generated.length - 1, 0));
			setSpinner(false);
		}, 100); // Simulate loading time
	};


// Shuffle on Replay or any fresh start
	useEffect(()=>{
		if(Replay){
			// Generate new sessionId for fresh death tiles
			const newSessionId = crypto.randomUUID();
			setSessionId(newSessionId);
			
			// Regenerate board with new layout
			regenerateBoard();
			
			// Reset replay flag
			setReplay(false);
		}
	}, [Replay, setSessionId, setReplay]);

	// Shuffle board for any fresh start (Start Game, Play Demo, Replay)
	useEffect(() => {
		if(shuffleBoard) {
			// Generate new sessionId for fresh death tiles
			const newSessionId = crypto.randomUUID();
			setSessionId(newSessionId);
			
			// Regenerate board with new layout
			regenerateBoard();
			
			// Reset shuffle flag
			setShuffleBoard(false);
		}
	}, [shuffleBoard, setSessionId, setShuffleBoard]);


	return(
		
		<>

{
		spinner ? (
			<LoadingSpinner message="Loading Game State..." />
		) : (
<div className="px-4 py-10 mb-40">
	      <div className="flex flex-col gap-4">
		{visualRows.map((row, vIdx) => (
			<div key={vIdx} className="flex items-center gap-4 justify-center">
				<div className="text-gray-300 font-semibold tabular-nums select-none w-16 text-right">
					{formatMultiplier(row.multiplier)}
				</div>

				<div className={`flex items-center gap-3 rounded-2xl px-8 md:px-10 py-7 bg-[#0f172a]/90 border min-w-[700px] ${isPlaying && vIdx === activeRow ? 'border-emerald-500' : 'border-gray-800/60'}`}>
					<div className="flex items-center gap-3 justify-center w-full">
						{Array.from({ length: row.tiles }).map((_, idx) => {
							const actualTileIdx = idx; // Tile index for game logic
							const isVisible = true;
							
							const isDeathTile = deathTiles[vIdx] === actualTileIdx;
							const isClicked = clickedByRow[vIdx];
							const clickedTileIdx = clickedTileIndex[vIdx];
							
							// Determine tile color based on state
							let tileColor = "bg-gray-700 border-gray-700/60 hover:bg-white/10 cursor-pointer transition duration-300";
							if (isClicked && clickedTileIdx === actualTileIdx) {
								if (isDeathTile) {
									tileColor = "bg-red-600 border-red-500"; // Red for death tile
								} else {
									tileColor = "bg-green-500 border-green-500"; // Green for clicked safe tile
								}
							}
							
							return (
								<div key={idx} className="relative">
									<button
										type="button"
										disabled={!isPlaying || vIdx !== activeRow || !!clickedByRow[vIdx]}
										onClick={() => handleTileClick(vIdx, actualTileIdx)}
										className={`h-20 w-20 rounded-md transition-colors border ${tileColor} ${(!isPlaying || vIdx !== activeRow || clickedByRow[vIdx]) ? 'opacity-60 cursor-not-allowed hover:bg-gray-700' : 'hover:bg-gray-500'}`}
									/>
									{/* Show death tile image on top of the death tile */}
									{isDeathTile && isClicked && (
										<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
											<img 
												src={deathtile.src} 
												alt="Death tile" 
												className="w-16 h-16 rounded-full object-contain"
											/>
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>
			</div>
		))}
	</div>
</div>
		)
	}
		
		
		</>
	)
}
export default memo(TileBoard);