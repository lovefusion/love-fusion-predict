"use client";

import { useState, useEffect, useCallback } from "react";
import { Spinner } from "@/components/ui/spinner";
import type { ContestPublicInfo } from "@/lib/types";
import { formatPaise } from "@/lib/scoring";

const REFRESH_INTERVAL_MS = 30_000;

interface LiveStats {
  totalEntries: number;
  entryCountByGroup: {
    A: number; B: number; C: number; D: number;
  };
  // Top predicted teams per group (by count, no PII)
  topTeamsByGroup: {
    groupLabel: string;
    teams: { name: string; pickCount: number; logoUrl?: string | null }[];
  }[];
}

export function LiveBroadcastClient() {
  const [contest, setContest]   = useState<ContestPublicInfo | null>(null);
  const [stats,   setStats]     = useState<LiveStats | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [loading, setLoading]   = useState(true);
  const [tick, setTick]         = useState(0); // trigger refresh

  const fetchData = useCallback(async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        fetch("/api/contest/active", { cache: "no-store" }),
        fetch("/api/admin/live-stats",  { cache: "no-store" }),
      ]);
      if (cRes.ok) setContest(await cRes.json());
      if (sRes.ok) setStats(await sRes.json());
      setLastRefreshed(new Date());
    } catch {
      // silently fail on network issues — display keeps last data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, tick]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="w-screen h-screen bg-obsidian-900 flex items-center justify-center">
        <Spinner className="h-12 w-12" />
      </div>
    );
  }

  return (
    // 16:9 canvas — fill the browser window
    <div
      className="w-screen h-screen bg-obsidian-900 overflow-hidden relative flex flex-col"
      style={{ fontFamily: "var(--font-inter), sans-serif" }}
    >
      {/* Background sparkle pattern */}
      <div className="absolute inset-0 sparkle-bg opacity-20 pointer-events-none" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-br from-gold-900/10 via-transparent to-obsidian-900 pointer-events-none" aria-hidden />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-12 py-6 border-b border-obsidian-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
            <span className="text-2xl">🏸</span>
          </div>
          <div>
            <p className="text-white/40 text-xs uppercase tracking-widest">Live</p>
            <h1 className="font-playfair text-2xl font-bold text-white">
              Love Fusion Badminton League
            </h1>
          </div>
        </div>

        <div className="text-right">
          <p className="text-white/30 text-xs">
            Jackpot Prize
          </p>
          <p className="text-gradient-gold font-playfair text-3xl font-bold">
            {contest ? formatPaise(contest.prizePoolPaise) : "₹11,000"}
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 px-12 py-8 flex flex-col gap-6">
        {/* Entry count */}
        <div className="flex items-center gap-8">
          <div className="bg-gold-500/10 border border-gold-400/20 rounded-2xl px-8 py-5 text-center min-w-[160px]">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Total Entries</p>
            <p className="text-gradient-gold font-playfair text-5xl font-bold">
              {stats?.totalEntries ?? "—"}
            </p>
          </div>
          {contest?.state === "open" && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-emerald-400 font-semibold">Entries Open</p>
            </div>
          )}
          {contest?.state === "closed" && (
            <p className="text-amber-400 font-semibold">Entries Closed · Awaiting Results</p>
          )}
        </div>

        {/* Top picks per group */}
        {stats?.topTeamsByGroup && (
          <div className="flex-1 grid grid-cols-4 gap-5">
            {stats.topTeamsByGroup.map((group) => (
              <div
                key={group.groupLabel}
                className="bg-obsidian-800/80 border border-obsidian-700 rounded-2xl p-5 flex flex-col"
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gold-500/20 border border-gold-400/20 flex items-center justify-center">
                    <span className="font-playfair font-bold text-gold-400 text-sm">
                      {group.groupLabel}
                    </span>
                  </div>
                  <p className="text-white/60 text-sm font-medium">
                    Group {group.groupLabel}
                  </p>
                </div>

                <div className="space-y-2.5 flex-1">
                  {group.teams.slice(0, 4).map((team, i) => (
                    <div key={team.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-white/30 text-xs w-4 flex-shrink-0">#{i + 1}</span>
                        <p className="text-white text-sm truncate font-medium">{team.name}</p>
                      </div>
                      <span className="text-gold-400 text-xs font-semibold flex-shrink-0">
                        {team.pickCount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!stats && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/20 text-lg">Waiting for entry data…</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex items-center justify-between px-12 py-4 border-t border-obsidian-800">
        <p className="text-white/20 text-xs">
          Vadodara · 24–25 October 2026 · Predict the Top 2
        </p>
        <p className="text-white/20 text-xs">
          Last refreshed:{" "}
          {lastRefreshed
            ? lastRefreshed.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: true })
            : "—"}
          {" "}IST
        </p>
      </footer>
    </div>
  );
}
