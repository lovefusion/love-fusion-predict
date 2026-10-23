/**
 * GET /api/entry/[token]
 *
 * Returns a participant's entry receipt by their private token.
 * Includes prediction details and (if scored) score + prize info.
 * PII is masked: only last-4 of phone shown.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { entries, participants, predictions, groups, teams, scores, prizeAllocations, contests } from "@/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/api-helpers";
import type { EntryReceiptView, GroupLabel } from "@/lib/types";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "edge";

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } },
): Promise<NextResponse> {
  // Rate-limit by IP: 20 lookups per minute (for receipt refresh)
  const ip = getClientIp(request);
  if (!checkRateLimit(`receipt:${ip}`, 20)) {
    return errorResponse("RATE_LIMITED", "Too many requests. Please slow down.", 429);
  }

  const { token } = params;
  if (!token || token.length !== 48) {
    return errorResponse("INVALID_INPUT", "Invalid receipt token.", 400);
  }

  // Find entry by private token
  const [entry] = await db
    .select()
    .from(entries)
    .where(eq(entries.privateToken, token))
    .limit(1);

  if (!entry) {
    return errorResponse("NOT_FOUND", "Entry not found.", 404);
  }

  // Load participant (name only — phone masked at read time)
  const [participant] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, entry.participantId))
    .limit(1);

  // Load contest state
  const [contest] = await db
    .select({ state: contests.state })
    .from(contests)
    .where(eq(contests.id, entry.contestId))
    .limit(1);

  // Load all predictions for this entry — each row has one teamId
  // There are 2 rows per group (one per predicted qualifier)
  const predRows = await db
    .select({
      groupId:    predictions.groupId,
      teamId:     predictions.teamId,
      groupLabel: groups.label,
      teamName:   teams.name,
      eliminatedAt: teams.eliminatedAt,
    })
    .from(predictions)
    .innerJoin(groups, eq(groups.id, predictions.groupId))
    .innerJoin(teams, eq(teams.id, predictions.teamId))
    .where(eq(predictions.entryId, entry.id));

  // Group by groupLabel — collect up to 2 team names per group
  const groupMap = new Map<GroupLabel, { name: string; out: boolean }[]>();
  for (const row of predRows) {
    const label = row.groupLabel as GroupLabel;
    if (!groupMap.has(label)) groupMap.set(label, []);
    groupMap.get(label)!.push({ name: row.teamName, out: row.eliminatedAt != null });
  }

  const predictionViews = (["A", "B", "C", "D"] as GroupLabel[])
    .filter((label) => groupMap.has(label))
    .map((label) => {
      const picked = groupMap.get(label)!;
      return {
        groupLabel: label,
        team1Name:  picked[0]?.name ?? "",
        team2Name:  picked[1]?.name ?? "",
        team1Out:   picked[0]?.out ?? false,
        team2Out:   picked[1]?.out ?? false,
      };
    });

  // Load scores if available
  const scoreRows = await db
    .select()
    .from(scores)
    .where(eq(scores.entryId, entry.id))
    .limit(1);

  // Load prize allocation if available
  const [prize] = await db
    .select({ prizeAmountPaise: prizeAllocations.prizeAmountPaise })
    .from(prizeAllocations)
    .where(eq(prizeAllocations.entryId, entry.id))
    .limit(1);

  // scores table has groupScores JSON: { A: 0|1, B: 0|1, C: 0|1, D: 0|1 }
  const scoreViews = scoreRows.length > 0 && scoreRows[0].groupScores
    ? (["A", "B", "C", "D"] as GroupLabel[]).map((label) => ({
        groupLabel: label,
        score: (scoreRows[0].groupScores as Record<string, 0 | 1>)[label] ?? 0 as 0 | 1,
      }))
    : undefined;

  const totalScore = scoreRows.length > 0 ? scoreRows[0].totalScore : undefined;

  const body: EntryReceiptView = {
    entryId:          entry.id,
    receiptCode:      entry.receiptCode,
    participantName:  participant?.fullName ?? "Participant",
    submittedAt:      entry.submittedAt.toISOString(),
    predictions:      predictionViews,
    scores:           scoreViews,
    totalScore,
    isPerfect:        totalScore === 4,
    prizeAmountPaise: prize?.prizeAmountPaise ?? undefined,
    contestState:     contest?.state ?? "closed",
  };

  return NextResponse.json(body);
}
