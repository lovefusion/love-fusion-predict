/**
 * POST /api/pet-parent
 *
 * Saves the answer to the "Are you a pet parent?" popup shown after an entry is saved.
 *
 * Body: { token: string (the entry's private token), isPetParent: boolean }
 *
 * Stored on participants.is_pet_parent:  true = Yes, false = No, NULL = never answered.
 * The popup can be skipped, in which case this route is never called and the value stays NULL.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { entries, participants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { errorResponse, okResponse } from "@/lib/api-helpers";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "edge";

const PetParentSchema = z.object({
  token: z.string().min(40).max(64),
  isPetParent: z.boolean(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!checkRateLimit(`pet-parent:${ip}`, 20)) {
    return errorResponse("RATE_LIMITED", "Too many requests. Please wait a minute.", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_INPUT", "Request body must be valid JSON.", 400);
  }
  const parsed = PetParentSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("INVALID_INPUT", "Invalid request.", 400);
  }
  const { token, isPetParent } = parsed.data;

  const [entry] = await db
    .select({ participantId: entries.participantId })
    .from(entries)
    .where(eq(entries.privateToken, token))
    .limit(1);

  if (!entry) {
    return errorResponse("NOT_FOUND", "Entry not found.", 404);
  }

  try {
    await db
      .update(participants)
      .set({ isPetParent })
      .where(eq(participants.id, entry.participantId));
  } catch (err) {
    console.error("[POST /api/pet-parent] DB error:", err);
    return errorResponse("SERVER_ERROR", "Could not save your answer.", 500);
  }

  return okResponse({ ok: true });
}
