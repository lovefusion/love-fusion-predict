/**
 * Admin authentication helpers.
 * All admin routes require: Authorization: Bearer <ADMIN_SECRET_KEY>
 * ADMIN_SECRET_KEY is set in Netlify environment variables — never in source.
 */

import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/api-helpers";

export function verifyAdminAuth(
  request: NextRequest
): { ok: true } | { ok: false; response: ReturnType<typeof errorResponse> } {
  const adminKey = process.env.ADMIN_SECRET_KEY;

  if (!adminKey) {
    // Misconfigured — reject all admin requests rather than allowing open access
    return {
      ok: false,
      response: errorResponse(
        "SERVER_ERROR",
        "Admin authentication is not configured",
        503
      ),
    };
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      response: errorResponse(
        "UNAUTHORIZED",
        "Missing or malformed Authorization header",
        401
      ),
    };
  }

  const token = authHeader.slice("Bearer ".length);
  // Use timing-safe comparison to avoid timing attacks
  if (!timingSafeEqual(token, adminKey)) {
    return {
      ok: false,
      response: errorResponse("UNAUTHORIZED", "Invalid admin key", 401),
    };
  }

  return { ok: true };
}

/**
 * Timing-safe string comparison to prevent timing attacks on the admin key.
 * Runs in constant time regardless of where the strings differ.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
