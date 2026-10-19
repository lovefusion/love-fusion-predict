/**
 * Love Fusion Predict — Scoring Engine
 *
 * Pure functions only. No database access. No side effects.
 * All inputs are team UUIDs (strings). Order within a group does NOT matter.
 *
 * Rules (canonical):
 * - Each group awards 0 or 1 point.
 * - A group scores 1 iff the SET of 2 predicted team IDs equals the SET of 2 official qualifier IDs.
 * - Total score = sum of 4 group scores (0–4).
 * - Only a score of 4 qualifies for the jackpot (all 8 picks correct).
 * - Exactly 3 groups correct earns the consolation prize (a T-shirt), never the jackpot.
 */

/** Group labels used in this tournament */
export type GroupLabel = "A" | "B" | "C" | "D";

/** Per-group breakdown: 0 = wrong, 1 = correct */
export type GroupScore = Record<GroupLabel, 0 | 1>;

export interface ScoringResult {
  /** Individual group scores */
  groupScores: GroupScore;
  /** 0–4 */
  totalScore: number;
  /** true iff totalScore === 4 */
  isPerfect: boolean;
  /** true iff totalScore === 3 exactly (consolation T-shirt) */
  isConsolation: boolean;
}

/**
 * Official qualifier pair for a group (order irrelevant — treated as a set).
 */
export interface QualifierPair {
  qualifier1Id: string;
  qualifier2Id: string;
}

/**
 * A participant's prediction for one group (order irrelevant — treated as a set).
 */
export interface PredictionPair {
  teamId1: string;
  teamId2: string;
}

/**
 * Score one group. Returns 1 iff the predicted set === official set.
 *
 * @param predicted  The participant's two predictions for this group.
 * @param official   The two official qualifiers for this group.
 * @returns 0 or 1
 *
 * @example
 * scoreGroup({ teamId1: "a", teamId2: "b" }, { qualifier1Id: "b", qualifier2Id: "a" })
 * // => 1 (order irrelevant)
 *
 * @example
 * scoreGroup({ teamId1: "a", teamId2: "c" }, { qualifier1Id: "a", qualifier2Id: "b" })
 * // => 0 (c ≠ b)
 */
export function scoreGroup(predicted: PredictionPair, official: QualifierPair): 0 | 1 {
  const predictedSet = new Set([predicted.teamId1, predicted.teamId2]);
  const officialSet  = new Set([official.qualifier1Id, official.qualifier2Id]);

  // Sets must be same size (they should both be 2, but guard against duplicates)
  if (predictedSet.size !== 2 || officialSet.size !== 2) return 0;

  // Set equality: every element of official must be in predicted and vice versa
  for (const id of officialSet) {
    if (!predictedSet.has(id)) return 0;
  }

  return 1;
}

/**
 * Score a complete entry across all 4 groups.
 *
 * @param predictions  Map from group label to the participant's prediction pair.
 * @param officials    Map from group label to the official qualifier pair.
 * @returns Full scoring result including per-group breakdown.
 *
 * @throws If a group is missing from either predictions or officials.
 */
export function scoreEntry(
  predictions: Record<GroupLabel, PredictionPair>,
  officials:   Record<GroupLabel, QualifierPair>,
): ScoringResult {
  const groups: GroupLabel[] = ["A", "B", "C", "D"];

  for (const group of groups) {
    if (!predictions[group]) throw new Error(`Missing prediction for group ${group}`);
    if (!officials[group])   throw new Error(`Missing official result for group ${group}`);
  }

  const groupScores: GroupScore = {
    A: scoreGroup(predictions.A, officials.A),
    B: scoreGroup(predictions.B, officials.B),
    C: scoreGroup(predictions.C, officials.C),
    D: scoreGroup(predictions.D, officials.D),
  };

  const totalScore = groupScores.A + groupScores.B + groupScores.C + groupScores.D;
  const isPerfect  = totalScore === 4;
  const isConsolation = totalScore === 3;

  return { groupScores, totalScore, isPerfect, isConsolation };
}

// ─── Prize Calculation Engine ─────────────────────────────────────────────────

/**
 * Input to the prize calculator — one per winning entry.
 */
export interface WinnerEntry {
  entryId:       string;
  /** ISO 8601 timestamp string — used for residual tie-break */
  submittedAt:   string;
  participantId: string;
}

/**
 * Output of prize calculation — one per winning entry.
 */
export interface PrizeAllocationResult {
  entryId:          string;
  participantId:    string;
  prizeAmountPaise: number;     // integer, never fractional
  isResidualHolder: boolean;    // true for the entry that receives the extra paise
}

/**
 * Prize summary for the contest.
 */
export interface PrizeSummary {
  winnerCount:        number;
  prizePoolPaise:     number;
  baseSharePaise:     number;   // floor(prizePool / winnerCount) — integer
  residualPaise:      number;   // prizePool - (baseShare × winnerCount) — 0 to (winnerCount - 1)
  allocations:        PrizeAllocationResult[];
  totalAllocatedPaise: number;  // MUST equal prizePoolPaise when winnerCount > 0
}

/**
 * Calculate prize allocations for a set of perfect entries.
 *
 * Rules:
 *  1. If winnerCount === 0: no allocations, total = 0.
 *  2. Each winner gets floor(prizePoolPaise / winnerCount) paise.
 *  3. Residual (prizePool % winnerCount) goes to the entry with the EARLIEST submittedAt.
 *     Tie on submittedAt: goes to the entry with the lexicographically smallest entryId.
 *  4. Sum of all allocated paise MUST equal prizePoolPaise. This is enforced.
 *
 * @param winners         Winning entries (only perfect 4/4 scorers).
 * @param prizePoolPaise  Total prize pool in paise (must be a positive integer).
 * @returns PrizeSummary with allocations and verification total.
 *
 * @throws If sum of allocations ≠ prizePoolPaise (should never happen; indicates a bug).
 */
export function calculatePrize(
  winners:        WinnerEntry[],
  prizePoolPaise: number,
): PrizeSummary {
  if (!Number.isInteger(prizePoolPaise) || prizePoolPaise <= 0) {
    throw new Error(`prizePoolPaise must be a positive integer, got: ${prizePoolPaise}`);
  }

  if (winners.length === 0) {
    return {
      winnerCount:         0,
      prizePoolPaise,
      baseSharePaise:      0,
      residualPaise:       0,
      allocations:         [],
      totalAllocatedPaise: 0,
    };
  }

  const winnerCount    = winners.length;
  const baseSharePaise = Math.floor(prizePoolPaise / winnerCount);
  const residualPaise  = prizePoolPaise - baseSharePaise * winnerCount;

  // Determine residual holder: earliest submittedAt, then smallest entryId (lexicographic)
  const sorted = [...winners].sort((a, b) => {
    const tA = new Date(a.submittedAt).getTime();
    const tB = new Date(b.submittedAt).getTime();
    if (tA !== tB) return tA - tB;               // earlier timestamp wins
    return a.entryId.localeCompare(b.entryId);   // lexicographic tie-break
  });

  const residualHolderId = sorted[0].entryId;

  const allocations: PrizeAllocationResult[] = winners.map((winner) => {
    const isResidualHolder = winner.entryId === residualHolderId;
    return {
      entryId:          winner.entryId,
      participantId:    winner.participantId,
      prizeAmountPaise: baseSharePaise + (isResidualHolder ? residualPaise : 0),
      isResidualHolder,
    };
  });

  // Invariant: sum must equal prizePoolPaise
  const totalAllocatedPaise = allocations.reduce((sum, a) => sum + a.prizeAmountPaise, 0);
  if (totalAllocatedPaise !== prizePoolPaise) {
    throw new Error(
      `Prize allocation invariant violated: allocated ${totalAllocatedPaise} ≠ pool ${prizePoolPaise}`,
    );
  }

  return {
    winnerCount,
    prizePoolPaise,
    baseSharePaise,
    residualPaise,
    allocations,
    totalAllocatedPaise,
  };
}

/**
 * Format paise as a human-readable rupee string.
 * @example formatPaise(1100000) => "₹11,000"
 * @example formatPaise(550000)  => "₹5,500"
 * @example formatPaise(11050)   => "₹110.50"
 */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  // Show decimal only if fractional paise
  const formatted = Number.isInteger(rupees)
    ? rupees.toLocaleString("en-IN")
    : rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `₹${formatted}`;
}
