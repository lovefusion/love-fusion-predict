import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "CONTEST_NOT_FOUND"
  | "CONTEST_NOT_OPEN"
  | "DEADLINE_PASSED"
  | "DUPLICATE_ENTRY"
  | "INVALID_PREDICTIONS"
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR";

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
): NextResponse {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export function okResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** Validate 10-digit Indian phone numbers */
export function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}

/** Validate a name: 2–100 chars, no special chars */
export function isValidName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 100;
}

/** Return ISO timestamp truncated to the second */
export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
