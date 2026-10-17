"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  Trophy,
  Users,
  ClipboardList,
  Zap,
  ChevronRight,
  Check,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  Crown,
  FileText,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import type { ContestPublicInfo } from "@/lib/types";

type AdminTab =
  | "overview"
  | "entries"
  | "results"
  | "scoring"
  | "prizes"
  | "audit";

// ─── Auth Gate ──────────────────────────────────────────────────────────────

function AuthGate({ onAuth }: { onAuth: (key: string) => void }) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setLoading(true);
    setError("");

    // Verify key by fetching a protected endpoint
    try {
      const res = await fetch(
        `/api/admin/live-stats?contestId=verify`,
        { headers: { Authorization: `Bearer ${key}` } }
      );
      // A 404 is fine (contest not found) — 401 means bad key
      if (res.status === 401) {
        setError("Invalid admin key. Check your credentials.");
      } else {
        onAuth(key);
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-obsidian-900 sparkle-bg">
      <div className="w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gold-400/10 border border-gold-400/30 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-gold-400" />
          </div>
          <h1 className="font-playfair text-3xl font-bold text-white mb-2">
            Admin Access
          </h1>
          <p className="text-white/60 text-sm">
            Love Fusion Badminton League — Season 2
          </p>
        </div>

        <Card glow>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Input
                  type={show ? "text" : "password"}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Enter admin key"
                  label="Admin Key"
                  error={error}
                  autoComplete="current-password"
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-9 text-white/40 hover:text-white/70 transition-colors"
                >
                  {show ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              <Button
                type="submit"
                variant="gold"
                size="lg"
                loading={loading}
                className="w-full"
                disabled={!key.trim()}
              >
                <Lock className="w-4 h-4 mr-2" />
                Access Dashboard
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-white/30 text-xs mt-4">
          Admin keys are set in Netlify environment variables.
          <br />
          Never share your key.
        </p>
      </div>
    </div>
  );
}

// ─── State Badge ─────────────────────────────────────────────────────────────

const STATE_COLORS: Record<string, string> = {
  draft: "bg-obsidian-500 text-white/70",
  ready_for_review: "bg-blue-900/60 text-blue-300",
  published_not_open: "bg-purple-900/60 text-purple-300",
  open: "bg-emerald-900/60 text-emerald-300 border border-emerald-500/40",
  closed: "bg-orange-900/60 text-orange-300",
  results_provisional: "bg-yellow-900/60 text-yellow-300",
  results_verified: "bg-cyan-900/60 text-cyan-300",
  scored: "bg-gold-400/20 text-gold-300 border border-gold-400/30",
  finalized: "bg-gold-400/30 text-gold-200 border border-gold-400/40",
  results_published: "bg-gold-500/40 text-gold-100",
  archived: "bg-obsidian-600 text-white/50",
};

function StateBadge({ state }: { state: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        STATE_COLORS[state] ?? "bg-obsidian-500 text-white/70"
      )}
    >
      {state.replace(/_/g, " ")}
    </span>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  contest,
  adminKey,
  onRefresh,
  entryCount,
}: {
  contest: ContestPublicInfo | null;
  adminKey: string;
  onRefresh: () => void;
  entryCount: number;
}) {
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Allowed next states UI labels
  const TRANSITIONS: Record<string, { to: string; label: string; color: string }[]> = {
    draft: [{ to: "ready_for_review", label: "Mark Ready for Review", color: "outline" }],
    ready_for_review: [
      { to: "published_not_open", label: "Publish (Not Yet Open)", color: "outline" },
      { to: "draft", label: "Revert to Draft", color: "ghost" },
    ],
    published_not_open: [
      { to: "open", label: "🟢 Open for Entries", color: "gold" },
      { to: "draft", label: "Revert to Draft", color: "ghost" },
    ],
    open: [{ to: "closed", label: "⛔ Close Entries", color: "danger" }],
    closed: [],
    results_provisional: [],
    results_verified: [],
    scored: [{ to: "finalized", label: "✅ Finalize Results", color: "gold" }],
    finalized: [{ to: "results_published", label: "📣 Publish Results", color: "gold" }],
    results_published: [{ to: "archived", label: "Archive Contest", color: "ghost" }],
    archived: [],
  };

  async function transition(to: string) {
    if (!contest) return;
    setTransitioning(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(
        `/api/admin/contest/${contest.id}/state`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminKey}`,
          },
          body: JSON.stringify({ to, operatorName: "admin" }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Transition failed");
      } else {
        setSuccess(`Moved to: ${to.replace(/_/g, " ")}`);
        setTimeout(() => {
          setSuccess("");
          onRefresh();
        }, 1500);
      }
    } catch {
      setError("Network error");
    } finally {
      setTransitioning(false);
    }
  }

  const allowedTransitions = TRANSITIONS[contest?.state ?? ""] ?? [];

  return (
    <div className="space-y-6">
      {/* Contest status card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-gold-400" />
            Contest Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!contest ? (
            <p className="text-white/50">No active contest found.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-white/70">State</span>
                <StateBadge state={contest.state} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/70">Contest</span>
                <span className="text-white text-sm font-medium">
                  {contest.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/70">Deadline</span>
                <span className="text-white text-sm">
                  {con   {contest.deadline ? formatDate(contest.deadline) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/70">Total Entries</span>
                <span className="text-2xl font-bold text-gold-400">
                  {entryCount}
                </span>
              </div>

              {/* State transition actions */}
              {allowedTransitions.length > 0 && (
                <div className="pt-4 border-t border-white/10 space-y-2">
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-3">
                    Available Actions
                  </p>
                  {allowedTransitions.map((t) => (
                    <Button
                      key={t.to}
                      variant={t.color as "gold" | "outline" | "ghost" | "danger"}
                      size="md"
                      loading={transitioning}
                      onClick={() => transition(t.to)}
                      className="w-full justify-start"
                    >
                      <ArrowRight className="w-4 h-4 mr-2 flex-shrink-0" />
                      {t.label}
                    </Button>
                  ))}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 p-3 rounded-lg border border-red-500/20">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-900/20 p-3 rounded-lg border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  {success}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-4 h-4 text-gold-400" />
              <span className="text-white/60 text-sm">Entries</span>
            </div>
            <p className="text-3xl font-bold text-white">{entryCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="w-4 h-4 text-gold-400" />
              <span className="text-white/60 text-sm">Prize Pool</span>
            </div>
            <p className="text-xl font-bold text-gold-400">₹11,000</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Entries Tab ─────────────────────────────────────────────────────────────

function EntriesTab({
  contestId,
  adminKey,
}: {
  contestId: string;
  adminKey: string;
}) {
  const [entries, setEntries] = useState<
    Array<{
      entryId: string;
      receiptCode: string;
      submittedAt: string;
      participantName: string;
      participantPhoneMasked: string;
      predictionCount: number;
    }>
  >([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/admin/entries?contestId=${contestId}&page=${p}&limit=20`,
          { headers: { Authorization: `Bearer ${adminKey}` } }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Failed to load entries");
        setEntries(data.entries ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
        setPage(p);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading entries");
      } finally {
        setLoading(false);
      }
    },
    [contestId, adminKey]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">
          {total} Total Entries
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => load(page)}
          disabled={loading}
        >
          <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg border border-red-500/20">
          {error}
        </div>
      )}

      {loading && entries.length === 0 ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-obsidian-700/50 border-b border-white/10">
                  <th className="text-left px-4 py-3 text-white/50 font-medium">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium hidden sm:table-cell">
                    Phone (masked)
                  </th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium hidden md:table-cell">
                    Receipt Code
                  </th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium hidden lg:table-cell">
                    Submitted
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr
                    key={entry.entryId}
                    className={cn(
                      "border-b border-white/5 hover:bg-white/5 transition-colors",
                      i % 2 === 0 ? "bg-obsidian-800/30" : "bg-transparent"
                    )}
                  >
                    <td className="px-4 py-3 text-white font-medium">
                      {entry.participantName}
                    </td>
                    <td className="px-4 py-3 text-white/50 font-mono hidden sm:table-cell">
                      {entry.participantPhoneMasked}
                    </td>
                    <td className="px-4 py-3 font-mono text-gold-400 text-xs hidden md:table-cell">
                      {entry.receiptCode}
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs hidden lg:table-cell">
                      {formatDate(entry.submittedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => load(page - 1)}
              >
                ← Prev
              </Button>
              <span className="text-white/50 text-sm">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => load(page + 1)}
              >
                Next →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Organizer dropdown (shared by Results + Scoring tabs) ──────────────────

type OrganizerOption = { id: string; displayName: string };

function useOrganizers(adminKey: string) {
  const [organizers, setOrganizers] = useState<OrganizerOption[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  useEffect(() => {
    setLoadingOrgs(true);
    fetch("/api/admin/organizers", {
      headers: { Authorization: `Bearer ${adminKey}` },
    })
      .then((r) => r.json())
      .then((d) => setOrganizers(d.organizers ?? []))
      .catch(() => {})
      .finally(() => setLoadingOrgs(false));
  }, [adminKey]);

  return { organizers, loadingOrgs };
}

function OrganizerSelect({
  label,
  value,
  onChange,
  organizers,
  loading,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  organizers: OrganizerOption[];
  loading: boolean;
}) {
  return (
    <div>
      <label className="block text-white/70 text-sm font-medium mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className={cn(
          "w-full bg-obsidian-700 text-white border border-white/10 rounded-lg px-3 py-2.5 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-gold-400/50",
          value ? "border-gold-400/30" : "border-white/10",
          loading && "opacity-50 cursor-wait"
        )}
      >
        <option value="">
          {loading ? "Loading organizers…" : "— Select operator —"}
        </option>
        {organizers.map((o) => (
          <option key={o.id} value={o.id}>
            {o.displayName}
          </option>
        ))}
      </select>
      <p className="text-white/40 text-xs mt-1">
        Must be an active organizer account — recorded in the audit log
      </p>
    </div>
  );
}

// ─── Results Entry Tab (Two-Person Verification) ─────────────────────────────

type QualifierInput = { teamId1: string; teamId2: string };

function ResultsTab({
  contest,
  adminKey,
  onRefresh,
}: {
  contest: ContestPublicInfo | null;
  adminKey: string;
  onRefresh: () => void;
}) {
  const { organizers, loadingOrgs } = useOrganizers(adminKey);
  const [operatorId, setOperatorId] = useState("");
  const [qualifiers, setQualifiers] = useState<
    Record<"A" | "B" | "C" | "D", QualifierInput>
  >({
    A: { teamId1: "", teamId2: "" },
    B: { teamId1: "", teamId2: "" },
    C: { teamId1: "", teamId2: "" },
    D: { teamId1: "", teamId2: "" },
  });
  const [action, setAction] = useState<"enter" | "verify">("enter");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!contest) {
    return (
      <p className="text-white/50 py-4">No active contest found.</p>
    );
  }

  const canEnter =
    contest.state === "closed" || contest.state === "results_provisional";
  const isProvisional = contest.state === "results_provisional";

  // Get teams per group from contest data
  const getGroupTeams = (groupLabel: string) =>
    contest.groups?.find((g) => g.label === groupLabel)?.teams ?? [];

  const operatorName =
    organizers.find((o) => o.id === operatorId)?.displayName ?? "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!operatorId) {
      setError("Select an operator from the dropdown.");
      return;
    }

    // Validate all groups filled
    for (const g of ["A", "B", "C", "D"] as const) {
      if (!qualifiers[g].teamId1 || !qualifiers[g].teamId2) {
        setError(`Select both qualifiers for Group ${g}`);
        return;
      }
      if (qualifiers[g].teamId1 === qualifiers[g].teamId2) {
        setError(`Group ${g}: the two qualifiers must be different teams`);
        return;
      }
    }

    setLoading(true);
    setError("");
    setSuccess("");

    const payload = {
      contestId: contest.id,
      action,
      operatorId,
      qualifiers: (["A", "B", "C", "D"] as const).map((g) => ({
        groupLabel: g,
        qualifier1Id: qualifiers[g].teamId1,
        qualifier2Id: qualifiers[g].teamId2,
      })),
    };

    try {
      const res = await fetch("/api/admin/results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Failed to submit results");
      } else {
        setSuccess(
          action === "enter"
            ? `Results entered by ${operatorName}. Now have a second person verify.`
            : `Results verified by ${operatorName}. Contest moved to results_verified!`
        );
        setTimeout(onRefresh, 2000);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gold-400/10 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-gold-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-1">
                Two-Person Verification Required
              </p>
              <p className="text-white/60 text-sm leading-relaxed">
                Official qualifiers must be{" "}
                <strong className="text-white">entered</strong> by one
                organizer and <strong className="text-white">verified</strong>{" "}
                by a second person. The verifier must be a different person.
              </p>
              <div className="mt-3 flex gap-3">
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      contest.state === "results_provisional" ||
                        contest.state === "results_verified"
                        ? "bg-emerald-400"
                        : "bg-white/20"
                    )}
                  />
                  <span className="text-xs text-white/50">Step 1: Enter</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      contest.state === "results_verified"
                        ? "bg-emerald-400"
                        : "bg-white/20"
                    )}
                  />
                  <span className="text-xs text-white/50">Step 2: Verify</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!canEnter ? (
        <div className="text-center py-8">
          <AlertCircle className="w-8 h-8 text-white/30 mx-auto mb-3" />
          <p className="text-white/50 text-sm">
            Results can only be entered when the contest is{" "}
            <strong className="text-white">closed</strong>. Current state:{" "}
            <StateBadge state={contest.state} />
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-6">
          {/* Action selector */}
          {isProvisional && (
            <div className="flex gap-2 p-1 bg-obsidian-700/50 rounded-xl border border-white/10">
              {(["enter", "verify"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAction(a)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                    action === a
                      ? "bg-gold-400 text-obsidian-900"
                      : "text-white/60 hover:text-white"
                  )}
                >
                  {a === "enter" ? "Re-Enter Results" : "Verify Results"}
                </button>
              ))}
            </div>
          )}

          {/* Operator selector */}
          <OrganizerSelect
            label={
              action === "enter"
                ? "Entering Operator"
                : "Verifying Operator (must differ from who entered)"
            }
            value={operatorId}
            onChange={setOperatorId}
            organizers={organizers}
            loading={loadingOrgs}
          />

          {/* Group qualifiers */}
          {(["A", "B", "C", "D"] as const).map((g) => {
            const groupTeams = getGroupTeams(g);
            const colors = {
              A: "border-gold-400/30 bg-gold-400/5",
              B: "border-blue-400/30 bg-blue-400/5",
              C: "border-emerald-400/30 bg-emerald-400/5",
              D: "border-purple-400/30 bg-purple-400/5",
            };
            const labelColors = {
              A: "text-gold-400",
              B: "text-blue-400",
              C: "text-emerald-400",
              D: "text-purple-400",
            };

            return (
              <div
                key={g}
                className={cn(
                  "rounded-xl border p-4 space-y-3",
                  colors[g]
                )}
              >
                <p
                  className={cn(
                    "font-playfair font-bold text-sm uppercase tracking-wider",
                    labelColors[g]
                  )}
                >
                  Group {g} — Select 2 Qualifiers
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {(["teamId1", "teamId2"] as const).map((field, fi) => (
                    <div key={field}>
                      <label className="block text-white/50 text-xs mb-1">
                        Qualifier {fi + 1}
                      </label>
                      <select
                        value={qualifiers[g][field]}
                        onChange={(e) =>
                          setQualifiers((prev) => ({
                            ...prev,
                            [g]: { ...prev[g], [field]: e.target.value },
                          }))
                        }
                        className={cn(
                          "w-full bg-obsidian-700 text-white border rounded-lg px-3 py-2 text-sm",
                          "focus:outline-none focus:ring-2 focus:ring-gold-400/50",
                          qualifiers[g][field]
                            ? "border-gold-400/30"
                            : "border-white/10"
                        )}
                      >
                        <option value="">— Select team —</option>
                        {groupTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 p-3 rounded-lg border border-red-500/20">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-900/20 p-3 rounded-lg border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              {success}
            </div>
          )}

          <Button
            type="submit"
            variant="gold"
            size="lg"
            loading={loading}
            className="w-full"
          >
            {action === "enter" ? (
              <>
                <ClipboardList className="w-4 h-4 mr-2" />
                Submit Results
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Verify Results
              </>
            )}
          </Button>
        </form>
      )}
    </div>
  );
}

// ─── Scoring Tab ─────────────────────────────────────────────────────────────

function ScoringTab({
  contest,
  adminKey,
  onRefresh,
}: {
  contest: ContestPublicInfo | null;
  adminKey: string;
  onRefresh: () => void;
}) {
  const { organizers, loadingOrgs } = useOrganizers(adminKey);
  const [operatorId, setOperatorId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    totalEntries: number;
    winnerCount: number;
    newState: string;
  } | null>(null);

  if (!contest) return <p className="text-white/50 py-4">No active contest.</p>;

  const canScore = contest.state === "results_verified";
  const alreadyScored = ["scored", "finalized", "results_published", "archived"].includes(
    contest.state
  );

  async function triggerScoring() {
    if (!confirmed || !operatorId) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({
          contestId: contest!.id,
          operatorId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Scoring failed");
      } else {
        setResult(data);
        setTimeout(onRefresh, 2000);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {alreadyScored ? (
        <Card>
          <CardContent className="pt-5 text-center py-8">
            <Trophy className="w-12 h-12 text-gold-400 mx-auto mb-3" />
            <p className="text-white font-semibold text-lg mb-2">
              Contest has been scored!
            </p>
            <StateBadge state={contest.state} />
            <p className="text-white/50 text-sm mt-3">
              Check the Prizes tab to see winner allocations.
            </p>
          </CardContent>
        </Card>
      ) : !canScore ? (
        <div className="text-center py-8">
          <AlertCircle className="w-8 h-8 text-white/30 mx-auto mb-3" />
          <p className="text-white/50 text-sm">
            Scoring is only available after results are verified. Current:{" "}
            <StateBadge state={contest.state} />
          </p>
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="pt-5">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gold-400/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap className="w-4 h-4 text-gold-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm mb-1">
                    Ready to Score
                  </p>
                  <p className="text-white/60 text-sm leading-relaxed">
                    This will score all entries against the verified qualifiers,
                    calculate prize allocations, and move the contest to{" "}
                    <strong className="text-white">scored</strong>. This
                    operation is reversible only by re-scoring.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <OrganizerSelect
            label="Scoring Operator"
            value={operatorId}
            onChange={setOperatorId}
            organizers={organizers}
            loading={loadingOrgs}
          />

          <label className="flex items-start gap-3 cursor-pointer group">
            <div
              onClick={() => setConfirmed(!confirmed)}
              className={cn(
                "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all",
                confirmed
                  ? "bg-gold-400 border-gold-400"
                  : "border-white/20 group-hover:border-gold-400/50"
              )}
            >
              {confirmed && <Check className="w-3 h-3 text-obsidian-900" />}
            </div>
            <span className="text-white/70 text-sm leading-relaxed">
              I confirm that the official qualifiers are correct and I want to
              trigger scoring for all entries.
            </span>
          </label>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 p-3 rounded-lg border border-red-500/20">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-5 h-5" />
                Scoring Complete!
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">
                    {result.totalEntries}
                  </p>
                  <p className="text-white/50 text-xs">Entries Scored</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gold-400">
                    {result.winnerCount}
                  </p>
                  <p className="text-white/50 text-xs">Winners</p>
                </div>
              </div>
            </div>
          )}

          <Button
            variant="gold"
            size="lg"
            className="w-full"
            loading={loading}
            disabled={!confirmed || !operatorId}
            onClick={triggerScoring}
          >
            <Zap className="w-4 h-4 mr-2" />
            Run Scoring Engine
          </Button>
        </>
      )}
    </div>
  );
}

// ─── Prizes Tab ───────────────────────────────────────────────────────────────

function PrizesTab({
  contest,
  adminKey,
}: {
  contest: ContestPublicInfo | null;
  adminKey: string;
}) {
  const [data, setData] = useState<{
    prizePoolFormatted: string;
    totalAllocatedFormatted: string;
    winnerCount: number;
    winners: Array<{
      entryId: string;
      receiptCode: string;
      participantName: string;
      participantPhoneMasked: string;
      amountFormatted: string;
      submittedAt: string;
      allocatedAt: string;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!contest) return;
    const scoredStates = ["scored", "finalized", "results_published", "archived"];
    if (!scoredStates.includes(contest.state)) return;

    setLoading(true);
    fetch(`/api/admin/prizes?contestId=${contest.id}`, {
      headers: { Authorization: `Bearer ${adminKey}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.winners) setData(d);
        else setError(d.message ?? "Error loading prizes");
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [contest, adminKey]);

  if (!contest)
    return <p className="text-white/50 py-4">No active contest.</p>;

  const scoredStates = ["scored", "finalized", "results_published", "archived"];
  if (!scoredStates.includes(contest.state)) {
    return (
      <div className="text-center py-8">
        <Crown className="w-8 h-8 text-white/20 mx-auto mb-3" />
        <p className="text-white/50 text-sm">
          Prize allocations will appear here after scoring. Current state:{" "}
          <StateBadge state={contest.state} />
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm bg-red-900/20 p-4 rounded-lg border border-red-500/20">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Prize summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-xl font-bold text-gold-400">
              {data.prizePoolFormatted}
            </p>
            <p className="text-white/50 text-xs mt-1">Prize Pool</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-xl font-bold text-white">{data.winnerCount}</p>
            <p className="text-white/50 text-xs mt-1">Winners</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-xl font-bold text-gold-300">
              {data.totalAllocatedFormatted}
            </p>
            <p className="text-white/50 text-xs mt-1">Allocated</p>
          </CardContent>
        </Card>
      </div>

      {data.winnerCount === 0 ? (
        <div className="text-center py-8">
          <Trophy className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/50">No 4/4 winners this round.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Crown className="w-4 h-4 text-gold-400" />
            Winners
          </h3>
          {data.winners.map((winner, i) => (
            <Card key={winner.entryId} glow={i === 0}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gold-400/20 flex items-center justify-center text-gold-400 font-bold text-sm">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-white font-semibold">
                        {winner.participantName}
                      </p>
                      <p className="text-white/40 text-xs font-mono">
                        {winner.participantPhoneMasked}
                      </p>
                      <p className="text-white/30 text-xs font-mono mt-0.5">
                        {winner.receiptCode}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gold-400">
                      {winner.amountFormatted}
                    </p>
                    <p className="text-white/40 text-xs mt-0.5">
                      Submitted: {formatDate(winner.submittedAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Audit Log Tab ────────────────────────────────────────────────────────────

function AuditLogTab({
  contest,
  adminKey,
}: {
  contest: ContestPublicInfo | null;
  adminKey: string;
}) {
  const [log, setLog] = useState<
    Array<{
      id: string;
      action: string;
      entityType: string | null;
      entityId: string | null;
      organizerId: string | null;
      details: Record<string, unknown>;
      occurredAt: string;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!contest) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/audit-log?contestId=${contest.id}&limit=100`,
        { headers: { Authorization: `Bearer ${adminKey}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to load audit log");
      setLog(data.log ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [contest, adminKey]);

  useEffect(() => {
    load();
  }, [load]);

  const ACTION_COLORS: Record<string, string> = {
    state_transition: "text-blue-400",
    results_entered: "text-yellow-400",
    results_verified: "text-cyan-400",
    scoring_completed: "text-gold-400",
    entry_submitted: "text-emerald-400",
    contest_auto_closed: "text-orange-400",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">Audit Log</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg border border-red-500/20">
          {error}
        </div>
      )}

      {loading && log.length === 0 ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : log.length === 0 ? (
        <p className="text-white/40 text-sm text-center py-8">
          No audit entries yet.
        </p>
      ) : (
        <div className="space-y-2">
          {log.map((entry) => (
            <div
              key={entry.id}
              className="bg-obsidian-700/40 rounded-lg border border-white/5 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span
                    className={cn(
                      "text-xs font-mono font-semibold",
                      ACTION_COLORS[entry.action] ?? "text-white/70"
                    )}
                  >
                    {entry.action}
                  </span>
                  {entry.details?.from && entry.details?.to && (
                    <span className="text-white/30 text-xs ml-2">
                      {String(entry.details.from)} → {String(entry.details.to)}
                    </span>
                  )}
                  {entry.details && Object.keys(entry.details).length > 0 && (
                    <p className="text-white/40 text-xs mt-1 font-mono truncate">
                      {Object.entries(entry.details)
                        .filter(([k]) => k !== "from" && k !== "to")
                        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                        .join(" ")}
                    </p>
                  )}
                </div>
                <span className="text-white/30 text-xs flex-shrink-0">
                  {formatDate(entry.occurredAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboardClient() {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [contest, setContest] = useState<ContestPublicInfo | null>(null);
  const [entryCount, setEntryCount] = useState(0);
  const [contestLoading, setContestLoading] = useState(false);

  const fetchContest = useCallback(async (key: string) => {
    setContestLoading(true);
    try {
      const res = await fetch("/api/contest/active");
      if (res.ok) {
        const data = await res.json();
        setContest(data);

        // Fetch entry count
        const entryRes = await fetch(
          `/api/admin/entries?contestId=${data.contestId}&limit=1&page=1`,
          { headers: { Authorization: `Bearer ${key}` } }
        );
        if (entryRes.ok) {
          const entryData = await entryRes.json();
          setEntryCount(entryData.total ?? 0);
        }
      }
    } catch {
      // Ignore — contest might not exist yet
    } finally {
      setContestLoading(false);
    }
  }, []);

  const handleAuth = useCallback(
    (key: string) => {
      setAdminKey(key);
      fetchContest(key);
    },
    [fetchContest]
  );

  const handleRefresh = useCallback(() => {
    if (adminKey) fetchContest(adminKey);
  }, [adminKey, fetchContest]);

  if (!adminKey) {
    return <AuthGate onAuth={handleAuth} />;
  }

  const TABS: Array<{
    id: AdminTab;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "overview",
      label: "Overview",
      icon: <Activity className="w-4 h-4" />,
    },
    {
      id: "entries",
      label: "Entries",
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: "results",
      label: "Results",
      icon: <ClipboardList className="w-4 h-4" />,
    },
    {
      id: "scoring",
      label: "Scoring",
      icon: <Zap className="w-4 h-4" />,
    },
    {
      id: "prizes",
      label: "Prizes",
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      id: "audit",
      label: "Audit",
      icon: <FileText className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-obsidian-900">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-obsidian-800/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-gold-400" />
            <h1 className="font-playfair text-white font-bold">
              Admin Dashboard
            </h1>
            {contest && (
              <StateBadge state={contest.state} />
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={contestLoading}
          >
            <RefreshCw
              className={cn("w-4 h-4", contestLoading && "animate-spin")}
            />
          </Button>
        </div>

        {/* Tab nav */}
        <div className="max-w-5xl mx-auto px-4 pb-0 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 transition-all",
                  activeTab === tab.id
                    ? "border-gold-400 text-gold-400"
                    : "border-transparent text-white/50 hover:text-white/80"
                )}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === "overview" && (
          <OverviewTab
            contest={contest}
            adminKey={adminKey}
            onRefresh={handleRefresh}
            entryCount={entryCount}
          />
        )}
        {activeTab === "entries" && contest && (
          <EntriesTab
            contestId={contest.id}
            adminKey={adminKey}
          />
        )}
        {activeTab === "results" && (
          <ResultsTab
            contest={contest}
            adminKey={adminKey}
            onRefresh={handleRefresh}
          />
        )}
        {activeTab === "scoring" && (
          <ScoringTab
            contest={contest}
            adminKey={adminKey}
            onRefresh={handleRefresh}
          />
        )}
        {activeTab === "prizes" && (
          <PrizesTab contest={contest} adminKey={adminKey} />
        )}
        {activeTab === "audit" && (
          <AuditLogTab contest={contest} adminKey={adminKey} />
        )}
      </main>
    </div>
  );
}
