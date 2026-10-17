/**
 * GET /api/admin/organizers
 * Returns active organizer accounts (id + displayName only).
 * Used by admin UI to populate operator dropdowns.
 * Auth: Bearer ADMIN_SECRET_KEY
 */

import { NextRequest } from "next/server";
import { db } from "@/db";
import { organizerAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { errorResponse, okResponse } from "@/lib/api-helpers";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) return auth.response;

  const rows = await db
    .select({
      id: organizerAccounts.id,
      displayName: organizerAccounts.displayName,
    })
    .from(organizerAccounts)
    .where(eq(organizerAccounts.isActive, true))
    .orderBy(organizerAccounts.displayName);

  return okResponse({ organizers: rows }, 200);
}
