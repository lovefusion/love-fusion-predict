/**
 * Love Fusion Predict — Database Schema
 * Stack: Drizzle ORM + Neon PostgreSQL
 *
 * All monetary values stored as INTEGER PAISE (₹1 = 100 paise).
 * Prize pool: ₹11,000 = 1,100,000 paise.
 * Timestamps stored as TIMESTAMPTZ (UTC); always convert to IST for display.
 */

import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
  uuid,
  json,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const contestStateEnum = pgEnum("contest_state", [
  "draft",
  "ready_for_review",
  "published_not_open",
  "open",
  "closed",
  "results_provisional",
  "results_verified",
  "scored",
  "finalized",
  "results_published",
  "archived",
]);

export const groupLabelEnum = pgEnum("group_label", ["A", "B", "C", "D"]);

export const participantCategoryEnum = pgEnum("participant_category", [
  "franchise_owner",
  "captain",
  "player",
  "spectator",
  "other",
]);

export const auditActionEnum = pgEnum("audit_action", [
  // Contest lifecycle
  "contest_created",
  "contest_state_changed",
  "contest_deadline_updated",
  // Entries
  "entry_submitted",
  "entry_viewed",
  "entry_revoked",
  // Results
  "results_entered",
  "results_verified",
  "results_disputed",
  // Scoring
  "scoring_triggered",
  "scoring_completed",
  "prize_allocated",
  // Admin
  "admin_login",
  "admin_logout",
  "organizer_created",
  "organizer_deactivated",
  // Security
  "rate_limit_hit",
  "suspicious_activity",
]);

export const organizerRoleEnum = pgEnum("organizer_role", [
  "admin",       // Full access including scoring and state transitions
  "verifier",    // Can verify results but cannot initiate scoring
  "read_only",   // View-only access to admin dashboard
]);

// ─── Tables ────────────────────────────────────────────────────────────────────

/** The contest itself — one row for this tournament */
export const contests = pgTable("contests", {
  id:              uuid("id").primaryKey().defaultRandom(),
  name:            text("name").notNull(),
  slug:            varchar("slug", { length: 100 }).notNull().unique(),
  state:           contestStateEnum("state").notNull().default("draft"),
  entryDeadline:   timestamp("entry_deadline", { withTimezone: true }),
  prizePoolPaise:  integer("prize_pool_paise").notNull().default(1_100_000), // ₹11,000
  rulesMarkdown:   text("rules_markdown"),
  metaJson:        json("meta_json").$type<Record<string, unknown>>(),
  publishedAt:     timestamp("published_at", { withTimezone: true }),
  closedAt:        timestamp("closed_at", { withTimezone: true }),
  scoredAt:        timestamp("scored_at", { withTimezone: true }),
  finalizedAt:     timestamp("finalized_at", { withTimezone: true }),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Groups A / B / C / D */
export const groups = pgTable("groups", {
  id:         uuid("id").primaryKey().defaultRandom(),
  contestId:  uuid("contest_id").notNull().references(() => contests.id, { onDelete: "cascade" }),
  label:      groupLabelEnum("label").notNull(), // "A" | "B" | "C" | "D"
  courtInfo:  text("court_info"),               // e.g. "Courts 1 & 2"
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueGroupPerContest: uniqueIndex("uq_group_contest").on(t.contestId, t.label),
}));

/** Teams — one row per team per tournament */
export const teams = pgTable("teams", {
  id:             uuid("id").primaryKey().defaultRandom(),
  groupId:        uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  contestId:      uuid("contest_id").notNull().references(() => contests.id, { onDelete: "cascade" }),
  name:           text("name").notNull(),
  shortCode:      varchar("short_code", { length: 20 }), // e.g. "WBAG", "SM", "TH"
  seed:           integer("seed"),                       // 1–4 within the group
  ownerNames:     text("owner_names"),                   // e.g. "Atul Bansal"
  captainName:    text("captain_name"),
  captainPhone:   varchar("captain_phone", { length: 20 }),
  captainImageUrl: text("captain_image_url"),
  logoUrl:        text("logo_url"),                      // Cloudinary URL
  logoGdriveUrl:  text("logo_gdrive_url"),               // original GDrive link
  primaryColor:   varchar("primary_color", { length: 7 }),  // hex #RRGGBB
  accentColor:    varchar("accent_color", { length: 7 }),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueTeamInContest: uniqueIndex("uq_team_contest").on(t.contestId, t.name),
  idxGroupId:          index("idx_teams_group_id").on(t.groupId),
}));

/** Contest participants (people who enter the prediction) */
export const participants = pgTable("participants", {
  id:              uuid("id").primaryKey().defaultRandom(),
  contestId:       uuid("contest_id").notNull().references(() => contests.id, { onDelete: "cascade" }),
  fullName:        text("full_name").notNull(),
  whatsapp:        varchar("whatsapp", { length: 20 }).notNull(),
  email:           varchar("email", { length: 254 }),
  category:        participantCategoryEnum("category").notNull().default("spectator"),
  teamAffiliation: text("team_affiliation"),
  ipAddress:       varchar("ip_address", { length: 45 }), // stored for dedup; masked in UI
  userAgent:       text("user_agent"),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxContestId:  index("idx_participants_contest_id").on(t.contestId),
  idxWhatsapp:   index("idx_participants_whatsapp").on(t.whatsapp),
}));

/**
 * Prediction entries — one per participant per contest.
 * receiptCode: high-entropy, non-sequential, unique to each entry.
 * privateToken: used in the /entry/[token] personal link.
 */
export const entries = pgTable("entries", {
  id:            uuid("id").primaryKey().defaultRandom(),
  contestId:     uuid("contest_id").notNull().references(() => contests.id, { onDelete: "cascade" }),
  participantId: uuid("participant_id").notNull().references(() => participants.id, { onDelete: "cascade" }),
  receiptCode:   varchar("receipt_code", { length: 16 }).notNull().unique(), // e.g. "LF2-X4K9-R7M2"
  privateToken:  varchar("private_token", { length: 48 }).notNull().unique(), // high-entropy
  isRevoked:     boolean("is_revoked").notNull().default(false),
  revokedAt:     timestamp("revoked_at", { withTimezone: true }),
  revokedReason: text("revoked_reason"),
  submittedAt:   timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress:     varchar("ip_address", { length: 45 }),
}, (t) => ({
  uniqueParticipantEntry: uniqueIndex("uq_entry_participant_contest")
    .on(t.contestId, t.participantId),
  idxContestId:           index("idx_entries_contest_id").on(t.contestId),
  idxPrivateToken:        index("idx_entries_private_token").on(t.privateToken),
}));

/**
 * Individual team predictions — 8 rows per entry (2 per group × 4 groups).
 * teamId references the team the participant PREDICTED would qualify.
 */
export const predictions = pgTable("predictions", {
  id:       uuid("id").primaryKey().defaultRandom(),
  entryId:  uuid("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
  groupId:  uuid("group_id").notNull().references(() => groups.id),
  teamId:   uuid("team_id").notNull().references(() => teams.id),
}, (t) => ({
  uniquePrediction: uniqueIndex("uq_prediction_entry_team")
    .on(t.entryId, t.teamId),
  idxEntryId:       index("idx_predictions_entry_id").on(t.entryId),
  idxGroupId:       index("idx_predictions_group_id").on(t.groupId),
}));

/**
 * Official tournament results — entered by an organizer, verified by a second.
 * One row per group with the two qualifying team IDs.
 */
export const results = pgTable("results", {
  id:               uuid("id").primaryKey().defaultRandom(),
  contestId:        uuid("contest_id").notNull().references(() => contests.id, { onDelete: "cascade" }),
  groupId:          uuid("group_id").notNull().references(() => groups.id),
  qualifier1Id:     uuid("qualifier1_id").notNull().references(() => teams.id),
  qualifier2Id:     uuid("qualifier2_id").notNull().references(() => teams.id),
  // Verification workflow
  enteredBy:        uuid("entered_by").notNull().references(() => organizerAccounts.id),
  enteredAt:        timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
  verifiedBy:       uuid("verified_by").references(() => organizerAccounts.id), // second person
  verifiedAt:       timestamp("verified_at", { withTimezone: true }),
  isVerified:       boolean("is_verified").notNull().default(false),
  // Correction history
  correctionNote:   text("correction_note"), // if a result was corrected
  previousQ1Id:     uuid("previous_q1_id"),  // snapshot before correction
  previousQ2Id:     uuid("previous_q2_id"),
}, (t) => ({
  uniqueGroupResult: uniqueIndex("uq_result_group").on(t.contestId, t.groupId),
}));

/**
 * Per-entry scores — computed after all results verified.
 * groupScores: JSON object { A: 0|1, B: 0|1, C: 0|1, D: 0|1 }
 */
export const scores = pgTable("scores", {
  id:           uuid("id").primaryKey().defaultRandom(),
  contestId:    uuid("contest_id").notNull().references(() => contests.id, { onDelete: "cascade" }),
  entryId:      uuid("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
  totalScore:   integer("total_score").notNull(), // 0–4
  isPerfect:    boolean("is_perfect").notNull().default(false), // true if totalScore === 4
  groupScores:  json("group_scores").$type<{ A: 0|1; B: 0|1; C: 0|1; D: 0|1 }>().notNull(),
  computedAt:   timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueScorePerEntry: uniqueIndex("uq_score_entry").on(t.contestId, t.entryId),
  idxContestScore:     index("idx_scores_contest_perfect").on(t.contestId, t.isPerfect),
}));

/**
 * Prize allocation — immutable once written.
 * prizeAmountPaise must be a whole number.
 * Sum of all prizeAmountPaise for a contest must equal prizePoolPaise when winners > 0.
 * Residual paise (from integer division) goes to earliest-submitted entry.
 */
export const prizeAllocations = pgTable("prize_allocations", {
  id:                uuid("id").primaryKey().defaultRandom(),
  contestId:         uuid("contest_id").notNull().references(() => contests.id, { onDelete: "cascade" }),
  entryId:           uuid("entry_id").notNull().references(() => entries.id),
  participantId:     uuid("participant_id").notNull().references(() => participants.id),
  prizeAmountPaise:  integer("prize_amount_paise").notNull(), // MUST be integer
  isResidualHolder:  boolean("is_residual_holder").notNull().default(false),
  allocatedAt:       timestamp("allocated_at", { withTimezone: true }).notNull().defaultNow(),
  paymentStatus:     text("payment_status").notNull().default("pending"), // "pending"|"paid"|"disputed"
  paymentNote:       text("payment_note"),
  paymentAt:         timestamp("payment_at", { withTimezone: true }),
}, (t) => ({
  uniqueAllocation: uniqueIndex("uq_prize_entry").on(t.contestId, t.entryId),
}));

/** Organizer accounts — for admin dashboard access */
export const organizerAccounts = pgTable("organizer_accounts", {
  id:           uuid("id").primaryKey().defaultRandom(),
  email:        varchar("email", { length: 254 }).notNull().unique(),
  displayName:  text("display_name").notNull(),
  role:         organizerRoleEnum("role").notNull().default("read_only"),
  isActive:     boolean("is_active").notNull().default(true),
  lastLoginAt:  timestamp("last_login_at", { withTimezone: true }),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Audit log — IMMUTABLE append-only.
 * Never update or delete rows. Used for transparency and dispute resolution.
 */
export const auditLog = pgTable("audit_log", {
  id:            uuid("id").primaryKey().defaultRandom(),
  contestId:     uuid("contest_id").references(() => contests.id),
  organizerId:   uuid("organizer_id").references(() => organizerAccounts.id),
  action:        auditActionEnum("action").notNull(),
  entityType:    text("entity_type"),  // "entry" | "result" | "score" | etc.
  entityId:      uuid("entity_id"),
  details:       json("details").$type<Record<string, unknown>>(),
  ipAddress:     varchar("ip_address", { length: 45 }),
  occurredAt:    timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxContestAudit: index("idx_audit_contest_id").on(t.contestId),
  idxAction:       index("idx_audit_action").on(t.action),
  idxOccurredAt:   index("idx_audit_occurred_at").on(t.occurredAt),
}));

// ─── Relations ────────────────────────────────────────────────────────────────

export const contestsRelations = relations(contests, ({ many }) => ({
  groups:           many(groups),
  teams:            many(teams),
  participants:     many(participants),
  entries:          many(entries),
  results:          many(results),
  scores:           many(scores),
  prizeAllocations: many(prizeAllocations),
  auditLog:         many(auditLog),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  contest:     one(contests, { fields: [groups.contestId], references: [contests.id] }),
  teams:       many(teams),
  predictions: many(predictions),
  result:      many(results),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  group:       one(groups, { fields: [teams.groupId], references: [groups.id] }),
  contest:     one(contests, { fields: [teams.contestId], references: [contests.id] }),
  predictions: many(predictions),
}));

export const participantsRelations = relations(participants, ({ one, many }) => ({
  contest:          one(contests, { fields: [participants.contestId], references: [contests.id] }),
  entries:          many(entries),
  prizeAllocations: many(prizeAllocations),
}));

export const entriesRelations = relations(entries, ({ one, many }) => ({
  contest:         one(contests, { fields: [entries.contestId], references: [contests.id] }),
  participant:     one(participants, { fields: [entries.participantId], references: [participants.id] }),
  predictions:     many(predictions),
  score:           many(scores),
  prizeAllocation: many(prizeAllocations),
}));

export const predictionsRelations = relations(predictions, ({ one }) => ({
  entry: one(entries, { fields: [predictions.entryId], references: [entries.id] }),
  group: one(groups, { fields: [predictions.groupId], references: [groups.id] }),
  team:  one(teams,  { fields: [predictions.teamId],  references: [teams.id] }),
}));

export const resultsRelations = relations(results, ({ one }) => ({
  contest:    one(contests, { fields: [results.contestId], references: [contests.id] }),
  group:      one(groups,   { fields: [results.groupId], references: [groups.id] }),
  qualifier1: one(teams,    { fields: [results.qualifier1Id], references: [teams.id] }),
  qualifier2: one(teams,    { fields: [results.qualifier2Id], references: [teams.id] }),
  enteredBy:  one(organizerAccounts, { fields: [results.enteredBy], references: [organizerAccounts.id] }),
  verifiedBy: one(organizerAccounts, { fields: [results.verifiedBy], references: [organizerAccounts.id] }),
}));

export const scoresRelations = relations(scores, ({ one }) => ({
  contest: one(contests, { fields: [scores.contestId], references: [contests.id] }),
  entry:   one(entries,  { fields: [scores.entryId],   references: [entries.id] }),
}));

export const prizeAllocationsRelations = relations(prizeAllocations, ({ one }) => ({
  contest:     one(contests,     { fields: [prizeAllocations.contestId],     references: [contests.id] }),
  entry:       one(entries,      { fields: [prizeAllocations.entryId],       references: [entries.id] }),
  participant: one(participants, { fields: [prizeAllocations.participantId], references: [participants.id] }),
}));

export const organizerAccountsRelations = relations(organizerAccounts, ({ many }) => ({
  resultsEntered:   many(results, { relationName: "enteredBy" }),
  resultsVerified:  many(results, { relationName: "verifiedBy" }),
  auditLog:         many(auditLog),
}));

// ─── Type exports ─────────────────────────────────────────────────────────────

export type Contest            = typeof contests.$inferSelect;
export type NewContest         = typeof contests.$inferInsert;
export type Group              = typeof groups.$inferSelect;
export type NewGroup           = typeof groups.$inferInsert;
export type Team               = typeof teams.$inferSelect;
export type NewTeam            = typeof teams.$inferInsert;
export type Participant        = typeof participants.$inferSelect;
export type NewParticipant     = typeof participants.$inferInsert;
export type Entry              = typeof entries.$inferSelect;
export type NewEntry           = typeof entries.$inferInsert;
export type Prediction         = typeof predictions.$inferSelect;
export type NewPrediction      = typeof predictions.$inferInsert;
export type Result             = typeof results.$inferSelect;
export type NewResult          = typeof results.$inferInsert;
export type Score              = typeof scores.$inferSelect;
export type NewScore           = typeof scores.$inferInsert;
export type PrizeAllocation    = typeof prizeAllocations.$inferSelect;
export type NewPrizeAllocation = typeof prizeAllocations.$inferInsert;
export type OrganizerAccount   = typeof organizerAccounts.$inferSelect;
export type NewOrganizerAccount = typeof organizerAccounts.$inferInsert;
export type AuditLog           = typeof auditLog.$inferSelect;
export type ContestState       = Contest["state"];
export type GroupLabel         = "A" | "B" | "C" | "D";
export type GroupScore         = { A: 0|1; B: 0|1; C: 0|1; D: 0|1 };
