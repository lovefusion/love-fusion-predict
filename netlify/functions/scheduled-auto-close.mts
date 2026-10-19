/**
 * Netlify Scheduled Function: scheduled-auto-close
 *
 * Runs every 10 minutes from 24 to 26 Oct 2026. It closes the contest once the entry
 * deadline (25 Oct 00:00 IST) has passed. Safe to run repeatedly: it does nothing otherwise.
 * Transitions the active contest from "open" → "closed" if the deadline has passed.
 *
 * Schedule is in netlify.toml: `schedule = "*/10 * 24-26 10 *"`
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { contests, auditLog } from "../../src/db/schema.js";
import { eq, and } from "drizzle-orm";
import type { Config } from "@netlify/functions";

export const config: Config = {
  schedule: "*/10 * 24-26 10 *",
};

export default async function handler() {
  const sql = neon(process.env.DATABASE_URL!);
  const db  = drizzle(sql);

  try {
    const now = new Date();

    // Find contests in "open" state past their deadline
    const openContests = await db
      .select()
      .from(contests)
      .where(eq(contests.state, "open"));

    const toClose = openContests.filter(
      (c) => new Date(c.entryDeadline) <= now,
    );

    if (toClose.length === 0) {
      console.log("[auto-close] No contests to close at", now.toISOString());
      return { statusCode: 200, body: "No contests to close" };
    }

    for (const contest of toClose) {
      await db
        .update(contests)
        .set({ state: "closed", closedAt: now, updatedAt: now })
        .where(eq(contests.id, contest.id));

      await db.insert(auditLog).values({
        contestId:  contest.id,
        action:     "contest_state_changed",
        entityType: "contest",
        entityId:   contest.id,
        details:    {
          from:        "open",
          to:          "closed",
          triggeredAt: now.toISOString(),
          reason:      "deadline_passed",
          actor:       "scheduled-auto-close",
        },
        occurredAt: now,
      });

      console.log(`[auto-close] Closed contest ${contest.id} ("${contest.name}")`);
    }

    return {
      statusCode: 200,
      body: `Closed ${toClose.length} contest(s)`,
    };
  } catch (err) {
    console.error("[auto-close] Error:", err);
    return { statusCode: 500, body: "Error closing contests" };
  }
}
