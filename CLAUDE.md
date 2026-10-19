# Love Fusion Predict — CLAUDE.md

Project: **Love Fusion Badminton League – Season 2 "Predict the Top 2"**  
Owner: Nidhi Hegde — Mowgly Ventures, Vadodara  
Tournament: 24–25 October 2026  
Stack: Next.js 14 (App Router) + Netlify (paid) + Neon PostgreSQL + Drizzle ORM + Cloudinary

---

## ⚠️ ABSOLUTE CONSTRAINTS — NEVER VIOLATE

1. **No Google Forms. No Google Sheets.** Under no circumstances are these used as a data store, entry path, scoring engine, or admin workflow. Not even as a fallback or export target.
2. **No secrets in source code.** All secrets live in Netlify environment variables. Never commit `.env` files with real values.
3. **Integer paise only.** All monetary values stored and computed as integers (paise = rupees × 100). Never use floating point for money.
4. **Two-person verification for results.** Official qualifiers must be entered by one organizer and verified by a second before scoring can run.
5. **Immutable audit log.** The `audit_log` table is append-only. Never UPDATE or DELETE from it.
6. **PII masking on read.** Phone numbers shown in admin UI: last 4 digits only. Never expose full phones in broadcast display or public routes.

---

## Contest Logic

- **16 teams**, 4 groups (A/B/C/D), 4 teams each
- Predict the **top 2 qualifiers** per group (order irrelevant — set equality)
- **Scoring**: 1 point per correct group. **4/4** earns the jackpot; **exactly 3/4** earns a Love Fusion T-shirt (no cash). 2 or fewer earns nothing.
- **Prize**: ₹11,000 (= 1,100,000 paise) split equally among winners.
  - Residual paise → earliest submittedAt, then lex-smallest entryId as tie-break.
  - `calculatePrize()` in `src/lib/scoring.ts` is the canonical implementation.
- **Entry deadline**: stored in the database (`contests.entry_deadline`), currently 2026-10-24T18:30:00Z (= 25 Oct 2026, 00:00 IST). The `CONTEST_ENTRY_DEADLINE` env var is NOT used by the code.

## Team Groups (DO NOT CHANGE WITHOUT CHECKING TOURNAMENT SCHEDULE)

| Group | Team | Owner(s) | Captain |
|---|---|---|---|
| A | Wonder Boys and Girls | Atul Bansal / Chirayu Shastri | (from seed) |
| A | Surat Masters | Pravin Sharma / Mohamad Salman | |
| A | Team Heartlink | Rupal Mehta / Nikunj Devda | |
| A | Team SVC Rocks | Jayesh Bhalawala + Tushar Kadam / Aamir Sumra | |
| B | Shuttle Smashers | Thiruvelluvalam / Rajesh Nimkar | |
| B | Love Baddy | Nimish Desai / Chetan Gohil | |
| B | Shakti Sports | Jignesh Pathak / Jatin Sarvaiya | |
| B | Dhurandhar Baddies | Siddharth Soneji + Atulkaka / Kuntal Manvar | |
| C | Dreams and Ideas | Mitesh Shah / Vivek Ojha | |
| C | Diamond Sports Studio | Ankur Acharya / Akash Kulkarni | |
| C | Sapphire Wolves | Vidhi Mehta-Sapphire / Bhavin Jadav | |
| C | Ramasya Yoddhaha | Gaurav Bhatt / Ayush Rawat | |
| D | Rudraveer | Rahul + Neal Patel + Milan Pandya / Tejas Shah | |
| D | V S Blasters | Aleem Sharfi / Kevin Somaiya | |
| D | GP Life and Wellness | Chitrak Desai / Mohsin Sumra | |
| D | T-Smash | Hardik Patel + Kumar Chauhan + Sylvester / Hareeit Vasavda | |

---

## 4 Surfaces

| Path | Purpose | Auth |
|---|---|---|
| `/predict` | Public — participant entry | None |
| `/entry/[token]` | Private — receipt + scores | 48-char token in URL |
| `/live` | Broadcast display (16:9) | None (no PII shown) |
| `/admin` | Admin dashboard | ADMIN_SECRET_KEY header |

---

## 11 Contest Lifecycle States

```
draft → ready_for_review → published_not_open → open → closed
     → results_provisional → results_verified → scored
     → finalized → results_published → archived
```

State transitions are admin-only. Scoring only runs after `results_verified`.

---

## Directory Structure

```
src/
  app/                    # Next.js App Router pages
    predict/              # Public entry flow
    entry/[token]/        # Private receipt
    live/                 # Broadcast display
    admin/                # Admin dashboard (Task 7)
    api/
      contest/active/     # GET — public contest + teams
      entries/            # POST — submit prediction
      entry/[token]/      # GET — receipt lookup
      admin/
        live-stats/       # GET — aggregate stats (no PII)
  db/
    schema.ts             # Drizzle schema (canonical source of truth)
    index.ts              # DB connection
  lib/
    scoring.ts            # Pure scoring engine — NO side effects
    types.ts              # Shared TypeScript types
    utils.ts              # Formatting & utilities
    rate-limit.ts         # In-memory rate limiter
    api-helpers.ts        # Response helpers, validation
  components/
    ui/                   # Button, Card, Badge, Input, Spinner
    contest/              # TeamCard, GroupPredictionPanel
scripts/
  seed.ts                 # One-time DB seed (16 teams, 1 admin)
netlify/
  functions/
    scheduled-auto-close.mts   # Auto-close at entry deadline
```

---

## Key Commands

```bash
npm install          # Install dependencies (run once locally)
npm run dev          # Start dev server
npm run db:push      # Push schema to Neon (dev only — use migrate in prod)
npm run db:migrate   # Run migrations
npm run db:seed      # Seed 16 teams + admin account
npm run db:studio    # Open Drizzle Studio
npm test             # Run Vitest unit tests
npm run type-check   # TypeScript check (no emit)
npm run build        # Production build
```

---

## Environment Variables (set in Netlify UI)

```
DATABASE_URL                         # Neon pooled connection string
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME    # Cloudinary cloud name
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
ADMIN_SECRET_KEY                     # Bearer token for /admin endpoints
ADMIN_EMAILS                         # needhihegde@gmail.com,... (comma-separated)
CONTEST_ENTRY_DEADLINE               # (unused - the deadline lives in the DB)
CONTEST_PRIZE_POOL_PAISE             # 1100000
CRON_SECRET                          # Validate scheduled function calls
OTP_ENABLED                          # "true" = require WhatsApp OTP; anything else = OFF
OTP_FAIL_OPEN                        # "false" = block entries if WhatsApp cannot send; default = let people through
WHATSAPP_ACCESS_TOKEN                # Meta permanent token (secret - Netlify only)
WHATSAPP_PHONE_NUMBER_ID             # Meta phone number ID
WHATSAPP_OTP_TEMPLATE                # approved authentication template name (default lf_otp)
WHATSAPP_OTP_LANG                    # template language (default en)
N8N_WEBHOOK_URL                      # Optional: post-submission notification (not wired up)
N8N_WEBHOOK_SECRET                   # Optional
NEXT_PUBLIC_BASE_URL                 # https://your-domain.netlify.app
```

---

## What's DONE

- [x] DB schema (Drizzle, Neon PostgreSQL)
- [x] Seed script (16 teams, groups, 1 admin)
- [x] Scoring engine — `src/lib/scoring.ts`
- [x] Scoring unit tests — `src/lib/scoring.test.ts` (23 test cases)
- [x] App shell (layout, globals.css, fonts)
- [x] UI components (Button, Card, Badge, Input, Spinner)
- [x] Contest components (TeamCard, GroupPredictionPanel)
- [x] `/predict` — 4-step participant entry flow
- [x] `/entry/[token]` — private receipt + scores view
- [x] `/live` — 16:9 broadcast display
- [x] API: `GET /api/contest/active`
- [x] API: `POST /api/entries` (rate-limited, validated, duplicate-check)
- [x] API: `GET /api/entry/[token]` (PII-safe)
- [x] API: `GET /api/admin/live-stats`
- [x] `netlify.toml` with security headers + scheduled function
- [x] Netlify scheduled function for auto-close at deadline
- [x] `tailwind.config.ts` — full design system (gold/obsidian/white)

## What's REMAINING

- [ ] Cloudinary upload script for team logos
- [ ] `src/app/error.tsx` and `src/app/not-found.tsx`
- [ ] End-to-end test for the entry submission flow (`src/app/api/entries/route.test.ts`)
- [ ] Add second organizer account to DB (required for two-person verification)
- [ ] Set all Netlify environment variables (see list above)
- [ ] Smoke test full end-to-end flow on production

## What's DONE (updated)

- [x] DB schema (Drizzle, Neon PostgreSQL)
- [x] Seed script (16 teams, groups, 1 admin)
- [x] Scoring engine — `src/lib/scoring.ts`
- [x] Scoring unit tests — `src/lib/scoring.test.ts` (23 test cases)
- [x] App shell (layout, globals.css, fonts)
- [x] UI components (Button, Card, Badge, Input, Spinner)
- [x] Contest components (TeamCard, GroupPredictionPanel)
- [x] `/predict` — 4-step participant entry flow
- [x] `/entry/[token]` — private receipt + scores view
- [x] `/live` — 16:9 broadcast display
- [x] API: `GET /api/contest/active`
- [x] API: `POST /api/entries` (rate-limited, validated, duplicate-check, correct column names)
- [x] API: `GET /api/entry/[token]` (PII-safe)
- [x] API: `GET /api/admin/live-stats`
- [x] API: `GET /api/admin/entries` (paginated, PII-masked, correct schema)
- [x] API: `POST /api/admin/results` (two-person enter/verify, qualifier1Id/qualifier2Id)
- [x] API: `POST /api/admin/score` (joins predictions via entries, prizeAmountPaise, PrizeSummary)
- [x] API: `GET /api/admin/prizes` (prizeAmountPaise, fullName/whatsapp)
- [x] API: `GET /api/admin/audit-log` (occurredAt/details/entityType/entityId/organizerId)
- [x] API: `GET /api/admin/organizers` (for admin UI dropdowns)
- [x] API: `GET /api/admin/contest/[id]/state` (lifecycle transitions)
- [x] Admin dashboard (`/admin`) — OrganizerSelect dropdown, two-person verification UI
- [x] `netlify.toml` with security headers + scheduled function
- [x] Netlify scheduled function for auto-close at deadline
- [x] `tailwind.config.ts` — full design system (gold/obsidian/white)

---

## Phone verification (WhatsApp OTP) + extra fields

- Flow: `/api/otp/send` -> WhatsApp code -> `/api/otp/verify` -> one-time `otpToken` -> `POST /api/entries`.
- Off by default. Turn on with `OTP_ENABLED=true` (then trigger a new Netlify deploy).
- Codes and tokens are stored hashed in `phone_otps`; 5 wrong tries per code; 30 s resend gap; 4 codes per phone per 10 min.
- If WhatsApp fails on OUR side (app not live, template not approved, bad token) and `OTP_FAIL_OPEN` is not "false", the person is let through and the `phone_otps` row is marked `method = 'bypass'`.
- Email is optional (`participants.email`). Pet-parent answer is `participants.is_pet_parent` (NULL = not answered, true = Yes, false = No), saved by `POST /api/pet-parent` from the popup shown after the entry is saved.
- Code: `src/lib/otp.ts`, `src/app/api/otp/*`, `src/app/api/pet-parent/route.ts`.

---

## Security Notes

- Admin routes verify `Authorization: Bearer $ADMIN_SECRET_KEY` header server-side.
- Rate limiting is in-memory per-instance. For multi-instance, upgrade to Redis.
- Duplicate entries: blocked by phone+contestId uniqueness check.
- PII never appears in broadcast display, audit log metadata uses last-4 only.
- `privateToken` is 48 chars of nanoid (≈ 287 bits of entropy).
- `receiptCode` is 16 uppercase alphanumeric (no 0/O/I/1), human-readable.
