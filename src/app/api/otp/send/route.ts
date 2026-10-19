/**
 * POST /api/otp/send
 *
 * Sends a 6-digit verification code to the participant's WhatsApp.
 *
 * Body: { contestId: string, phone: string (10-digit Indian mobile) }
 *
 * Responses:
 *   { ok: true, otpRequired: false }                    OTP switched off (OTP_ENABLED != "true")
 *   { ok: true, otpRequired: true, ... }                code sent, ask the person to type it
 *   { ok: true, otpRequired: false, otpToken: "..." }   WhatsApp failed on our side and
 *                                                       OTP_FAIL_OPEN allows the entry through
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contests, participants, entries, phoneOtps } from "@/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { errorResponse, okResponse } from "@/lib/api-helpers";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  isOtpEnabled,
  isOtpFailOpen,
  generateOtpCode,
  generateToken,
  hashOtpCode,
  sha256Hex,
  sendWhatsAppOtp,
  OTP_TTL_MS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_SEND_WINDOW_MS,
  OTP_MAX_SENDS_PER_WINDOW,
} from "@/lib/otp";

export const runtime = "edge";

const SendSchema = z.object({
  contestId: z.string().min(1),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // OTP switched off: nothing to do, the form submits directly.
  if (!isOtpEnabled()) {
    return okResponse({ ok: true, otpRequired: false });
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(`otp-send:${ip}`, 10)) {
    return errorResponse("RATE_LIMITED", "Too many requests. Please wait a minute.", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_INPUT", "Request body must be valid JSON.", 400);
  }
  const parsed = SendSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("INVALID_INPUT", parsed.error.errors[0]?.message ?? "Invalid input", 400);
  }
  const { contestId, phone } = parsed.data;

  // Only send codes while the contest is genuinely accepting entries.
  const [contest] = await db.select().from(contests).where(eq(contests.id, contestId)).limit(1);
  if (!contest) return errorResponse("CONTEST_NOT_FOUND", "Contest not found.", 404);
  if (contest.state !== "open") {
    return errorResponse("CONTEST_NOT_OPEN", "This contest is not currently accepting entries.", 403);
  }
  if (contest.entryDeadline && Date.now() >= new Date(contest.entryDeadline).getTime()) {
    return errorResponse("DEADLINE_PASSED", "The entry deadline has passed.", 403);
  }

  // Do not spend a WhatsApp message on a number that already has an entry.
  const existingParticipants = await db
    .select({ id: participants.id })
    .from(participants)
    .where(eq(participants.whatsapp, phone));
  for (const p of existingParticipants) {
    const existingEntry = await db
      .select({ id: entries.id })
      .from(entries)
      .where(and(eq(entries.participantId, p.id), eq(entries.contestId, contestId)))
      .limit(1);
    if (existingEntry.length > 0) {
      return errorResponse(
        "DUPLICATE_ENTRY",
        "This mobile number has already been used to submit an entry for this contest.",
        409,
      );
    }
  }

  // Per-phone limits: a short cooldown and a cap per 10 minutes.
  const now = Date.now();
  const recent = await db
    .select({ createdAt: phoneOtps.createdAt })
    .from(phoneOtps)
    .where(
      and(
        eq(phoneOtps.phone, phone),
        eq(phoneOtps.contestId, contestId),
        gte(phoneOtps.createdAt, new Date(now - OTP_SEND_WINDOW_MS)),
      ),
    )
    .orderBy(desc(phoneOtps.createdAt));

  if (recent.length >= OTP_MAX_SENDS_PER_WINDOW) {
    return errorResponse(
      "RATE_LIMITED",
      "Too many codes requested for this number. Please try again in 10 minutes.",
      429,
    );
  }
  if (recent.length > 0 && now - new Date(recent[0].createdAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
    return errorResponse(
      "RATE_LIMITED",
      "Please wait 30 seconds before asking for another code.",
      429,
    );
  }

  // Create the code (stored hashed) and send it.
  const rowId = crypto.randomUUID();
  const code = generateOtpCode();
  const codeHash = await hashOtpCode(rowId, code);

  try {
    await db.insert(phoneOtps).values({
      id: rowId,
      contestId,
      phone,
      codeHash,
      method: "whatsapp",
      expiresAt: new Date(now + OTP_TTL_MS),
      ipAddress: ip,
    });
  } catch (err) {
    console.error("[POST /api/otp/send] DB error:", err);
    return errorResponse("SERVER_ERROR", "Could not start verification. Please try again.", 500);
  }

  const result = await sendWhatsAppOtp(phone, code);

  if (result.ok) {
    return okResponse({
      ok: true,
      otpRequired: true,
      expiresInSec: Math.floor(OTP_TTL_MS / 1000),
      resendAfterSec: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
    });
  }

  // The number itself cannot receive WhatsApp messages: tell the person.
  if (result.userSide) {
    return errorResponse(
      "OTP_SEND_FAILED",
      "We could not send a code to this number on WhatsApp. Please check the number and make sure it is on WhatsApp.",
      422,
    );
  }

  // Problem on our side (token, template not approved, app not live yet, Meta outage...).
  // Never log the code or the token; log only the reason.
  console.error("[POST /api/otp/send] WhatsApp send failed:", result.metaCode ?? "", result.detail);

  if (!isOtpFailOpen()) {
    return errorResponse(
      "OTP_SEND_FAILED",
      "We could not send the verification code right now. Please try again in a few minutes.",
      503,
    );
  }

  // Fail open: let this person continue without a code, and mark the row as a bypass.
  const token = generateToken();
  try {
    await db
      .update(phoneOtps)
      .set({
        method: "bypass",
        verifiedAt: new Date(),
        tokenHash: await sha256Hex(token),
      })
      .where(eq(phoneOtps.id, rowId));
  } catch (err) {
    console.error("[POST /api/otp/send] DB error (bypass):", err);
    return errorResponse("SERVER_ERROR", "Could not start verification. Please try again.", 500);
  }
  return okResponse({ ok: true, otpRequired: false, otpToken: token });
}
