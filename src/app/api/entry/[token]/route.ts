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
import { eq, and } from "drizzle-orm";
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

  // Load predictions with team names
  const predRows = await db
    .select({
      groupLabel: groups.label,
      team1Name:  teams.name,
      teamId1:    predictions.teamId1,
      teamId2:    predictions.teamId2,
    })
    .from(predictions)
    .innerJoin(groups, eq(groups.id, predictions.groupId))
    .innerJoin(teams, eq(teams.id, predictions.teamId1))
    .where(eq(predictions.entryId, entry.id));

  // Resolve team2 names separately (can't double-join same table easily)
  const team2Names = await Promise.all(
    predRows.map((p) =>
      db
        .select({ name: teams.name })
        .from(teams)
        .where(eq(teams.id, p.teamId2))
        .limit(1)
        .then((rows) => rows[0]?.name ?? p.teamId2),
    ),
  );

  const predictionViews = predRows.map((p, i) => ({
    groupLabel: p.groupLabel as GroupLabel,
    team1Name:  p.team1Name,
    team2Name:  team2Names[i],
  }));

  // Load scores if available
  const scoreRows = await db
    .select()
    .from(scores)
    .where(eq(scores.entryId, entry.id))
    .limit(4);

  // Load prize allocation if available
  const [prize] = await db
    .select({ prizeAmountPaise: prizeAllocations.prizeAmountPaise })
    .from(prizeAllocations)
    .where(eq(prizeAllocations.entryId, entry.id))
    .limit(1);

  const scoreViews = scoreRows.length > 0
    ? scoreRows.map((s) => ({
        groupLabel: s.groupLabel as GroupLabel,
        score: s.score as 0 | 1,
      }))
    : undefined;

  const totalScore = scoreViews
    ? scoreViews.reduce((sum, s) => sum + s.score, 0)
    : undefined;

  const body: EntryReceiptView = {
    entryId:          entry.id,
    receiptCode:      entry.receiptCode,
    participantName:  participant?.name ?? "Participant",
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
