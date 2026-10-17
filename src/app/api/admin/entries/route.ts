/**
 * GET /api/admin/entries?contestId=xxx&page=1&limit=50
 * Returns paginated list of entries with PII-masked phone numbers (last 4 only).
 * Auth: Bearer ADMIN_SECRET_KEY
 */

import { NextRequest } from "next/server";
import { db } from "@/db";
import { entries, participants, predictions } from "@/db/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { errorResponse, okResponse } from "@/lib/api-helpers";
import { maskPhone } from "@/lib/utils";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const contestId = searchParams.get("contestId");
  if (!contestId) {
    return errorResponse("VALIDATION_ERROR", "contestId is required", 400);
  }

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10))
  );
  const offset = (page - 1) * limit;

  // Count total
  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(entries)
    .where(eq(entries.contestId, contestId));

  const total = Number(countRows[0]?.count ?? 0);

  // Load entries with participant info
  const rows = await db
    .select({
      entryId: entries.id,
      receiptCode: entries.receiptCode,
      submittedAt: entries.submittedAt,
      participantId: participants.id,
      participantName: participants.fullName,
      participantPhone: participants.whatsapp,
    })
    .from(entries)
    .innerJoin(participants, eq(entries.participantId, participants.id))
    .where(eq(entries.contestId, contestId))
    .orderBy(desc(entries.submittedAt))
    .limit(limit)
    .offset(offset);

  // Load prediction counts per entry (no contestId on predictions — filter by entryId)
  const entryIds = rows.map((r) => r.entryId);
  const predCounts =
    entryIds.length > 0
      ? await db
          .select({
            entryId: predictions.entryId,
            count: sql<number>`count(*)`,
          })
          .from(predictions)
          .where(inArray(predictions.entryId, entryIds))
          .groupBy(predictions.entryId)
      : [];

  const predCountByEntry = Object.fromEntries(
    predCounts.map((p) => [p.entryId, Number(p.count)])
  );

  const maskedEntries = rows.map((row) => ({
    entryId: row.entryId,
    receiptCode: row.receiptCode,
    submittedAt: row.submittedAt,
    participantId: row.participantId,
    participantName: row.participantName,
    // PII: show only last 4 digits of phone
    participantPhoneMasked: maskPhone(row.participantPhone),
    predictionCount: predCountByEntry[row.entryId] ?? 0,
  }));

  return okResponse(
    {
      contestId,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      entries: maskedEntries,
    },
    200
  );
}
