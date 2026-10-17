/**
 * POST /api/admin/score
 * Trigger the scoring engine for a contest in "results_verified" state.
 * Scores all entries, allocates prizes, transitions contest to "scored".
 *
 * Body: { contestId: string, operatorId: string }
 * Auth: Bearer ADMIN_SECRET_KEY
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  contests,
  entries,
  predictions,
  results,
  scores,
  prizeAllocations,
  auditLog,
  organizerAccounts,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { errorResponse, okResponse } from "@/lib/api-helpers";
import { scoreEntry, calculatePrize, formatPaise } from "@/lib/scoring";
import type { QualifierPair, PredictionPair } from "@/lib/scoring";

export const runtime = "edge";

const ScoreBodySchema = z.object({
  contestId: z.string().uuid(),
  operatorId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = ScoreBodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join(", "), 400);
  }

  const { contestId, operatorId } = parsed.data;

  // Verify operator
  const opRows = await db
    .select({ id: organizerAccounts.id, displayName: organizerAccounts.displayName, isActive: organizerAccounts.isActive })
    .from(organizerAccounts)
    .where(eq(organizerAccounts.id, operatorId))
    .limit(1);

  if (opRows.length === 0 || !opRows[0].isActive) {
    return errorResponse("UNAUTHORIZED", "Operator account not found or inactive", 403);
  }

  // Load contest
  const contestRows = await db
    .select({ id: contests.id, state: contests.state, prizePoolPaise: contests.prizePoolPaise })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);

  if (contestRows.length === 0) {
    return errorResponse("NOT_FOUND", "Contest not found", 404);
  }

  const contest = contestRows[0];

  // Idempotent: already scored
  if (["scored", "finalized", "results_published", "archived"].includes(contest.state)) {
    const scoreRows = await db
      .select({ totalScore: scores.totalScore })
      .from(scores)
      .where(eq(scores.contestId, contestId));
    const winners = scoreRows.filter((s) => s.totalScore === 4);
    return okResponse({
      alreadyScored: true,
      contestId,
      totalEntries: scoreRows.length,
      winnerCount: winners.length,
    }, 200);
  }

  if (contest.state !== "results_verified") {
    return errorResponse(
      "CONTEST_NOT_OPEN",
      `Scoring requires "results_verified" state. Current: "${contest.state}"`,
      422
    );
  }

  // Load official qualifiers
  const resultRows = await db
    .select({ groupId: results.groupId, qualifier1Id: results.qualifier1Id, qualifier2Id: results.qualifier2Id })
    .from(results)
    .where(eq(results.contestId, contestId));

  if (resultRows.length !== 4) {
    return errorResponse("NOT_FOUND", `Expected 4 groups of results, found ${resultRows.length}.`, 422);
  }

  // We need group labels — load them
  const { groups: groupsTable } = await import("@/db/schema");
  const groupRows = await db
    .select({ id: groupsTable.id, label: groupsTable.label })
    .from(groupsTable)
    .where(eq(groupsTable.contestId, contestId));

  const groupLabelById = Object.fromEntries(groupRows.map((g) => [g.id, g.label]));

  // Build official qualifier map keyed by group label
  const officialQualifiers: Record<string, QualifierPair> = {};
  for (const row of resultRows) {
    const label = groupLabelById[row.groupId];
    if (label) {
      officialQualifiers[label] = { teamId1: row.qualifier1Id, teamId2: row.qualifier2Id };
    }
  }

  if (Object.keys(officialQualifiers).length !== 4) {
    return errorResponse("NOT_FOUND", "Could not resolve all group labels for results.", 422);
  }

  // Load all entries
  const entryRows = await db
    .select({ id: entries.id, participantId: entries.participantId, submittedAt: entries.submittedAt })
    .from(entries)
    .where(eq(entries.contestId, contestId));

  if (entryRows.length === 0) {
    return errorResponse("NOT_FOUND", "No entries found for this contest.", 404);
  }

  // Load all predictions for this contest via entries join
  // predictions table has: entryId, groupId, teamId (no contestId column)
  const predRows = await db
    .select({ entryId: predictions.entryId, groupId: predictions.groupId, teamId: predictions.teamId })
    .from(predictions)
    .innerJoin(entries, eq(predictions.entryId, entries.id))
    .where(eq(entries.contestId, contestId));

  // Group predictions by entryId, resolving groupId → label
  const predsByEntry: Record<string, PredictionPair[]> = {};
  for (const pred of predRows) {
    if (!predsByEntry[pred.entryId]) predsByEntry[pred.entryId] = [];
    const label = groupLabelById[pred.groupId] as "A" | "B" | "C" | "D" | undefined;
    if (label) {
      // Check if pair for this group already exists
      const existingIdx = predsByEntry[pred.entryId].findIndex((p) => p.groupLabel === label);
      if (existingIdx === -1) {
        predsByEntry[pred.entryId].push({ groupLabel: label, teamId1: pred.teamId, teamId2: "" });
      } else {
        predsByEntry[pred.entryId][existingIdx].teamId2 = pred.teamId;
      }
    }
  }

  const now = new Date();
  const prizePoolPaise = contest.prizePoolPaise ?? 1_100_000;

  // Clear previous scores if any
  await db.delete(scores).where(eq(scores.contestId, contestId));
  await db.delete(prizeAllocations).where(eq(prizeAllocations.contestId, contestId));

  const scoredEntries: Array<{
    entryId: string;
    participantId: string;
    submittedAt: Date;
    totalScore: number;
    groupScores: Record<string, number>;
  }> = [];

  for (const entry of entryRows) {
    const preds = predsByEntry[entry.id] ?? [];
    const { totalScore, groupScores } = scoreEntry(preds, officialQualifiers);

    scoredEntries.push({
      entryId: entry.id,
      participantId: entry.participantId,
      submittedAt: entry.submittedAt,
      totalScore,
      groupScores,
    });

    await db.insert(scores).values({
      contestId,
      entryId: entry.id,
      totalScore,
      isPerfect: totalScore === 4,
      groupScores: groupScores as { A: 0 | 1; B: 0 | 1; C: 0 | 1; D: 0 | 1 },
      computedAt: now,
    });
  }

  // Find 4/4 winners
  const winners = scoredEntries
    .filter((e) => e.totalScore === 4)
    .map((e) => ({
      entryId: e.entryId,
      participantId: e.participantId,
      submittedAt: e.submittedAt instanceof Date
        ? e.submittedAt.toISOString()
        : String(e.submittedAt),
    }));

  const prizeSummary = calculatePrize(winners, prizePoolPaise);
  const { allocations } = prizeSummary;

  // Write prize allocations
  for (const alloc of allocations) {
    await db.insert(prizeAllocations).values({
      contestId,
      entryId: alloc.entryId,
      participantId: alloc.participantId,
      prizeAmountPaise: alloc.prizeAmountPaise,
      isResidualHolder: alloc.isResidualHolder,
      allocatedAt: now,
      paymentStatus: "pending",
    });
  }

  // Transition to "scored"
  await db.update(contests).set({ state: "scored", scoredAt: now, updatedAt: now }).where(eq(contests.id, contestId));

  await db.insert(auditLog).values({
    contestId,
    organizerId: operatorId,
    action: "scoring_completed",
    entityType: "contest",
    entityId: contestId,
    details: {
      totalEntries: entryRows.length,
      winnerCount: winners.length,
      prizePoolPaise,
      prizePoolFormatted: formatPaise(prizePoolPaise),
    },
    occurredAt: now,
  });

  return okResponse({
    contestId,
    scoredAt: now.toISOString(),
    totalEntries: entryRows.length,
    winnerCount: winners.length,
    prizePoolPaise,
    prizePoolFormatted: formatPaise(prizePoolPaise),
    newState: "scored",
    winners: allocations.map((a) => ({
      entryId: a.entryId,
      amountPaise: a.prizeAmountPaise,
      amountFormatted: formatPaise(a.prizeAmountPaise),
      isResidualHolder: a.isResidualHolder,
    })),
  }, 200);
}
