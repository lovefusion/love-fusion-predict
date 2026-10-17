/**
 * GET /api/admin/live-stats
 *
 * Aggregated, non-PII stats for the broadcast display.
 * Does NOT require authentication (it exposes no PII — only counts).
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { entries, predictions, groups, teams } from "@/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { errorResponse } from "@/lib/api-helpers";

export const runtime = "edge";
export const revalidate = 30;

export async function GET(): Promise<NextResponse> {
  try {
    // Total entry count for most recent contest
    const [{ totalEntries }] = await db
      .select({ totalEntries: count(entries.id) })
      .from(entries);

    // Pick counts per team (across all predictions)
    const pickCounts = await db
      .select({
        teamId:    predictions.teamId1,
        pickCount: count(predictions.id),
      })
      .from(predictions)
      .groupBy(predictions.teamId1);

    // Also count teamId2 picks
    const pickCounts2 = await db
      .select({
        teamId:    predictions.teamId2,
        pickCount: count(predictions.id),
      })
      .from(predictions)
      .groupBy(predictions.teamId2);

    // Merge pick counts
    const countMap = new Map<string, number>();
    for (const row of [...pickCounts, ...pickCounts2]) {
      countMap.set(row.teamId, (countMap.get(row.teamId) ?? 0) + row.pickCount);
    }

    // Load teams + groups for display names
    const teamRows  = await db.select().from(teams);
    const groupRows = await db.select().from(groups);

    const topTeamsByGroup = (["A", "B", "C", "D"] as const).map((label) => {
      const group = groupRows.find((g) => g.label === label);
      if (!group) return { groupLabel: label, teams: [] };

      const teamsInGroup = teamRows
        .filter((t) => t.groupId === group.id)
        .map((t) => ({
          name:      t.name,
          pickCount: countMap.get(t.id) ?? 0,
          logoUrl:   t.logoUrl ?? null,
        }))
        .sort((a, b) => b.pickCount - a.pickCount);

      return { groupLabel: label, teams: teamsInGroup };
    });

    return NextResponse.json(
      {
        totalEntries,
        topTeamsByGroup,
      },
      {
        headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
      },
    );
  } catch (err) {
    console.error("[GET /api/admin/live-stats] Error:", err);
    return errorResponse("SERVER_ERROR", "Failed to load stats.", 500);
  }
}
