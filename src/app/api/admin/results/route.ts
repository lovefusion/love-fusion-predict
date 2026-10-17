/**
 * POST /api/admin/results
 * Enter or verify official qualifier results. Two-person verification required:
 *   1. First call (action: "enter"): saves provisional results, sets enteredBy.
 *   2. Second call (action: "verify"): verifier confirms, sets verifiedBy, transitions to results_verified.
 *      The verifier must differ from the person who entered results.
 *
 * GET /api/admin/results?contestId=xxx
 * Returns current provisional results for the contest.
 *
 * Body for POST:
 * {
 *   contestId: string,
 *   action: "enter" | "verify",
 *   operatorId: string,           // organizerAccount.id performing the action
 *   qualifiers: [                 // full set of 4 groups
 *     { groupLabel: "A", qualifier1Id: string, qualifier2Id: string },
 *     ...
 *   ]
 * }
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { contests, results, groups, teams, auditLog, organizerAccounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { errorResponse, okResponse } from "@/lib/api-helpers";

export const runtime = "edge";

const QualifierSchema = z.object({
  groupLabel: z.enum(["A", "B", "C", "D"]),
  qualifier1Id: z.string().uuid(),
  qualifier2Id: z.string().uuid(),
});

const ResultsBodySchema = z.object({
  contestId: z.string().uuid(),
  action: z.enum(["enter", "verify"]),
  operatorId: z.string().uuid("operatorId must be a valid organizerAccount UUID"),
  qualifiers: z
    .array(QualifierSchema)
    .length(4, "Exactly 4 groups required"),
});

export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const contestId = searchParams.get("contestId");
  if (!contestId) {
    return errorResponse("VALIDATION_ERROR", "contestId is required", 400);
  }

  const rows = await db
    .select({
      id: results.id,
      groupId: results.groupId,
      qualifier1Id: results.qualifier1Id,
      qualifier2Id: results.qualifier2Id,
      enteredBy: results.enteredBy,
      enteredAt: results.enteredAt,
      verifiedBy: results.verifiedBy,
      verifiedAt: results.verifiedAt,
      isVerified: results.isVerified,
    })
    .from(results)
    .where(eq(results.contestId, contestId));

  return okResponse({ contestId, results: rows }, 200);
}

export async function POST(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = ResultsBodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      parsed.error.issues.map((i) => i.message).join(", "),
      400
    );
  }

  const { contestId, action, operatorId, qualifiers } = parsed.data;

  // Verify operator exists
  const opRows = await db
    .select({ id: organizerAccounts.id, displayName: organizerAccounts.displayName, isActive: organizerAccounts.isActive })
    .from(organizerAccounts)
    .where(eq(organizerAccounts.id, operatorId))
    .limit(1);

  if (opRows.length === 0 || !opRows[0].isActive) {
    return errorResponse("UNAUTHORIZED", "Operator account not found or inactive", 403);
  }
  const operator = opRows[0];

  // Load contest
  const contestRows = await db
    .select({ id: contests.id, state: contests.state })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);

  if (contestRows.length === 0) {
    return errorResponse("NOT_FOUND", "Contest not found", 404);
  }

  const contest = contestRows[0];
  const allowedStates = ["closed", "results_provisional"];
  if (!allowedStates.includes(contest.state)) {
    return errorResponse(
      "CONTEST_NOT_OPEN",
      `Results can only be entered when contest is "closed" or "results_provisional". Current: "${contest.state}"`,
      422
    );
  }

  // Load groups for this contest
  const groupRows = await db
    .select({ id: groups.id, label: groups.label })
    .from(groups)
    .where(eq(groups.contestId, contestId));

  const groupByLabel = Object.fromEntries(groupRows.map((g) => [g.label, g]));

  // Validate team IDs
  for (const q of qualifiers) {
    const group = groupByLabel[q.groupLabel];
    if (!group) {
      return errorResponse("VALIDATION_ERROR", `Group ${q.groupLabel} not found in this contest`, 422);
    }
    if (q.qualifier1Id === q.qualifier2Id) {
      return errorResponse("VALIDATION_ERROR", `Group ${q.groupLabel}: qualifier1 and qualifier2 must be different`, 422);
    }
    for (const teamId of [q.qualifier1Id, q.qualifier2Id]) {
      const teamRows = await db
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.id, teamId), eq(teams.groupId, group.id)))
        .limit(1);
      if (teamRows.length === 0) {
        return errorResponse("VALIDATION_ERROR", `Team ${teamId} does not belong to Group ${q.groupLabel}`, 422);
      }
    }
  }

  const now = new Date();

  if (action === "enter") {
    if (contest.state !== "closed") {
      return errorResponse("CONTEST_NOT_OPEN", `Results entry requires "closed" state. Current: "${contest.state}"`, 422);
    }

    // Delete existing provisional results and re-insert
    await db.delete(results).where(eq(results.contestId, contestId));

    for (const q of qualifiers) {
      const group = groupByLabel[q.groupLabel];
      await db.insert(results).values({
        contestId,
        groupId: group.id,
        qualifier1Id: q.qualifier1Id,
        qualifier2Id: q.qualifier2Id,
        enteredBy: operatorId,
        enteredAt: now,
        isVerified: false,
      });
    }

    // Transition to results_provisional
    await db.update(contests).set({ state: "results_provisional", updatedAt: now }).where(eq(contests.id, contestId));

    await db.insert(auditLog).values({
      contestId,
      organizerId: operatorId,
      action: "results_entered",
      entityType: "results",
      details: { groupCount: qualifiers.length, operatorName: operator.displayName },
      occurredAt: now,
    });

    return okResponse({ action: "entered", contestId, enteredBy: operator.displayName, newState: "results_provisional" }, 201);
  }

  // action === "verify"
  if (contest.state !== "results_provisional") {
    return errorResponse("CONTEST_NOT_OPEN", `Verification requires "results_provisional" state. Current: "${contest.state}"`, 422);
  }

  const existingResults = await db
    .select({ enteredBy: results.enteredBy, groupId: results.groupId })
    .from(results)
    .where(eq(results.contestId, contestId));

  if (existingResults.length === 0) {
    return errorResponse("NOT_FOUND", "No provisional results to verify. Enter results first.", 404);
  }

  const enteredById = existingResults[0]?.enteredBy;
  if (enteredById === operatorId) {
    return errorResponse("VALIDATION_ERROR", "The verifier must be a different organizer from who entered the results.", 422);
  }

  // Update all results with verifiedBy
  for (const q of qualifiers) {
    const group = groupByLabel[q.groupLabel];
    await db
      .update(results)
      .set({
        verifiedBy: operatorId,
        verifiedAt: now,
        isVerified: true,
        qualifier1Id: q.qualifier1Id,
        qualifier2Id: q.qualifier2Id,
      })
      .where(and(eq(results.contestId, contestId), eq(results.groupId, group.id)));
  }

  // Transition to results_verified
  await db.update(contests).set({ state: "results_verified", updatedAt: now }).where(eq(contests.id, contestId));

  await db.insert(auditLog).values({
    contestId,
    organizerId: operatorId,
    action: "results_verified",
    entityType: "results",
    details: { operatorName: operator.displayName, enteredById },
    occurredAt: now,
  });

  return okResponse({ action: "verified", contestId, verifiedBy: operator.displayName, newState: "results_verified" }, 200);
}
