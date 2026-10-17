/**
 * Love Fusion Predict — Database Seed Script
 *
 * Seeds the staging database with:
 *  - 1 contest (Love Fusion Badminton League – 2)
 *  - 4 groups (A, B, C, D)
 *  - 16 teams with owner + captain data from Excel files
 *
 * Run: npm run db:seed
 * Requires: DATABASE_URL in .env.local (staging DB only!)
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Did you forget .env.local?");
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

// ─── Contest Data ────────────────────────────────────────────────────────────

const CONTEST = {
  name:           "Love Fusion Badminton League – 2",
  slug:           "lfbl-2-2026",
  state:          "draft" as const,
  prizePoolPaise: 1_100_000, // ₹11,000 in paise
  entryDeadline:  new Date("2026-10-24T04:30:00Z"), // 10:00 AM IST = 04:30 UTC
  rulesMarkdown: `
## Love Fusion Badminton League – 2 | Predict the Top 2

**Prize:** ₹11,000 jackpot

### How to Enter
1. Select exactly **two teams** that you believe will qualify from each of the four groups (A, B, C, D).
2. Submit your entry before **24 October 2026 at 10:00 AM IST** (30 minutes before the first league match).
3. One entry per person. No changes after submission.

### Scoring
- You earn **1 point** for each group where both your selected teams qualify.
- Maximum score: **4 points**.
- Only a **perfect 4/4 prediction** wins the jackpot.

### Prize Sharing
- **0 correct:** No payout — jackpot is retained.
- **1 or more perfect:** ₹11,000 split equally among all perfect entries.
- Order of selection within a group does not matter.

### Official Qualifiers
The top 2 teams from each group stage determine the official results. In case of tied standings, tournament tie-break rules apply.

### Contact
WhatsApp: +91-XXXXXXXXXX | Email: predict@lovefusion.in
`.trim(),
};

// ─── Groups ───────────────────────────────────────────────────────────────────

const GROUPS = [
  { label: "A" as const, courtInfo: "Courts 1 & 2" },
  { label: "B" as const, courtInfo: "Courts 3 & 4" },
  { label: "C" as const, courtInfo: "Courts 5 & 6" },
  { label: "D" as const, courtInfo: "Courts 7 & 8" },
];

// ─── Teams ────────────────────────────────────────────────────────────────────
// Source: Tournament schedule images (group/seed) + Team_Owners.xlsx (logo, owner) + Captains template (captain)

const TEAMS_BY_GROUP: Record<string, Array<{
  name:            string;
  shortCode:       string;
  seed:            number;
  ownerNames:      string;
  captainName?:    string;
  captainPhone?:   string;
  captainImageUrl?: string;
  logoGdriveUrl?:  string;
}>> = {
  A: [
    {
      name:            "Wonder Boys and Girls",
      shortCode:       "WBAG",
      seed:            1,
      ownerNames:      "Atul Bansal",
      captainName:     "Chirayu Shastri",
      captainPhone:    "+919409239373",
      captainImageUrl: "https://drive.google.com/open?id=1NphE_MRwD9GOReX0wlZGa0A6buCDSf8Y",
      logoGdriveUrl:   "https://drive.google.com/file/d/1PGpLPXvPJIK0uhJwE2EZZQd7wH2FC3q4/view?usp=drive_link",
    },
    {
      name:            "Surat Masters",
      shortCode:       "SM",
      seed:            2,
      ownerNames:      "Pravin Sharma",
      captainName:     "Mohamad Salman",
      captainPhone:    "+918866624863",
      captainImageUrl: "https://drive.google.com/file/d/16Tugj23DF3xukyu0YZOpogbxQrCmFJ0Y/view?usp=sharing",
      logoGdriveUrl:   "https://drive.google.com/file/d/1cW68jjfSsQND88DUzVKKWlvI2JoHyjuH/view?usp=drive_link",
    },
    {
      name:            "Team Heartlink",
      shortCode:       "TH",
      seed:            3,
      ownerNames:      "Rupal Mehta",
      captainName:     "Nikunj Devda",
      captainPhone:    "+918999875921",
      captainImageUrl: "https://drive.google.com/file/d/176uLq3dUF6V_BVrTF9VsPUpJTunGdy7x/view?usp=sharing",
      logoGdriveUrl:   "https://drive.google.com/file/d/1RP8V6eRtbuzTrq62oTDYMy0rN469Ml53/view?usp=drive_link",
    },
    {
      name:            "Team SVC Rocks",
      shortCode:       "SVC",
      seed:            4,
      ownerNames:      "Jayesh Bhalawala / Tushar Kadam",
      captainName:     "Aamir Sumra",
      captainPhone:    "+919723700027",
      captainImageUrl: "https://drive.google.com/file/d/1hvR0_jprJkowzZ2tGkk47k4nTs819tE6/view?usp=sharing",
      logoGdriveUrl:   "https://drive.google.com/file/d/1MbHb6MJWzttXB58x-CJ-Jp72XGJZSjUF/view?usp=drive_link",
    },
  ],
  B: [
    {
      name:            "Shuttle Smashers",
      shortCode:       "SS",
      seed:            1,
      ownerNames:      "Thiruvelluvalam",
      captainName:     "Rajesh Nimkar",
      captainPhone:    "+919898877288",
      captainImageUrl: "https://drive.google.com/file/d/1ycAb6bxgBrcL2v0xPGLlRUk19mYqLTfu/view?usp=sharing",
      logoGdriveUrl:   "https://drive.google.com/file/d/1QcCiukahSdmWRj9-3YtaKL6163AhQnUf/view?usp=drive_link",
    },
    {
      name:            "Love Baddy",
      shortCode:       "LB",
      seed:            2,
      ownerNames:      "Nimish Desai",
      captainName:     "Chetan Gohil",
      captainPhone:    "+919904100023",
      captainImageUrl: "https://drive.google.com/file/d/1wurVq1E3O_EvCfoZIJCn5ESYJcDgVnrc/view?usp=sharing",
      logoGdriveUrl:   "https://drive.google.com/file/d/1pozEuGDmsEDlaki-1XJxJLp4Lw9PR2qA/view?usp=drive_link",
    },
    {
      name:            "Shakti Sports",
      shortCode:       "SKT",
      seed:            3,
      ownerNames:      "Jignesh Pathak",
      captainName:     "Jatin Sarvaiya",
      captainPhone:    "+919909522716",
      captainImageUrl: "https://drive.google.com/open?id=1_vfBzGyOdIVOdrOS6VOFlWGQhsO3jSyD",
      logoGdriveUrl:   "https://drive.google.com/file/d/1dSf7P_QBUhzrGOXWOPZGSq_IAf3UR8fJ/view?usp=drive_link",
    },
    {
      name:            "Dhurandhar Baddies",
      shortCode:       "DB",
      seed:            4,
      ownerNames:      "Siddharth Soneji / Atulkaka",
      captainName:     "Kuntal Manvar",
      captainPhone:    "+919427301436",
      captainImageUrl: "https://drive.google.com/open?id=1FZ7olU57jaKbtk772wTI7l9ojs0sVcdr",
      logoGdriveUrl:   "https://drive.google.com/file/d/1E2yKkoai1e5iH-GsLyXN82o9S-zYZ6CB/view?usp=drive_link",
    },
  ],
  C: [
    {
      name:            "Dreams and Ideas",
      shortCode:       "DI",
      seed:            1,
      ownerNames:      "Mitesh Shah",
      captainName:     "Vivek Ojha",
      captainPhone:    "+919558637000",
      captainImageUrl: "https://drive.google.com/open?id=1cmxyyGOKX4v6FJWKRoskq0hOanzQEpzL",
      logoGdriveUrl:   "https://drive.google.com/file/d/1Tkjc2fF6gTUDedAUmYH4UJ9IGbW7LxlZ/view?usp=drive_link",
    },
    {
      name:            "Diamond Sports Studio",
      shortCode:       "DSS",
      seed:            2,
      ownerNames:      "Ankur Acharya",
      captainName:     "Akash Kulkarni",
      captainPhone:    "+919650472787",
      captainImageUrl: "https://drive.google.com/open?id=1uaDdIDi9TxlM2-0gGeJSwgaESzD_gk92",
      logoGdriveUrl:   "Diamond sports.jpeg",
    },
    {
      name:            "Sapphire Wolves",
      shortCode:       "SW",
      seed:            3,
      ownerNames:      "Vidhi Mehta – Sapphire by Madhuvan & Kesar Group",
      captainName:     "Bhavin Jadav",
      captainPhone:    "+918154951897",
      captainImageUrl: "https://drive.google.com/file/d/1RtWisr3p01fdii0VJ-VLnAjS19CFEu_D/view?usp=drive_link",
      logoGdriveUrl:   "https://drive.google.com/file/d/1IwZmyXDoCQTXvl8wnZxhvS37Mus9DMn3/view?usp=drive_link",
    },
    {
      name:            "Ramasya Yoddhaha",
      shortCode:       "RY",
      seed:            4,
      ownerNames:      "Gaurav Bhatt",
      captainName:     "Ayush Rawat",
      captainPhone:    "+919427472797",
      captainImageUrl: "https://drive.google.com/open?id=1BkMvZOy8M2dA4bWAL9sG73ujCIhfffRG",
      logoGdriveUrl:   "https://drive.google.com/file/d/1xLu0417f4x3DAVdj6j_qgXLBY3NL8cLd/view?usp=drive_link",
    },
  ],
  D: [
    {
      name:            "Rudraveer",
      shortCode:       "RV",
      seed:            1,
      ownerNames:      "Rahul Patel / Neal Patel / Milan Pandya",
      captainName:     "Tejas Shah",
      captainPhone:    "+919913258728",
      captainImageUrl: "https://drive.google.com/open?id=1GJynoHNh1g3sZcQrP-DjNQ8Z-0SJzjqV",
      logoGdriveUrl:   "https://drive.google.com/file/d/1apkkPfB-KfQhJ4DJaZpt5mkpWupiLSZ2/view?usp=drive_link",
    },
    {
      name:            "V S Blasters",
      shortCode:       "VSB",
      seed:            2,
      ownerNames:      "Aleem Sharfi",
      captainName:     "Kevin Somaiya",
      captainPhone:    "+917383013070",
      captainImageUrl: "https://drive.google.com/open?id=16nHF4trA6UwKA_ooXE3QxJCSS3rap3Bv",
      logoGdriveUrl:   "https://drive.google.com/file/d/1tKoS8vtJ8mHjWgSZHhp4PEKFb2mNQvga/view?usp=drive_link",
    },
    {
      name:            "GP Life and Wellness",
      shortCode:       "GPLW",
      seed:            3,
      ownerNames:      "Chitrak Desai",
      captainName:     "Mohsin Sumra",
      captainPhone:    "+919723175090",
      captainImageUrl: "https://drive.google.com/file/d/1DEsphK7RXkC5ODlGWnues2qunTKW7IR7/view?usp=sharing",
      logoGdriveUrl:   "https://drive.google.com/file/d/1lbxyxFGyFhVlBiI5Ktw0YTn36D6HdHyg/view?usp=drive_link",
    },
    {
      name:            "T-Smash",
      shortCode:       "TS",
      seed:            4,
      ownerNames:      "Hardik Patel / Kumar Chauhan / Sylvester",
      captainName:     "Hareeit Vasavda",
      captainPhone:    "+919825025069",
      captainImageUrl: "https://drive.google.com/file/d/19ir0n-9SFTcqReyNCSNhwmdMo5hk4T8s/view?usp=sharing",
      logoGdriveUrl:   "https://drive.google.com/file/d/1ZGAUVdfJ_S9PzJPZinSmyqeK7MBUG3wH/view?usp=drive_link",
    },
  ],
};

// ─── Admin accounts ──────────────────────────────────────────────────────────

const ADMIN_ACCOUNTS = [
  {
    email:       "needhihegde@gmail.com",
    displayName: "Nidhi Hegde",
    role:        "admin" as const,
  },
  // Add more organizers here before running seed
];

// ─── Seed Function ────────────────────────────────────────────────────────────

async function seed() {
  console.log("🏸 Love Fusion Predict — Database Seed");
  console.log("========================================");
  console.log(`📡 Database: ${process.env.DATABASE_URL!.replace(/:[^:@]+@/, ":***@")}`);
  console.log("");

  // ── 1. Upsert contest ──────────────────────────────────────────────────────
  console.log("📋 Creating contest...");
  const existingContest = await db.query.contests.findFirst({
    where: eq(schema.contests.slug, CONTEST.slug),
  });

  let contestId: string;

  if (existingContest) {
    console.log(`  ℹ️  Contest already exists: ${existingContest.id}`);
    contestId = existingContest.id;
  } else {
    const [contest] = await db.insert(schema.contests).values({
      name:           CONTEST.name,
      slug:           CONTEST.slug,
      state:          CONTEST.state,
      prizePoolPaise: CONTEST.prizePoolPaise,
      entryDeadline:  CONTEST.entryDeadline,
      rulesMarkdown:  CONTEST.rulesMarkdown,
    }).returning({ id: schema.contests.id });

    contestId = contest.id;
    console.log(`  ✅ Contest created: ${contestId}`);
  }

  // ── 2. Create groups ──────────────────────────────────────────────────────
  console.log("\n📦 Creating groups...");
  const groupIdMap: Record<string, string> = {};

  for (const group of GROUPS) {
    const existing = await db.query.groups.findFirst({
      where: (g, { and }) => and(
        eq(g.contestId, contestId),
        eq(g.label, group.label),
      ),
    });

    if (existing) {
      console.log(`  ℹ️  Group ${group.label} already exists`);
      groupIdMap[group.label] = existing.id;
    } else {
      const [inserted] = await db.insert(schema.groups).values({
        contestId:  contestId,
        label:      group.label,
        courtInfo:  group.courtInfo,
      }).returning({ id: schema.groups.id });

      groupIdMap[group.label] = inserted.id;
      console.log(`  ✅ Group ${group.label} (${group.courtInfo}): ${inserted.id}`);
    }
  }

  // ── 3. Create teams ───────────────────────────────────────────────────────
  console.log("\n🏆 Creating teams...");
  let teamCount = 0;

  for (const [groupLabel, teams] of Object.entries(TEAMS_BY_GROUP)) {
    const groupId = groupIdMap[groupLabel];

    for (const team of teams) {
      const existing = await db.query.teams.findFirst({
        where: (t, { and }) => and(
          eq(t.contestId, contestId),
          eq(t.name, team.name),
        ),
      });

      if (existing) {
        console.log(`  ℹ️  Team "${team.name}" already exists`);
        continue;
      }

      await db.insert(schema.teams).values({
        contestId:       contestId,
        groupId:         groupId,
        name:            team.name,
        shortCode:       team.shortCode,
        seed:            team.seed,
        ownerNames:      team.ownerNames,
        captainName:     team.captainName,
        captainPhone:    team.captainPhone,
        captainImageUrl: team.captainImageUrl,
        logoGdriveUrl:   team.logoGdriveUrl?.startsWith("http") ? team.logoGdriveUrl : undefined,
        // logoUrl: set after Cloudinary upload
      });

      console.log(`  ✅ [Group ${groupLabel}] ${team.name} (seed ${team.seed}) — captain: ${team.captainName ?? "TBD"}`);
      teamCount++;
    }
  }

  console.log(`\n  Total teams inserted: ${teamCount}`);

  // ── 4. Create admin accounts ──────────────────────────────────────────────
  console.log("\n👤 Creating organizer accounts...");

  for (const account of ADMIN_ACCOUNTS) {
    const existing = await db.query.organizerAccounts.findFirst({
      where: eq(schema.organizerAccounts.email, account.email),
    });

    if (existing) {
      console.log(`  ℹ️  Organizer ${account.email} already exists`);
    } else {
      await db.insert(schema.organizerAccounts).values(account);
      console.log(`  ✅ Organizer created: ${account.email} (${account.role})`);
    }
  }

  // ── 5. Summary ────────────────────────────────────────────────────────────
  console.log("\n========================================");
  console.log("✅ Seed complete!");
  console.log(`   Contest ID : ${contestId}`);
  console.log(`   Groups     : A, B, C, D`);
  console.log(`   Teams      : 16`);
  console.log(`   Admins     : ${ADMIN_ACCOUNTS.length}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Upload team logos to Cloudinary: npm run cloudinary:upload");
  console.log("  2. Transition contest to 'ready_for_review': admin dashboard");
  console.log("  3. Publish contest on 23 October 2026");
  console.log("  4. Open entries (or set auto-open time)");
  console.log("");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
