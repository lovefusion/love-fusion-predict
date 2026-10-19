/**
 * Shared TypeScript types for the Love Fusion Predict application.
 * These are the "view model" types used across API responses and UI components.
 */

// ─── Domain Types ──────────────────────────────────────────────────────────────

export type GroupLabel = "A" | "B" | "C" | "D";

export type ContestState =
  | "draft"
  | "ready_for_review"
  | "published_not_open"
  | "open"
  | "closed"
  | "results_provisional"
  | "results_verified"
  | "scored"
  | "finalized"
  | "results_published"
  | "archived";

// ─── API Response Shapes ────────────────────────────────────────────────────────

export interface TeamSummary {
  id: string;
  name: string;
  groupLabel: GroupLabel;
  ownerNames: string;
  captainName: string | null;
  logoUrl: string | null;
  captainImageUrl: string | null;
}

export interface GroupSummary {
  label: GroupLabel;
  teams: TeamSummary[];
}

export interface ContestPublicInfo {
  id: string;
  name: string;
  state: ContestState;
  entryDeadline: string;        // ISO 8601
  prizePoolPaise: number;
  groups: GroupSummary[];
  isOpen: boolean;
  isDeadlinePassed: boolean;
}

// ─── Entry Submission ──────────────────────────────────────────────────────────

export interface PredictionInput {
  groupLabel: GroupLabel;
  teamId1: string;
  teamId2: string;
}

export interface EntrySubmissionPayload {
  contestId: string;
  participantName: string;
  participantPhone: string;
  participantEmail?: string;          // optional
  otpToken?: string;                  // from /api/otp/verify, only when OTP is switched on
  predictions: PredictionInput[];     // exactly 4, one per group
}

export interface EntrySubmissionResponse {
  ok: true;
  entryId: string;
  receiptCode: string;               // 16-char uppercase alphanumeric
  privateToken: string;              // 48-char for /entry/[token]
  participantName: string;
  submittedAt: string;
}

// ─── Receipt / Private Entry View ──────────────────────────────────────────────

export interface EntryReceiptView {
  entryId: string;
  receiptCode: string;
  participantName: string;
  submittedAt: string;
  predictions: {
    groupLabel: GroupLabel;
    team1Name: string;
    team2Name: string;
  }[];
  scores?: {
    groupLabel: GroupLabel;
    score: 0 | 1;
  }[];
  totalScore?: number;
  isPerfect?: boolean;
  prizeAmountPaise?: number;
  contestState: ContestState;
}

// ─── API Errors ────────────────────────────────────────────────────────────────

export interface ApiError {
  ok: false;
  code: string;
  message: string;
}
