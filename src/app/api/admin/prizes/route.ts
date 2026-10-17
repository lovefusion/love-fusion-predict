/**
 * GET /api/admin/prizes?contestId=xxx
 * Returns prize allocations with winner names and masked phones.
 * Only available once contest is in "scored" or later state.
 * Auth: Bearer ADMIN_SECRET_KEY
 */

import { NextRequest } from "next/server";
import { db } from "@/db";
import { contests, prizeAllocations, entries, participants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { errorResponse, okResponse } from "@/lib/api-helpers";
import { maskPhone } from "@/lib/utils";
import { formatPaise } from "@/lib/scoring";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const contestId = searchParams.get("contestId");
  if (!contestId) {
    return errorResponse("VALIDATION_ERROR", "contestId is required", 400);
  }

  // Load contest state
  const contestRows = await db
    .select({ state: contests.state, prizePoolPaise: contests.prizePoolPaise })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);

  if (contestRows.length === 0) {
    return errorResponse("NOT_FOUND", "Contest not found", 404);
  }

  const contest = contestRows[0];
  const scoredStates = ["scored", "finalized", "results_published", "archived"];
  if (!scoredStates.includes(contest.state)) {
    return errorResponse(
      "CONTEST_NOT_OPEN",
      `Prize data is only available after scoring. Current state: "${contest.state}"`,
      422
    );
  }

  // Load prize allocations with winner info
  const rows = await db
    .select({
      entryId: prizeAllocations.entryId,
      participantId: prizeAllocations.participantId,
      prizeAmountPaise: prizeAllocations.prizeAmountPaise,
      allocatedAt: prizeAllocations.allocatedAt,
      receiptCode: entries.receiptCode,
      submittedAt: entries.submittedAt,
      participantName: participants.fullName,
      participantPhone: participants.whatsapp,
    })
    .from(prizeAllocations)
    .innerJoin(entries, eq(prizeAllocations.entryId, entries.id))
    .innerJoin(
      participants,
      eq(prizeAllocations.participantId, participants.id)
    )
    .where(eq(prizeAllocations.contestId, contestId))
    .orderBy(prizeAllocations.allocatedAt);

  const totalAllocated = rows.reduce((sum, r) => sum + r.prizeAmountPaise, 0);
  const prizePool = contest.prizePoolPaise ?? 1_100_000;

  return okResponse(
    {
      contestId,
      contestState: contest.state,
      prizePoolPaise: prizePool,
      prizePoolFormatted: formatPaise(prizePool),
      totalAllocatedPaise: totalAllocated,
      totalAllocatedFormatted: formatPaise(totalAllocated),
      winnerCount: rows.length,
      winners: rows.map((row) => ({
        entryId: row.entryId,
        receiptCode: row.receiptCode,
        submittedAt: row.submittedAt,
        participantName: row.participantName,
        participantPhoneMasked: maskPhone(row.participantPhone),
        amountPaise: row.prizeAmountPaise,
        amountFormatted: formatPaise(row.prizeAmountPaise),
        allocatedAt: row.allocatedAt,
      })),
    },
    200
  );
}
