/**
 * POST /api/admin/contest/[id]/state
 * Transition contest to a new lifecycle state.
 *
 * Body: { to: ContestState, reason?: string, operatorId?: string }
 * Auth: Bearer ADMIN_SECRET_KEY
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { contests, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { errorResponse, okResponse } from "@/lib/api-helpers";

export const runtime = "edge";

type ContestState =
  | "draft" | "ready_for_review" | "published_not_open" | "open" | "closed"
  | "results_provisional" | "results_verified" | "scored" | "finalized"
  | "results_published" | "archived";

const VALID_TRANSITIONS: Record<ContestState, ContestState[]> = {
  draft: ["ready_for_review"],
  ready_for_review: ["published_not_open", "draft"],
  published_not_open: ["open", "draft"],
  open: ["closed"],
  closed: ["results_provisional"],
  results_provisional: ["results_verified", "closed"],
  results_verified: ["scored"],
  scored: ["finalized"],
  finalized: ["results_published"],
  results_published: ["archived"],
  archived: [],
};

const TransitionSchema = z.object({
  to: z.enum([
    "draft", "ready_for_review", "published_not_open", "open", "closed",
    "results_provisional", "results_verified", "scored", "finalized",
    "results_published", "archived",
  ] as const),
  reason: z.string().max(500).optional(),
  operatorId: z.string().uuid().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) return auth.response;

  const { id: contestId } = params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = TransitionSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      parsed.error.issues.map((i) => i.message).join(", "),
      400
    );
  }

  const { to, reason, operatorId } = parsed.data;

  const rows = await db
    .select({ id: contests.id, state: contests.state })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);

  if (rows.length === 0) {
    return errorResponse("NOT_FOUND", "Contest not found", 404);
  }

  const from = rows[0].state as ContestState;
  const allowed = VALID_TRANSITIONS[from] ?? [];

  if (!allowed.includes(to)) {
    return errorResponse(
      "VALIDATION_ERROR",
      `Cannot transition from "${from}" to "${to}". Allowed next states: [${allowed.join(", ") || "none"}]`,
      422
    );
  }

  const now = new Date();
  await db.update(contests).set({ state: to, updatedAt: now }).where(eq(contests.id, contestId));

  await db.insert(auditLog).values({
    contestId,
    organizerId: operatorId ?? null,
    action: "contest_state_changed",
    entityType: "contest",
    entityId: contestId,
    details: { from, to, reason: reason ?? null },
    occurredAt: now,
  });

  return okResponse({ contestId, from, to, transitionedAt: now.toISOString() }, 200);
}
