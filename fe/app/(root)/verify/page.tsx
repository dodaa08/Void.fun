"use client"

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getSession } from "@/app/services/api";

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getDeathTileIndex(serverSeed: string, rowIdx: number, tiles: number) {
  const h = await sha256Hex(`${serverSeed}-row${rowIdx}`);
  const n = parseInt(h.slice(8, 16), 16);
  return tiles > 0 ? ((n % tiles) + 1) % tiles : 0;
}

function VerifyContent() {
  const params = useSearchParams();
  const sessionId = params.get("sessionId") || "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<null | {
    sessionId: string;
    serverCommit: string;
    serverSeed: string;
    boardLayout: number[];
    deathTiles: number[];
    verified: boolean;
    mismatches: number[];
  }>(null);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getSession(sessionId);
        const data = res?.data ?? res;

        if (!data?.roundEnded) {
          setError("Finish round to verify.");
          setLoading(false);
          return;
        }

        const serverSeed = data.serverSeed as string;
        const serverCommit = data.serverCommit as string;
        const boardLayout = (data.boardLayout || []) as number[];
        const deathTiles = (data.deathTiles || []) as number[];

        if (!serverSeed || !serverCommit || boardLayout.length === 0) {
          setError("Incomplete session data.");
          setLoading(false);
          return;
        }

        const commitCheck = await sha256Hex(serverSeed);
        const commitMatches = commitCheck === serverCommit;

        const recomputed: number[] = [];
        for (let row = 0; row < boardLayout.length; row++) {
          const tiles = boardLayout[row];
          const d = await getDeathTileIndex(serverSeed, row, tiles);
          recomputed.push(d);
        }

        const mismatches: number[] = [];
        if (Array.isArray(deathTiles) && deathTiles.length === recomputed.length) {
          for (let i = 0; i < recomputed.length; i++) {
            if (Number(deathTiles[i]) !== Number(recomputed[i])) mismatches.push(i);
          }
        }

        setResult({
          sessionId,
          serverCommit,
          serverSeed,
          boardLayout,
          deathTiles: recomputed,
          verified: commitMatches && mismatches.length === 0,
          mismatches,
        });
      } catch (e: any) {
        setError(e?.message || "Failed to verify session.");
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-xl font-semibold text-white">Verify Session</h1>

      <div className="mt-4">
        <label className="text-sm text-gray-400">Session ID</label>
        <div className="mt-1">
          <input
            defaultValue={sessionId}
            className="w-full bg-[#0f172a] border border-gray-700 rounded px-3 py-2 text-white"
            readOnly
          />
        </div>
      </div>

      {loading && (
        <div className="mt-6 text-gray-300">Verifying...</div>
      )}

      {error && (
        <div className="mt-6 text-red-400">{error}</div>
      )}

      {result && (
        <div className="mt-6 space-y-3 text-gray-200">
          <div>Commit: <span className="font-mono">{result.serverCommit}</span></div>
          <div>Server Seed: <span className="font-mono">{result.serverSeed}</span></div>
          <div>Rows: {result.boardLayout.length}</div>
          <div>Status: {result.verified ? "Verified" : "Failed"}</div>
          {!result.verified && result.mismatches.length > 0 && (
            <div>Mismatches at rows: {result.mismatches.map(i => i + 1).join(", ")}</div>
          )}

          <div className="mt-6">
            <div className="text-sm text-gray-400 mb-2">Death tiles (0-based index)</div>
            <div className="overflow-x-auto border border-gray-800 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-[#0f172a] text-gray-400">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Row</th>
                    <th className="px-3 py-2 text-left font-medium">Tiles</th>
                    <th className="px-3 py-2 text-left font-medium">Death Index</th>
                  </tr>
                </thead>
                <tbody>
                  {result.boardLayout.map((tiles, row) => (
                    <tr key={row} className="odd:bg-[#0b1324] even:bg-[#0d1426] text-gray-200">
                      <td className="px-3 py-2 font-mono">{row}</td>
                      <td className="px-3 py-2">{tiles}</td>
                      <td className="px-3 py-2 font-mono">{result.deathTiles[row]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto px-4 py-10"><div className="text-gray-300">Loading...</div></div>}>
      <VerifyContent />
    </Suspense>
  );
}


