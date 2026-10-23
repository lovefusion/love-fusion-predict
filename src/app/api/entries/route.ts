/**
 * POST /api/entries
 *
 * Submit a new prediction entry.
 *
 * Body: EntrySubmissionPayload
 * Returns: EntrySubmissionResponse on success
 *
 * Validation:
 * - Contest must be in state "open"
 * - Entry deadline must not have passed
 * - Exactly 4 predictions, one per group A/B/C/D
 * - Each prediction must reference 2 distinct teams in the correct group
 * - Participant phone must not have an existing entry for this contest
 * - Rate limited: 30 submissions per IP per minute (high enough for a whole venue sharing one Wi-Fi)
 * - When OTP_ENABLED=true, a valid phone-verification token (otpToken) is required
 * - participantEmail is optional
 * - isPetParent (Yes/No) is asked on the form; stored after the entry is saved
 */

import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { contests, groups, teams, participants, entries, predictions, auditLog, phoneOtps } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { errorResponse, okResponse, isValidPhone, isValidName } from "@/lib/api-helpers";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isOtpEnabled, sha256Hex, OTP_TOKEN_TTL_MS } from "@/lib/otp";
import type { EntrySubmissionResponse } from "@/lib/types";

export const runtime = "edge";

const GROUP_LABELS = ["A", "B", "C", "D"] as const;

const EntrySchema = z.object({
  contestId:        z.string().min(1),
  participantName:  z.string().min(2).max(100),
  participantPhone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
  // Optional. An empty box is treated as "not given".
  participantEmail: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(254).email("Please enter a valid email address.").optional(),
  ),
  // Answer to the pet-parent question (the form makes it mandatory).
  isPetParent:      z.boolean().optional(),
  // Proof of phone verification (only checked when OTP_ENABLED=true).
  otpToken:         z.string().length(64).optional(),
  predictions: z
    .array(
      z.object({
        groupLabel: z.enum(["A", "B", "C", "D"]),
        teamId1:    z.string().min(1),
        teamId2:    z.string().min(1),
      }),
    )
    .length(4, "Exactly 4 predictions required"),
});

function generateReceiptCode(): string {
  // 4 blocks of 4 uppercase alphanumeric characters: XXXX-XXXX-XXXX-XXXX → stored without dashes
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/I/1 for readability
  let code = "";
  for (let i = 0; i < 16; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generatePrivateToken(): string {
  return nanoid(48);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const ip = getClientIp(request);
  if (!checkRateLimit(`entry:${ip}`, 30)) {
    return errorResponse("RATE_LIMITED", "Too many submissions. Please wait a minute.", 429);
  }

  // ── Parse & validate body ──────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_INPUT", "Request body must be valid JSON.", 400);
  }

  const parsed = EntrySchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message ?? "Invalid input";
    return errorResponse("INVALID_INPUT", firstError, 400);
  }

  const { contestId, participantName, participantPhone, participantEmail, isPetParent, otpToken, predictions: preds } = parsed.data;

  // ── Load contest ───────────────────────────────────────────────────────────
  const [contest] = await db
    .select()
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);

  if (!contest) {
    return errorResponse("CONTEST_NOT_FOUND", "Contest not found.", 404);
  }
  if (contest.state !== "open") {
    return errorResponse("CONTEST_NOT_OPEN", "This contest is not currently accepting entries.", 403);
  }
  const now = Date.now();
  if (contest.entryDeadline && now >= new Date(contest.entryDeadline).getTime()) {
    return errorResponse("DEADLINE_PASSED", "The entry deadline has passed.", 403);
  }

  // ── Load groups & teams ────────────────────────────────────────────────────
  const groupRows = await db.select().from(groups).where(eq(groups.contestId, contestId));
  const teamRows  = await db.select().from(teams).where(eq(teams.contestId, contestId));

  // Validate each prediction
  for (const pred of preds) {
    const group = groupRows.find((g) => g.label === pred.groupLabel);
    if (!group) {
      return errorResponse("INVALID_PREDICTIONS", `Group ${pred.groupLabel} not found.`, 400);
    }
    const teamsInGroup = teamRows.filter((t) => t.groupId === group.id);
    const teamIds = teamsInGroup.map((t) => t.id);
    if (!teamIds.includes(pred.teamId1)) {
      return errorResponse("INVALID_PREDICTIONS", `Team ${pred.teamId1} not in Group ${pred.groupLabel}.`, 400);
    }
    if (!teamIds.includes(pred.teamId2)) {
      return errorResponse("INVALID_PREDICTIONS", `Team ${pred.teamId2} not in Group ${pred.groupLabel}.`, 400);
    }
    if (pred.teamId1 === pred.teamId2) {
      return errorResponse("INVALID_PREDICTIONS", `Cannot pick the same team twice in Group ${pred.groupLabel}.`, 400);
    }
  }

  // Ensure exactly one prediction per group
  const predGroups = new Set(preds.map((p) => p.groupLabel));
  for (const g of GROUP_LABELS) {
    if (!predGroups.has(g)) {
      return errorResponse("INVALID_PREDICTIONS", `Missing prediction for Group ${g}.`, 400);
    }
  }

  // ── Duplicate check: same phone in this contest ────────────────────────────
  const existingParticipant = await db
    .select({ id: participants.id })
    .from(participants)
    .where(eq(participants.whatsapp, participantPhone))
    .limit(1);

  if (existingParticipant.length > 0) {
    // Check if they have an entry for THIS contest
    const existingEntry = await db
      .select({ id: entries.id })
      .from(entries)
      .where(
        and(
          eq(entries.participantId, existingParticipant[0].id),
          eq(entries.contestId, contestId),
        ),
      )
      .limit(1);

    if (existingEntry.length > 0) {
      return errorResponse(
        "DUPLICATE_ENTRY",
        "This mobile number has already been used to submit an entry for this contest.",
        409,
      );
    }
  }

  // ── Phone verification (only when OTP_ENABLED=true) ────────────────────────
  // The token comes from /api/otp/verify (or from /api/otp/send when WhatsApp failed on
  // our side and OTP_FAIL_OPEN lets the person through). It is claimed atomically so that
  // one verification can only ever produce one entry.
  let claimedOtpId: string | null = null;
  if (isOtpEnabled()) {
    if (!otpToken) {
      return errorResponse("OTP_REQUIRED", "Please verify your mobile number to submit.", 403);
    }
    const tokenHash = await sha256Hex(otpToken);
    const [otpRow] = await db
      .select()
      .from(phoneOtps)
      .where(
        and(
          eq(phoneOtps.tokenHash, tokenHash),
          eq(phoneOtps.phone, participantPhone),
          eq(phoneOtps.contestId, contestId),
        ),
      )
      .limit(1);

    const verifiedAtMs = otpRow?.verifiedAt ? new Date(otpRow.verifiedAt).getTime() : 0;
    if (!otpRow || !verifiedAtMs || now - verifiedAtMs > OTP_TOKEN_TTL_MS) {
      return errorResponse(
        "OTP_INVALID",
        "Your mobile verification has expired. Please verify again.",
        403,
      );
    }

    const claimed = await db
      .update(phoneOtps)
      .set({ consumedAt: new Date() })
      .where(and(eq(phoneOtps.id, otpRow.id), isNull(phoneOtps.consumedAt)))
      .returning({ id: phoneOtps.id });
    if (claimed.length === 0) {
      return errorResponse(
        "OTP_INVALID",
        "This verification was already used. Please verify again.",
        403,
      );
    }
    claimedOtpId = otpRow.id;
  }

  // ── Write to DB (participant → entry → predictions → audit) ───────────────
  const receiptCode    = generateReceiptCode();
  const privateToken   = generatePrivateToken();
  const submittedAt    = new Date();
  const participantId  = crypto.randomUUID();
  const entryId        = crypto.randomUUID();

  try {
    // Upsert participant
    let participantDbId: string;
    if (existingParticipant.length > 0) {
      participantDbId = existingParticipant[0].id;
    } else {
      await db.insert(participants).values({
        id:        participantId,
        contestId,
        fullName:  participantName.trim(),
        whatsapp:  participantPhone,
        email:     participantEmail ?? null,
      });
      participantDbId = participantId;
    }

    // Insert entry
    await db.insert(entries).values({
      id:            entryId,
      contestId,
      participantId: participantDbId,
      receiptCode,
      privateToken,
      submittedAt,
      ipAddress:     ip,
    });

    // Insert 4 predictions
    // Each prediction = 2 rows (one per team) since predictions.teamId is a single FK
    const predValues = preds.flatMap((pred) => {
      const group = groupRows.find((g) => g.label === pred.groupLabel)!;
      return [
{ id: crypto.randomUUID(), entryId, groupId: group.id, teamId: pred.teamId1 },
{ id: crypto.randomUUID(), entryId, groupId: group.id, teamId: pred.teamId2 },
      ];
    });
    await db.insert(predictions).values(predValues);

    // Pet-parent answer. Saved after the entry itself, so a problem here can never lose an entry.
    if (isPetParent !== undefined) {
      try {
        await db
          .update(participants)
          .set({ isPetParent })
          .where(eq(participants.id, participantDbId));
      } catch (err) {
        console.error("[POST /api/entries] could not save pet-parent answer:", err);
      }
    }

    // Audit log
    await db.insert(auditLog).values({
      contestId,
      entityType: "entry",
      entityId:   entryId,
      action:     "entry_submitted",
      details:    { phone: participantPhone.slice(-4), ip, phoneVerified: claimedOtpId !== null },
      occurredAt: submittedAt,
    });

    const response: EntrySubmissionResponse = {
      ok:              true,
      entryId,
      receiptCode,
      privateToken,
      participantName: participantName.trim(),
      submittedAt:     submittedAt.toISOString(),
    };

    return okResponse(response, 201);
  } catch (err) {
    console.error("[POST /api/entries] DB error:", err);
    // The entry was not saved, so give the verification back and let the person retry.
    if (claimedOtpId) {
      try {
        await db.update(phoneOtps).set({ consumedAt: null }).where(eq(phoneOtps.id, claimedOtpId));
      } catch {
        /* nothing more we can do; the person will be asked to verify again */
      }
    }
    return errorResponse("SERVER_ERROR", "Failed to save entry. Please try again.", 500);
  }
}
