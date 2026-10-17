/**
 * GET /api/contest/active
 *
 * Returns the current active contest with group/team data for the public UI.
 * "Active" means the contest in state: open, published_not_open, or closed/results_*.
 * Returns the most recently updated contest that is not in draft/archived.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { contests, groups, teams } from "@/db/schema";
import { eq, ne, and, desc } from "drizzle-orm";
import type { ContestPublicInfo, GroupLabel, GroupSummary } from "@/lib/types";
import { errorResponse } from "@/lib/api-helpers";

export const runtime = "edge";
export const revalidate = 60;

const INACTIVE_STATES = ["draft", "archived"] as const;

export async function GET(): Promise<NextResponse> {
  try {
    // Find the most-recently-updated non-draft, non-archived contest
    const [contest] = await db
      .select()
      .from(contests)
      .where(
        and(
          ne(contests.state, "draft"),
          ne(contests.state, "archived"),
        ),
      )
      .orderBy(desc(contests.updatedAt))
      .limit(1);

    if (!contest) {
      return errorResponse("CONTEST_NOT_FOUND", "No active contest found.", 404);
    }

    // Fetch all groups for this contest, with their teams
    const groupRows = await db
      .select()
      .from(groups)
      .where(eq(groups.contestId, contest.id))
      .orderBy(groups.label);

    const teamRows = await db
      .select()
      .from(teams)
      .where(eq(teams.contestId, contest.id))
      .orderBy(teams.name);

    const groupSummaries: GroupSummary[] = groupRows.map((g) => ({
      label: g.label as GroupLabel,
      teams: teamRows
        .filter((t) => t.groupId === g.id)
        .map((t) => ({
          id:               t.id,
          name:             t.name,
          groupLabel:       g.label as GroupLabel,
          ownerNames:       t.ownerNames,
          captainName:      t.captainName ?? null,
          logoUrl:          t.logoUrl ?? null,
          captainImageUrl:  t.captainImageUrl ?? null,
        })),
    }));

    const now = Date.now();
    const deadline = new Date(contest.entryDeadline).getTime();

    const body: ContestPublicInfo = {
      id:               contest.id,
      name:             contest.name,
      state:            contest.state,
      entryDeadline:    contest.entryDeadline.toISOString(),
      prizePoolPaise:   contest.prizePoolPaise,
      groups:           groupSummaries,
      isOpen:           contest.state === "open" && now < deadline,
      isDeadlinePassed: now >= deadline,
    };

    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("[/api/contest/active] Error:", err);
    return errorResponse("SERVER_ERROR", "Failed to load contest.", 500);
  }
}
