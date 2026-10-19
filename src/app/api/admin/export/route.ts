/**
 * GET /api/admin/export?type=entries|winners|consolation[&full=1]
 *
 * Downloads a CSV that opens directly in Excel.
 *   type=entries      every entry with its 8 picks (default)
 *   type=winners      entries with all 4 groups correct (jackpot) and their prize share
 *   type=consolation  entries with exactly 3 groups correct (T-shirt)
 *
 * Phone numbers are masked to the last 4 digits unless full=1 is passed
 * (needed only to contact winners). Requires the admin key header.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  contests, groups, teams, participants, entries, predictions, scores, prizeAllocations,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { errorResponse } from "@/lib/api-helpers";
import { formatPaise } from "@/lib/scoring";

export const runtime = "edge";

const GROUPS = ["A", "B", "C", "D"] as const;

/** Wrap a value for CSV and block spreadsheet formula injection (=, +, -, @). */
function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) return auth.response;

  const type = request.nextUrl.searchParams.get("type") ?? "entries";
  const full = request.nextUrl.searchParams.get("full") === "1";
  if (!["entries", "winners", "consolation"].includes(type)) {
    return errorResponse("INVALID_INPUT", "type must be entries, winners or consolation.", 400);
  }

  const [contest] = await db.select().from(contests).limit(1);
  if (!contest) return errorResponse("NOT_FOUND", "Contest not found.", 404);
  const contestId = contest.id;

  const groupRows = await db.select().from(groups).where(eq(groups.contestId, contestId));
  const teamRows = await db.select().from(teams).where(eq(teams.contestId, contestId));
  const labelByGroupId = Object.fromEntries(groupRows.map((g) => [g.id, g.label]));
  const teamName = Object.fromEntries(teamRows.map((t) => [t.id, t.name]));

  const entryRows = await db
    .select({
      entryId: entries.id,
      receiptCode: entries.receiptCode,
      submittedAt: entries.submittedAt,
      fullName: participants.fullName,
      whatsapp: participants.whatsapp,
      email: participants.email,
    })
    .from(entries)
    .innerJoin(participants, eq(entries.participantId, participants.id))
    .where(eq(entries.contestId, contestId));

  const predRows = await db
    .select({ entryId: predictions.entryId, groupId: predictions.groupId, teamId: predictions.teamId })
    .from(predictions)
    .innerJoin(entries, eq(predictions.entryId, entries.id))
    .where(eq(entries.contestId, contestId));

  const scoreRows = await db.select().from(scores).where(eq(scores.contestId, contestId));
  const prizeRows = await db.select().from(prizeAllocations).where(eq(prizeAllocations.contestId, contestId));
  const scoreByEntry = Object.fromEntries(scoreRows.map((s) => [s.entryId, s]));
  const prizeByEntry = Object.fromEntries(prizeRows.map((p) => [p.entryId, p]));

  const picks: Record<string, Record<string, string[]>> = {};
  for (const p of predRows) {
    const label = labelByGroupId[p.groupId];
    if (!label) continue;
    ((picks[p.entryId] ??= {})[label] ??= []).push(teamName[p.teamId] ?? "?");
  }

  const hasScores = scoreRows.length > 0;
  let rows = entryRows
    .slice()
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
  if (type === "winners") rows = rows.filter((r) => scoreByEntry[r.entryId]?.totalScore === 4);
  if (type === "consolation") rows = rows.filter((r) => scoreByEntry[r.entryId]?.totalScore === 3);

  const header = [
    "Receipt code", "Name", "Mobile", "Email", "Submitted (IST)",
    ...GROUPS.map((g) => `Group ${g} picks`),
    "Groups correct", "Prize",
  ];
  const lines = [header.map(csvCell).join(",")];

  for (const r of rows) {
    const sc = scoreByEntry[r.entryId];
    const pz = prizeByEntry[r.entryId];
    const prize = pz
      ? `Jackpot ${formatPaise(pz.prizeAmountPaise)}`
      : sc?.totalScore === 3 ? "T-shirt" : "";
    lines.push([
      r.receiptCode,
      r.fullName,
      full ? r.whatsapp : "******" + r.whatsapp.slice(-4),
      r.email ?? "",
      new Date(r.submittedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      ...GROUPS.map((g) => (picks[r.entryId]?.[g] ?? []).join(" + ")),
      hasScores ? (sc?.totalScore ?? "") : "not scored yet",
      prize,
    ].map(csvCell).join(","));
  }

  // BOM so Excel reads the file as UTF-8
  const body = "﻿" + lines.join("\r\n") + "\r\n";
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="love-fusion-${type}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
