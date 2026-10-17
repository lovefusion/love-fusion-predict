/**
 * Netlify Scheduled Function: scheduled-auto-close
 *
 * Fires at 04:00 UTC on 24 Oct 2026 (= 09:30 IST, 30 min before deadline).
 * Transitions the active contest from "open" → "closed" if the deadline has passed.
 *
 * Schedule is in netlify.toml: `schedule = "0 4 24 10 *"`
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { contests, auditLog } from "../../src/db/schema.js";
import { eq, and } from "drizzle-orm";
import type { Config } from "@netlify/functions";

export const config: Config = {
  schedule: "0 4 24 10 *",
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
        .set({ state: "closed", updatedAt: now })
        .where(eq(contests.id, contest.id));

      await db.insert(auditLog).values({
        entityType: "contest",
        entityId:   contest.id,
        action:     "state_transition",
        actorType:  "system",
        actorId:    "scheduled-auto-close",
        metadata:   JSON.stringify({
          from:       "open",
          to:         "closed",
          triggeredAt: now.toISOString(),
          reason:     "deadline_passed",
        }),
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
