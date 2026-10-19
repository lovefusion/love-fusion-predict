/**
 * Love Fusion Predict — Scoring Engine Tests
 * Run: npm test
 */

import { describe, it, expect } from "vitest";
import {
  scoreGroup,
  scoreEntry,
  calculatePrize,
  formatPaise,
  type PredictionPair,
  type QualifierPair,
  type WinnerEntry,
} from "./scoring";

// ─── scoreGroup ───────────────────────────────────────────────────────────────

describe("scoreGroup", () => {
  it("TC-01: returns 1 when both predictions match, same order", () => {
    const p: PredictionPair = { teamId1: "team-A1", teamId2: "team-A3" };
    const o: QualifierPair  = { qualifier1Id: "team-A1", qualifier2Id: "team-A3" };
    expect(scoreGroup(p, o)).toBe(1);
  });

  it("TC-02: returns 1 when both predictions match, REVERSED order", () => {
    const p: PredictionPair = { teamId1: "team-A3", teamId2: "team-A1" };
    const o: QualifierPair  = { qualifier1Id: "team-A1", qualifier2Id: "team-A3" };
    expect(scoreGroup(p, o)).toBe(1);
  });

  it("TC-03: returns 0 when one prediction is wrong", () => {
    const p: PredictionPair = { teamId1: "team-A1", teamId2: "team-A2" };
    const o: QualifierPair  = { qualifier1Id: "team-A1", qualifier2Id: "team-A3" };
    expect(scoreGroup(p, o)).toBe(0);
  });

  it("TC-04: returns 0 when both predictions are wrong", () => {
    const p: PredictionPair = { teamId1: "team-A2", teamId2: "team-A4" };
    const o: QualifierPair  = { qualifier1Id: "team-A1", qualifier2Id: "team-A3" };
    expect(scoreGroup(p, o)).toBe(0);
  });

  it("TC-05: returns 0 when predicted teams are duplicate (same team twice)", () => {
    const p: PredictionPair = { teamId1: "team-A1", teamId2: "team-A1" };
    const o: QualifierPair  = { qualifier1Id: "team-A1", qualifier2Id: "team-A3" };
    expect(scoreGroup(p, o)).toBe(0);
  });

  it("TC-06: returns 0 when official qualifiers are duplicate (data error guard)", () => {
    const p: PredictionPair = { teamId1: "team-A1", teamId2: "team-A3" };
    const o: QualifierPair  = { qualifier1Id: "team-A1", qualifier2Id: "team-A1" };
    expect(scoreGroup(p, o)).toBe(0);
  });

  it("TC-07: set equality — order of teams inside official pair does not matter", () => {
    const p: PredictionPair = { teamId1: "alpha", teamId2: "beta" };
    const o1: QualifierPair = { qualifier1Id: "alpha", qualifier2Id: "beta" };
    const o2: QualifierPair = { qualifier1Id: "beta",  qualifier2Id: "alpha" };
    expect(scoreGroup(p, o1)).toBe(1);
    expect(scoreGroup(p, o2)).toBe(1);
  });
});

// ─── scoreEntry ───────────────────────────────────────────────────────────────

describe("scoreEntry", () => {
  const officials = {
    A: { qualifier1Id: "A1", qualifier2Id: "A3" },
    B: { qualifier1Id: "B2", qualifier2Id: "B4" },
    C: { qualifier1Id: "C1", qualifier2Id: "C2" },
    D: { qualifier1Id: "D3", qualifier2Id: "D4" },
  };

  it("TC-08: perfect entry (4/4) returns isPerfect=true and totalScore=4", () => {
    const predictions = {
      A: { teamId1: "A1", teamId2: "A3" },
      B: { teamId1: "B2", teamId2: "B4" },
      C: { teamId1: "C1", teamId2: "C2" },
      D: { teamId1: "D3", teamId2: "D4" },
    };
    const result = scoreEntry(predictions, officials);
    expect(result.isPerfect).toBe(true);
    expect(result.totalScore).toBe(4);
    expect(result.groupScores).toEqual({ A: 1, B: 1, C: 1, D: 1 });
  });

  it("TC-09: perfect entry with all group orders reversed — still 4/4", () => {
    const predictions = {
      A: { teamId1: "A3", teamId2: "A1" },
      B: { teamId1: "B4", teamId2: "B2" },
      C: { teamId1: "C2", teamId2: "C1" },
      D: { teamId1: "D4", teamId2: "D3" },
    };
    const result = scoreEntry(predictions, officials);
    expect(result.isPerfect).toBe(true);
    expect(result.totalScore).toBe(4);
  });

  it("TC-10: 3/4 — gets groups A, B, C correct, misses D", () => {
    const predictions = {
      A: { teamId1: "A1", teamId2: "A3" },
      B: { teamId1: "B2", teamId2: "B4" },
      C: { teamId1: "C1", teamId2: "C2" },
      D: { teamId1: "D1", teamId2: "D2" }, // wrong — should be D3, D4
    };
    const result = scoreEntry(predictions, officials);
    expect(result.isPerfect).toBe(false);
    expect(result.totalScore).toBe(3);
    expect(result.groupScores).toEqual({ A: 1, B: 1, C: 1, D: 0 });
  });

  it("TC-11: 0/4 — all groups wrong", () => {
    const predictions = {
      A: { teamId1: "A2", teamId2: "A4" },
      B: { teamId1: "B1", teamId2: "B3" },
      C: { teamId1: "C3", teamId2: "C4" },
      D: { teamId1: "D1", teamId2: "D2" },
    };
    const result = scoreEntry(predictions, officials);
    expect(result.isPerfect).toBe(false);
    expect(result.totalScore).toBe(0);
    expect(result.groupScores).toEqual({ A: 0, B: 0, C: 0, D: 0 });
  });

  it("TC-12: throws when a group is missing from predictions", () => {
    const incomplete = {
      A: { teamId1: "A1", teamId2: "A3" },
      B: { teamId1: "B2", teamId2: "B4" },
      C: { teamId1: "C1", teamId2: "C2" },
      // D missing
    } as Parameters<typeof scoreEntry>[0];
    expect(() => scoreEntry(incomplete, officials)).toThrow(/group D/i);
  });
});

// ─── calculatePrize ───────────────────────────────────────────────────────────

const POOL = 1_100_000; // ₹11,000

function makeWinner(entryId: string, submittedAt: string, participantId = "p-" + entryId): WinnerEntry {
  return { entryId, submittedAt, participantId };
}

describe("calculatePrize", () => {
  it("TC-13: 0 winners — no allocations, totalAllocated = 0", () => {
    const result = calculatePrize([], POOL);
    expect(result.winnerCount).toBe(0);
    expect(result.allocations).toHaveLength(0);
    expect(result.totalAllocatedPaise).toBe(0);
  });

  it("TC-14: 1 winner — gets full ₹11,000 (1,100,000 paise)", () => {
    const result = calculatePrize(
      [makeWinner("e1", "2026-10-24T05:00:00Z")],
      POOL,
    );
    expect(result.winnerCount).toBe(1);
    expect(result.allocations[0].prizeAmountPaise).toBe(POOL);
    expect(result.allocations[0].isResidualHolder).toBe(true);
    expect(result.totalAllocatedPaise).toBe(POOL);
  });

  it("TC-15: 2 winners — each gets exactly ₹5,500 (550,000 paise), no residual", () => {
    const winners = [
      makeWinner("e1", "2026-10-24T05:00:00Z"),
      makeWinner("e2", "2026-10-24T05:01:00Z"),
    ];
    const result = calculatePrize(winners, POOL);
    expect(result.winnerCount).toBe(2);
    expect(result.baseSharePaise).toBe(550_000);
    expect(result.residualPaise).toBe(0);
    expect(result.totalAllocatedPaise).toBe(POOL);
    for (const a of result.allocations) {
      expect(a.prizeAmountPaise).toBe(550_000);
    }
  });

  it("TC-16: 3 winners — prizes are integers and sum to pool exactly", () => {
    // ₹11,000 / 3 = ₹3,666.67 → floor = 3,666 rupees = 366,600 paise; residual = 200 paise
    const winners = [
      makeWinner("e1", "2026-10-24T05:00:00Z"),
      makeWinner("e2", "2026-10-24T05:01:00Z"),
      makeWinner("e3", "2026-10-24T05:02:00Z"),
    ];
    const result = calculatePrize(winners, POOL);
    expect(result.winnerCount).toBe(3);
    expect(result.baseSharePaise).toBe(366_666);  // floor(1_100_000 / 3)
    expect(result.residualPaise).toBe(2);          // 1_100_000 - 366_666 × 3
    expect(result.totalAllocatedPaise).toBe(POOL);
    // Earliest entry (e1) gets residual
    const e1 = result.allocations.find(a => a.entryId === "e1")!;
    expect(e1.isResidualHolder).toBe(true);
    expect(e1.prizeAmountPaise).toBe(366_668); // 366_666 + 2
  });

  it("TC-17: residual goes to EARLIEST submittedAt", () => {
    const winners = [
      makeWinner("e-late",  "2026-10-24T06:00:00Z"),
      makeWinner("e-early", "2026-10-24T04:00:00Z"),
    ];
    const result = calculatePrize(winners, 1_100_001); // odd paise to force residual
    const early = result.allocations.find(a => a.entryId === "e-early")!;
    expect(early.isResidualHolder).toBe(true);
  });

  it("TC-18: tie on submittedAt — residual goes to lexicographically smaller entryId", () => {
    const ts = "2026-10-24T05:00:00Z";
    const winners = [
      makeWinner("zzz", ts),
      makeWinner("aaa", ts),
      makeWinner("mmm", ts),
    ];
    const result = calculatePrize(winners, 1_100_001); // force residual
    const aaa = result.allocations.find(a => a.entryId === "aaa")!;
    expect(aaa.isResidualHolder).toBe(true);
  });

  it("TC-19: all allocations are integers (no fractional paise)", () => {
    const winners = Array.from({ length: 7 }, (_, i) =>
      makeWinner(`e${i}`, `2026-10-24T0${i}:00:00Z`),
    );
    const result = calculatePrize(winners, POOL);
    for (const a of result.allocations) {
      expect(Number.isInteger(a.prizeAmountPaise)).toBe(true);
    }
  });

  it("TC-20: sum invariant always holds — 200 winners stress test", () => {
    const winners = Array.from({ length: 200 }, (_, i) =>
      makeWinner(`e${i}`, `2026-10-24T${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00Z`),
    );
    const result = calculatePrize(winners, POOL);
    expect(result.totalAllocatedPaise).toBe(POOL);
    for (const a of result.allocations) {
      expect(Number.isInteger(a.prizeAmountPaise)).toBe(true);
      expect(a.prizeAmountPaise).toBeGreaterThan(0);
    }
  });
});

// ─── formatPaise ─────────────────────────────────────────────────────────────

describe("formatPaise", () => {
  it("TC-21: ₹11,000 renders correctly", () => {
    expect(formatPaise(1_100_000)).toBe("₹11,000");
  });

  it("TC-22: ₹5,500 renders correctly", () => {
    expect(formatPaise(550_000)).toBe("₹5,500");
  });

  it("TC-23: ₹2,750 renders correctly", () => {
    expect(formatPaise(275_000)).toBe("₹2,750");
  });
});


// ─── Consolation prize (exactly 3 groups correct) ────────────────────────────

describe("scoreEntry consolation", () => {
  const officials = {
    A: { qualifier1Id: "a1", qualifier2Id: "a2" },
    B: { qualifier1Id: "b1", qualifier2Id: "b2" },
    C: { qualifier1Id: "c1", qualifier2Id: "c2" },
    D: { qualifier1Id: "d1", qualifier2Id: "d2" },
  };
  const right = (g: "A" | "B" | "C" | "D") => ({ teamId1: officials[g].qualifier2Id, teamId2: officials[g].qualifier1Id });
  const wrong = (g: "A" | "B" | "C" | "D") => ({ teamId1: officials[g].qualifier1Id, teamId2: g.toLowerCase() + "3" });

  it("TC-C1: 4 of 4 is the jackpot and NOT a consolation", () => {
    const r = scoreEntry({ A: right("A"), B: right("B"), C: right("C"), D: right("D") }, officials);
    expect(r.totalScore).toBe(4);
    expect(r.isPerfect).toBe(true);
    expect(r.isConsolation).toBe(false);
  });

  it("TC-C2: exactly 3 of 4 earns the consolation but not the jackpot", () => {
    const r = scoreEntry({ A: right("A"), B: right("B"), C: right("C"), D: wrong("D") }, officials);
    expect(r.totalScore).toBe(3);
    expect(r.isPerfect).toBe(false);
    expect(r.isConsolation).toBe(true);
  });

  it("TC-C3: 2, 1 or 0 of 4 earns nothing", () => {
    const two = scoreEntry({ A: right("A"), B: right("B"), C: wrong("C"), D: wrong("D") }, officials);
    const one = scoreEntry({ A: right("A"), B: wrong("B"), C: wrong("C"), D: wrong("D") }, officials);
    const zero = scoreEntry({ A: wrong("A"), B: wrong("B"), C: wrong("C"), D: wrong("D") }, officials);
    for (const r of [two, one, zero]) {
      expect(r.isPerfect).toBe(false);
      expect(r.isConsolation).toBe(false);
    }
  });

  it("TC-C4: one correct pick in a group (half right) does not count as that group", () => {
    const half = { teamId1: "a1", teamId2: "a3" };
    const r = scoreEntry({ A: half, B: right("B"), C: right("C"), D: right("D") }, officials);
    expect(r.totalScore).toBe(3);
    expect(r.isConsolation).toBe(true);
  });
});
