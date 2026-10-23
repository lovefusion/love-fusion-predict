/**
 * /api/admin/teams
 *
 * GET   Lists every team with its group, whether it is marked OUT, and how many entries picked it.
 * POST  Marks a team OUT of the tournament, or puts it back in.
 *       Body: { teamId: string, eliminated: boolean }
 *
 * Marking a team OUT is informational: it shows an OUT badge to players, stops NEW entries from
 * picking that team, and gives the admin a list of the people who picked it (export type=notify).
 * It does NOT change scoring: scoring still uses only the official results entered by organizers.
 *
 * Auth: Bearer ADMIN_SECRET_KEY
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contests, groups, teams, entries, predictions, auditLog } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { errorResponse, okResponse } from "@/lib/api-helpers";
import { getClientIp } from "@/lib/rate-limit";

export const runtime = "edge";

const ToggleSchema = z.object({
  teamId: z.string().min(1),
  eliminated: z.boolean(),
});

/** How many (non-revoked) entries picked each team, keyed by team id. */
async function pickCounts(contestId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ teamId: predictions.teamId, count: sql<number>`count(*)` })
    .from(predictions)
    .innerJoin(entries, eq(entries.id, predictions.entryId))
    .where(and(eq(entries.contestId, contestId), eq(entries.isRevoked, false)))
    .groupBy(predictions.teamId);
  return Object.fromEntries(rows.map((r) => [r.teamId, Number(r.count)]));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) return auth.response;

  const [contest] = await db.select().from(contests).limit(1);
  if (!contest) return errorResponse("NOT_FOUND", "Contest not found.", 404);

  const groupRows = await db.select().from(groups).where(eq(groups.contestId, contest.id));
  const teamRows = await db.select().from(teams).where(eq(teams.contestId, contest.id));
  const picks = await pickCounts(contest.id);

  const labelByGroupId = Object.fromEntries(groupRows.map((g) => [g.id, g.label as string]));

  const list = teamRows
    .map((t) => ({
      id: t.id,
      name: t.name,
      groupLabel: labelByGroupId[t.groupId] ?? "?",
      eliminated: t.eliminatedAt != null,
      eliminatedAt: t.eliminatedAt ? t.eliminatedAt.toISOString() : null,
      pickedBy: picks[t.id] ?? 0,
    }))
    .sort((a, b) => a.groupLabel.localeCompare(b.groupLabel) || a.name.localeCompare(b.name));

  return okResponse({ ok: true, teams: list });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_INPUT", "Request body must be valid JSON.", 400);
  }
  const parsed = ToggleSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("INVALID_INPUT", "teamId and eliminated (true/false) are required.", 400);
  }
  const { teamId, eliminated } = parsed.data;

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) return errorResponse("NOT_FOUND", "Team not found.", 404);

  // Safety net against a mis-click: every group must keep at least 2 teams still in,
  // otherwise nobody could complete a valid pick for that group.
  if (eliminated) {
    const groupTeams = await db.select().from(teams).where(eq(teams.groupId, team.groupId));
    const stillIn = groupTeams.filter((t) => t.id !== team.id && t.eliminatedAt == null).length;
    if (stillIn < 2) {
      return errorResponse(
        "INVALID_INPUT",
        "At least 2 teams in each group must stay in, so a third team cannot be marked OUT here.",
        409,
      );
    }
  }

  try {
    await db
      .update(teams)
      .set({ eliminatedAt: eliminated ? new Date() : null })
      .where(eq(teams.id, teamId));
  } catch (err) {
    console.error("[POST /api/admin/teams] DB error:", err);
    return errorResponse("SERVER_ERROR", "Could not update the team. Please try again.", 500);
  }

  // Audit trail (best effort: never blocks the change). The audit action list has no
  // team-specific value, so the exact event is recorded in `details.event`.
  try {
    await db.insert(auditLog).values({
      contestId: team.contestId,
      action: "contest_state_changed",
      entityType: "team",
      entityId: team.id,
      details: { event: eliminated ? "team_marked_out" : "team_put_back_in", team: team.name },
      ipAddress: getClientIp(request),
      occurredAt: new Date(),
    });
  } catch (err) {
    console.error("[POST /api/admin/teams] audit log failed:", err);
  }

  const picks = await pickCounts(team.contestId);
  return okResponse({
    ok: true,
    teamId: team.id,
    name: team.name,
    eliminated,
    pickedBy: picks[team.id] ?? 0,
  });
}
