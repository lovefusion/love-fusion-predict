/**
 * GET /api/admin/audit-log?contestId=xxx&limit=100
 * Returns audit log entries for a contest (append-only, newest first).
 * Auth: Bearer ADMIN_SECRET_KEY
 */

import { NextRequest } from "next/server";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { errorResponse, okResponse } from "@/lib/api-helpers";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const contestId = searchParams.get("contestId");
  if (!contestId) {
    return errorResponse("VALIDATION_ERROR", "contestId is required", 400);
  }

  const limit = Math.min(
    500,
    Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10))
  );

  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      organizerId: auditLog.organizerId,
      details: auditLog.details,
      occurredAt: auditLog.occurredAt,
    })
    .from(auditLog)
    .where(eq(auditLog.contestId, contestId))
    .orderBy(desc(auditLog.occurredAt))
    .limit(limit);

  // details is already a JSON object (stored as jsonb)
  const logEntries = rows.map((row) => ({
    ...row,
    details: row.details ?? {},
  }));

  return okResponse({ contestId, log: logEntries }, 200);
}
