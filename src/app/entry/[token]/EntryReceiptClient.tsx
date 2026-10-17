"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/scoring";
import type { EntryReceiptView, GroupLabel } from "@/lib/types";

interface Props {
  entry: EntryReceiptView;
}

const GROUP_LABELS: GroupLabel[] = ["A", "B", "C", "D"];

export function EntryReceiptClient({ entry }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(entry.receiptCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {/* */}
  }

  const isScored = entry.scores !== undefined && entry.scores.length > 0;
  const isPerfect = entry.isPerfect && isScored;
  const hasWon = entry.prizeAmountPaise !== undefined && entry.prizeAmountPaise > 0;

  const submittedStr = new Date(entry.submittedAt).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="min-h-screen bg-obsidian-900 flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          {isPerfect ? (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 rounded-full bg-gold-500/20 border-2 border-gold-400/50 flex items-center justify-center text-4xl">
                  🏆
                </div>
              </div>
              <h1 className="font-playfair text-3xl font-bold text-gradient-gold mb-2">
                Perfect Score!
              </h1>
              {hasWon && (
                <p className="text-gold-300 font-semibold text-lg">
                  You won {formatPaise(entry.prizeAmountPaise!)}! 🎉
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 rounded-full bg-obsidian-800 border border-obsidian-700 flex items-center justify-center text-3xl">
                  🏸
                </div>
              </div>
              <h1 className="font-playfair text-3xl font-bold text-white mb-2">
                Your Entry
              </h1>
              <p className="text-white/40 text-sm">{entry.participantName}</p>
            </>
          )}
        </div>

        {/* Receipt card */}
        <div className="bg-obsidian-800 border border-gold-500/20 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <p className="text-white/40 text-xs uppercase tracking-widest">Receipt</p>
            <Badge variant={isScored ? "success" : "white"}>
              {isScored ? "Scored" : "Submitted"}
            </Badge>
          </div>

          {/* Receipt code */}
          <div className="bg-obsidian-900 rounded-xl p-4 mb-5 text-center">
            <p className="text-white/30 text-xs mb-1">Receipt Code</p>
            <button
              type="button"
              onClick={copyCode}
              className="text-gradient-gold font-playfair text-2xl font-bold tracking-[0.15em] hover:opacity-80 transition-opacity"
            >
              {entry.receiptCode}
            </button>
            <p className="text-white/20 text-xs mt-1">{copied ? "Copied!" : "Tap to copy"}</p>
          </div>

          {/* Predictions + scores */}
          <div className="space-y-2.5">
            {GROUP_LABELS.map((g) => {
              const pred  = entry.predictions.find((p) => p.groupLabel === g);
              const score = entry.scores?.find((s) => s.groupLabel === g);
              return (
                <div
                  key={g}
                  className={`flex items-center justify-between p-3 rounded-xl border ${
                    score?.score === 1
                      ? "bg-emerald-500/8 border-emerald-500/20"
                      : score?.score === 0
                      ? "bg-red-500/6 border-red-500/15"
                      : "bg-obsidian-700/50 border-obsidian-600"
                  }`}
                >
                  <div>
                    <p className="text-gold-400 text-xs font-semibold mb-0.5">Group {g}</p>
                    <p className="text-white text-sm">
                      {pred?.team1Name} · {pred?.team2Name}
                    </p>
                  </div>
                  {isScored && score && (
                    <div className="text-lg" aria-label={score.score === 1 ? "correct" : "wrong"}>
                      {score.score === 1 ? "✅" : "❌"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Score summary */}
          {isScored && (
            <div className="mt-4 pt-4 border-t border-obsidian-700 text-center">
              <p className="text-white/40 text-xs mb-1">Total Score</p>
              <p className={`text-3xl font-bold font-playfair ${
                isPerfect ? "text-gradient-gold" : "text-white"
              }`}>
                {entry.totalScore} / 4
              </p>
              {hasWon && (
                <p className="text-gold-300 font-semibold mt-1">
                  🏆 {formatPaise(entry.prizeAmountPaise!)} prize!
                </p>
              )}
            </div>
          )}

          {!isScored && (
            <p className="text-white/30 text-xs text-center mt-4">
              Results will appear here after the tournament.
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-white/20 border-t border-obsidian-700 pt-4 mt-4">
            <span>{entry.participantName}</span>
            <span>{submittedStr} IST</span>
          </div>
        </div>

        <Button
          variant="outline"
          size="md"
          className="w-full"
          onClick={() => window.location.href = "/predict"}
        >
          Back to Contest
        </Button>
      </div>
    </div>
  );
}
