"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { GroupPredictionPanel } from "@/components/contest/GroupPredictionPanel";
import type {
  ContestPublicInfo,
  GroupLabel,
  EntrySubmissionPayload,
  EntrySubmissionResponse,
  ApiError,
} from "@/lib/types";
import { formatPaise } from "@/lib/scoring";

// ─── Step Types ────────────────────────────────────────────────────────────────

type Step = "landing" | "predict" | "details" | "done";

interface SelectionMap {
  A: [string | null, string | null];
  B: [string | null, string | null];
  C: [string | null, string | null];
  D: [string | null, string | null];
}

const GROUP_ORDER: GroupLabel[] = ["A", "B", "C", "D"];

// ─── Main Client Page ──────────────────────────────────────────────────────────

export function PredictClientPage() {
  const [step, setStep]           = useState<Step>("landing");
  const [contest, setContest]     = useState<ContestPublicInfo | null>(null);
  const [loading, setLoading]     = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [submitError, setSubmitError]   = useState<string | null>(null);
  const [receipt, setReceipt]     = useState<EntrySubmissionResponse | null>(null);

  const [selections, setSelections] = useState<SelectionMap>({
    A: [null, null],
    B: [null, null],
    C: [null, null],
    D: [null, null],
  });

  const [name,  setName]  = useState("");
  const [phone, setPhone] = useState("");
  const [nameError,  setNameError]  = useState("");
  const [phoneError, setPhoneError] = useState("");

  // ─── Fetch contest data ────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchContest() {
      try {
        const res = await fetch("/api/contest/active");
        if (!res.ok) {
          const err: ApiError = await res.json();
          setError(err.message ?? "Unable to load contest.");
          return;
        }
        const data: ContestPublicInfo = await res.json();
        setContest(data);
      } catch {
        setError("Network error. Please check your connection and refresh.");
      } finally {
        setLoading(false);
      }
    }
    fetchContest();
  }, []);

  // ─── Selection logic ───────────────────────────────────────────────────────

  const handleToggle = useCallback((group: GroupLabel, teamId: string) => {
    setSelections((prev) => {
      const [s1, s2] = prev[group];
      if (s1 === teamId) return { ...prev, [group]: [s2, null] };
      if (s2 === teamId) return { ...prev, [group]: [s1, null] };
      if (!s1)           return { ...prev, [group]: [teamId, null] };
      if (!s2)           return { ...prev, [group]: [s1, teamId] };
      return prev; // Both filled and neither matches → no-op
    });
  }, []);

  const allGroupsComplete = GROUP_ORDER.every(
    (g) => selections[g][0] !== null && selections[g][1] !== null,
  );

  const completedGroupCount = GROUP_ORDER.filter(
    (g) => selections[g][0] !== null && selections[g][1] !== null,
  ).length;

  // ─── Validation ───────────────────────────────────────────────────────────

  function validateDetails(): boolean {
    let valid = true;
    if (!name.trim() || name.trim().length < 2) {
      setNameError("Please enter your full name (at least 2 characters).");
      valid = false;
    } else {
      setNameError("");
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      setPhoneError("Enter a valid 10-digit Indian mobile number.");
      valid = false;
    } else {
      setPhoneError("");
    }
    return valid;
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!validateDetails() || !contest) return;
    setSubmitLoading(true);
    setSubmitError(null);

    const payload: EntrySubmissionPayload = {
      contestId: contest.id,
      participantName: name.trim(),
      participantPhone: phone.replace(/\D/g, ""),
      predictions: GROUP_ORDER.map((g) => ({
        groupLabel: g,
        teamId1: selections[g][0]!,
        teamId2: selections[g][1]!,
      })),
    };

    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: EntrySubmissionResponse | ApiError = await res.json();
      if (!res.ok || !("ok" in data) || !data.ok) {
        setSubmitError((data as ApiError).message ?? "Submission failed. Please try again.");
        return;
      }
      setReceipt(data as EntrySubmissionResponse);
      setStep("done");
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="h-10 w-10" />
          <p className="text-white/40 text-sm">Loading contest…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-obsidian-900 flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p className="text-4xl mb-4">⚠️</p>
          <h2 className="text-white font-semibold text-lg mb-2">Contest Unavailable</h2>
          <p className="text-white/50 text-sm mb-6">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!contest) return null;

  // Step: Landing
  if (step === "landing") {
    return <LandingStep contest={contest} onBegin={() => setStep("predict")} />;
  }

  // Step: Predictions
  if (step === "predict") {
    return (
      <PredictStep
        contest={contest}
        selections={selections}
        completedGroupCount={completedGroupCount}
        allGroupsComplete={allGroupsComplete}
        onToggle={handleToggle}
        onBack={() => setStep("landing")}
        onNext={() => setStep("details")}
      />
    );
  }

  // Step: Participant details
  if (step === "details") {
    return (
      <DetailsStep
        name={name}
        phone={phone}
        nameError={nameError}
        phoneError={phoneError}
        submitError={submitError}
        loading={submitLoading}
        onNameChange={setName}
        onPhoneChange={setPhone}
        onBack={() => { setStep("predict"); setSubmitError(null); }}
        onSubmit={handleSubmit}
        contest={contest}
        selections={selections}
      />
    );
  }

  // Step: Done / Receipt
  if (step === "done" && receipt) {
    return <ReceiptStep receipt={receipt} contest={contest} selections={selections} />;
  }

  return null;
}

// ─── Sub-screens ──────────────────────────────────────────────────────────────

function LandingStep({
  contest,
  onBegin,
}: {
  contest: ContestPublicInfo;
  onBegin: () => void;
}) {
  const prizeDisplay = formatPaise(contest.prizePoolPaise);
  const deadline = new Date(contest.entryDeadline).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="min-h-screen bg-obsidian-900 flex flex-col">
      {/* Hero */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-5 py-16 text-center overflow-hidden">
        {/* Background sparkle effect */}
        <div className="absolute inset-0 sparkle-bg opacity-30 pointer-events-none" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-obsidian-900/60 to-obsidian-900 pointer-events-none" aria-hidden />

        <div className="relative z-10 max-w-2xl mx-auto">
          {/* Logo mark */}
          <div className="mb-8 flex justify-center">
            <div className="w-24 h-24 rounded-full overflow-hidden shadow-gold-strong ring-2 ring-gold-400/30">
              <img
                src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/w_192,h_192,c_fill/love-fusion/logo`}
                alt="Love Fusion Cup"
                width={96}
                height={96}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <Badge variant="gold" className="mb-4 text-xs tracking-wide uppercase">
            🏆 Win {prizeDisplay}
          </Badge>

          <h1 className="font-playfair text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-4">
            <span className="text-gradient-white-gold">Love Fusion</span>
            <br />
            <span className="text-white">Badminton League</span>
          </h1>

          <p className="text-white/60 text-lg mb-2">
            Predict the Top 2 — Season 2
          </p>
          <p className="text-white/40 text-sm mb-10">
            Vadodara · 24–25 October 2026 · 16 Teams · 4 Groups
          </p>

          {/* Prize card */}
          <div className="bg-gold-500/8 border border-gold-400/20 rounded-2xl p-6 mb-8 text-left max-w-md mx-auto gold-shimmer">
            <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Jackpot Prize</p>
            <p className="text-gradient-gold font-playfair text-5xl font-bold">{prizeDisplay}</p>
            <p className="text-white/50 text-sm mt-2">
              Pick the top 2 teams in each of the 4 groups. Get all 8 picks right and win!
              Multiple winners share the prize equally.
              Get exactly 3 groups right and win a Love Fusion T-shirt.
            </p>
          </div>

          {/* How it works */}
          <div className="grid grid-cols-3 gap-4 mb-10 text-center">
            {[
              { icon: "🎯", label: "Pick 2 teams per group" },
              { icon: "✅", label: "Get all 4 groups right" },
              { icon: "💰", label: `Win ${prizeDisplay}` },
            ].map(({ icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <span className="text-2xl">{icon}</span>
                <p className="text-white/50 text-xs">{label}</p>
              </div>
            ))}
          </div>

          {contest.isOpen ? (
            <>
              <Button
                size="xl"
                onClick={onBegin}
                className="w-full max-w-xs mx-auto animate-pulse-gold"
              >
                Enter Predictions →
              </Button>
              <p className="text-white/30 text-xs mt-4">
                Entries close {deadline} IST
              </p>
            </>
          ) : contest.isDeadlinePassed ? (
            <div className="text-center">
              <Badge variant="error" className="text-sm px-4 py-1.5">
                Entries Closed
              </Badge>
              <p className="text-white/40 text-sm mt-3">
                The prediction window has closed. Check results soon!
              </p>
            </div>
          ) : (
            <div className="text-center">
              <Badge variant="warning" className="text-sm px-4 py-1.5">
                Opening Soon
              </Badge>
              <p className="text-white/40 text-sm mt-3">
                Predictions open before the tournament starts. Check back soon!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center border-t border-obsidian-800">
        <p className="text-white/20 text-xs">
          Love Fusion Cup · Mowgly Ventures · Vadodara
        </p>
      </footer>
    </div>
  );
}

function PredictStep({
  contest,
  selections,
  completedGroupCount,
  allGroupsComplete,
  onToggle,
  onBack,
  onNext,
}: {
  contest: ContestPublicInfo;
  selections: SelectionMap;
  completedGroupCount: number;
  allGroupsComplete: boolean;
  onToggle: (group: GroupLabel, teamId: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="min-h-screen bg-obsidian-900 flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-50 bg-glass-dark border-b border-obsidian-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-white/40 hover:text-white text-sm flex items-center gap-1.5 transition-colors"
          >
            ← Back
          </button>

          <div className="flex-1 text-center">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">
              Pick your qualifiers
            </p>
            <div className="flex items-center justify-center gap-1.5">
              {GROUP_ORDER.map((g) => (
                <div
                  key={g}
                  className={`w-6 h-1.5 rounded-full transition-all duration-300 ${
                    selections[g][0] && selections[g][1]
                      ? "bg-gold-400"
                      : "bg-obsidian-600"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-white/30 mt-1">
              {completedGroupCount}/4 groups done
            </p>
          </div>

          <Button
            size="sm"
            onClick={onNext}
            disabled={!allGroupsComplete}
            className={allGroupsComplete ? "" : "opacity-30"}
          >
            Next →
          </Button>
        </div>
      </header>

      {/* Group panels */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-5">
        <div className="text-center mb-2">
          <h2 className="font-playfair text-2xl font-semibold text-white mb-1">
            Choose Your Top 2
          </h2>
          <p className="text-white/40 text-sm">
            For each group, pick the 2 teams you think will qualify.
          </p>
        </div>

        {GROUP_ORDER.map((g) => {
          const groupData = contest.groups.find((gr) => gr.label === g);
          if (!groupData) return null;
          return (
            <GroupPredictionPanel
              key={g}
              groupLabel={g}
              teams={groupData.teams}
              selection={selections[g]}
              onToggle={(teamId) => onToggle(g, teamId)}
              isComplete={!!(selections[g][0] && selections[g][1])}
            />
          );
        })}

        {/* Bottom CTA */}
        <div className="sticky bottom-4 pt-4">
          <Button
            size="lg"
            onClick={onNext}
            disabled={!allGroupsComplete}
            className="w-full"
          >
            {allGroupsComplete
              ? "Continue to Submit →"
              : `Complete ${4 - completedGroupCount} more group${4 - completedGroupCount !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </main>
    </div>
  );
}

function DetailsStep({
  name,
  phone,
  nameError,
  phoneError,
  submitError,
  loading,
  onNameChange,
  onPhoneChange,
  onBack,
  onSubmit,
  contest,
  selections,
}: {
  name: string;
  phone: string;
  nameError: string;
  phoneError: string;
  submitError: string | null;
  loading: boolean;
  onNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  contest: ContestPublicInfo;
  selections: SelectionMap;
}) {
  return (
    <div className="min-h-screen bg-obsidian-900 flex flex-col">
      <header className="sticky top-0 z-50 bg-glass-dark border-b border-obsidian-800 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="text-white/40 hover:text-white text-sm flex items-center gap-1.5 transition-colors"
          >
            ← Edit predictions
          </button>
          <p className="text-white/50 text-sm font-medium">Almost there!</p>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-5 py-8">
        {/* Prediction summary */}
        <div className="bg-obsidian-800 border border-obsidian-700 rounded-2xl p-5 mb-8">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-3">
            Your predictions
          </p>
          <div className="grid grid-cols-2 gap-3">
            {GROUP_ORDER.map((g) => {
              const g1 = contest.groups.find((gr) => gr.label === g);
              const [t1id, t2id] = selections[g];
              const t1 = g1?.teams.find((t) => t.id === t1id);
              const t2 = g1?.teams.find((t) => t.id === t2id);
              return (
                <div key={g} className="flex flex-col gap-1">
                  <p className="text-gold-400 text-xs font-semibold">Group {g}</p>
                  <p className="text-white text-xs truncate">{t1?.name ?? "—"}</p>
                  <p className="text-white text-xs truncate">{t2?.name ?? "—"}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Details form */}
        <h2 className="font-playfair text-2xl font-semibold text-white mb-1">
          Your Details
        </h2>
        <p className="text-white/40 text-sm mb-6">
          We&apos;ll use these to contact you if you win. No spam.
        </p>

        <div className="space-y-5">
          <Input
            label="Full Name"
            placeholder="Priya Patel"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            error={nameError}
            autoComplete="name"
            required
          />
          <Input
            label="Mobile Number"
            placeholder="9876543210"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
            error={phoneError}
            inputMode="tel"
            autoComplete="tel"
            required
            hint="10-digit Indian mobile number, no country code"
          />
        </div>

        {submitError && (
          <div className="mt-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
            {submitError}
          </div>
        )}

        <div className="mt-8 space-y-3">
          <Button
            size="lg"
            onClick={onSubmit}
            loading={loading}
            className="w-full"
          >
            Submit Prediction 🏸
          </Button>
          <p className="text-center text-white/25 text-xs">
            By submitting, you confirm your picks are final.
          </p>
        </div>
      </main>
    </div>
  );
}

function ReceiptStep({
  receipt,
  contest,
  selections,
}: {
  receipt: EntrySubmissionResponse;
  contest: ContestPublicInfo;
  selections: SelectionMap;
}) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(receipt.receiptCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked */
    }
  }

  const submittedStr = new Date(receipt.submittedAt).toLocaleString("en-IN", {
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
        {/* Success icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gold-500/15 border-2 border-gold-400/40 flex items-center justify-center">
            <svg className="w-10 h-10 text-gold-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        <h1 className="font-playfair text-3xl font-bold text-center text-white mb-2">
          You&apos;re in! 🏸
        </h1>
        <p className="text-center text-white/50 text-sm mb-8">
          Good luck, {receipt.participantName.split(" ")[0]}!
        </p>

        {/* Receipt card */}
        <div className="bg-obsidian-800 border border-gold-500/20 rounded-2xl p-6 mb-6 gold-shimmer">
          <div className="flex items-center justify-between mb-5">
            <p className="text-white/40 text-xs uppercase tracking-widest">Receipt</p>
            <Badge variant="success">Confirmed</Badge>
          </div>

          {/* Receipt code */}
          <div className="bg-obsidian-900 rounded-xl p-4 mb-5 text-center">
            <p className="text-white/30 text-xs mb-1">Your Receipt Code</p>
            <button
              type="button"
              onClick={copyCode}
              className="text-gradient-gold font-playfair text-2xl font-bold tracking-[0.15em] hover:opacity-80 transition-opacity"
              title="Click to copy"
            >
              {receipt.receiptCode}
            </button>
            {copied && (
              <p className="text-emerald-400 text-xs mt-1">Copied!</p>
            )}
            {!copied && (
              <p className="text-white/20 text-xs mt-1">Tap to copy</p>
            )}
          </div>

          {/* Predictions summary */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {GROUP_ORDER.map((g) => {
              const groupData = contest.groups.find((gr) => gr.label === g);
              const [t1id, t2id] = selections[g];
              const t1 = groupData?.teams.find((t) => t.id === t1id);
              const t2 = groupData?.teams.find((t) => t.id === t2id);
              return (
                <div key={g} className="bg-obsidian-700/50 rounded-xl p-3">
                  <p className="text-gold-400 text-xs font-semibold mb-1.5">Group {g}</p>
                  <p className="text-white text-xs leading-relaxed">
                    {t1?.name ?? "—"}<br />{t2?.name ?? "—"}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-white/30 border-t border-obsidian-700 pt-4">
            <span>{receipt.participantName}</span>
            <span>{submittedStr} IST</span>
          </div>
        </div>

        {/* Save reminder */}
        <div className="bg-gold-500/6 border border-gold-400/15 rounded-xl p-4 text-center mb-6">
          <p className="text-gold-300/80 text-sm">
            📸 Screenshot this page to save your receipt code.
          </p>
          <p className="text-white/30 text-xs mt-1">
            Results announced after the tournament on 25 October 2026.
          </p>
        </div>

        <Button
          variant="outline"
          size="md"
          className="w-full"
          onClick={() => window.location.href = "/predict"}
        >
          Submit Another Entry
        </Button>
      </div>
    </div>
  );
}
