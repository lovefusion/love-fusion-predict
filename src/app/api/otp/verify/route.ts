/**
 * POST /api/otp/verify
 *
 * Checks the 6-digit code the person typed.
 *
 * Body: { contestId: string, phone: string, code: string (6 digits) }
 * Success: { ok: true, otpToken: string }  (the token is sent along with the entry)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { phoneOtps } from "@/db/schema";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { errorResponse, okResponse } from "@/lib/api-helpers";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  isOtpEnabled,
  generateToken,
  hashOtpCode,
  sha256Hex,
  constantTimeEqual,
  OTP_MAX_ATTEMPTS,
} from "@/lib/otp";

export const runtime = "edge";

const VerifySchema = z.object({
  contestId: z.string().min(1),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isOtpEnabled()) {
    return okResponse({ ok: true, otpRequired: false });
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(`otp-verify:${ip}`, 20)) {
    return errorResponse("RATE_LIMITED", "Too many attempts. Please wait a minute.", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_INPUT", "Request body must be valid JSON.", 400);
  }
  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("INVALID_INPUT", parsed.error.errors[0]?.message ?? "Invalid input", 400);
  }
  const { contestId, phone, code } = parsed.data;

  // The most recent code that was actually sent to this number and is not yet verified.
  const [row] = await db
    .select()
    .from(phoneOtps)
    .where(
      and(
        eq(phoneOtps.phone, phone),
        eq(phoneOtps.contestId, contestId),
        eq(phoneOtps.method, "whatsapp"),
        isNull(phoneOtps.verifiedAt),
      ),
    )
    .orderBy(desc(phoneOtps.createdAt))
    .limit(1);

  if (!row) {
    return errorResponse("OTP_INVALID", "No active code for this number. Please request a new code.", 400);
  }
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    return errorResponse("OTP_INVALID", "This code has expired. Please request a new code.", 400);
  }

  // Count the attempt BEFORE comparing, and only while attempts are below the limit.
  // Doing it in one UPDATE stops parallel requests from sneaking extra guesses in.
  const claimed = await db
    .update(phoneOtps)
    .set({ attempts: sql`${phoneOtps.attempts} + 1` })
    .where(and(eq(phoneOtps.id, row.id), lt(phoneOtps.attempts, OTP_MAX_ATTEMPTS)))
    .returning({ attempts: phoneOtps.attempts });

  if (claimed.length === 0) {
    return errorResponse(
      "OTP_INVALID",
      "Too many wrong attempts. Please request a new code.",
      429,
    );
  }

  const expected = row.codeHash;
  const actual = await hashOtpCode(row.id, code);
  if (!constantTimeEqual(expected, actual)) {
    const left = Math.max(0, OTP_MAX_ATTEMPTS - claimed[0].attempts);
    return errorResponse(
      "OTP_INVALID",
      left > 0
        ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`
        : "Incorrect code. Please request a new code.",
      400,
    );
  }

  const token = generateToken();
  try {
    await db
      .update(phoneOtps)
      .set({ verifiedAt: new Date(), tokenHash: await sha256Hex(token) })
      .where(eq(phoneOtps.id, row.id));
  } catch (err) {
    console.error("[POST /api/otp/verify] DB error:", err);
    return errorResponse("SERVER_ERROR", "Could not verify right now. Please try again.", 500);
  }

  return okResponse({ ok: true, otpToken: token });
}
