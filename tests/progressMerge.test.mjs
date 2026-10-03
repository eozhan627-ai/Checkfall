// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
    EMPTY_PROGRESS,
    mergeProgress,
    normalizeProgress,
    progressEquals,
} from "../lib/progressMerge.ts";

test("merge keeps the best of both sides", () => {
    const device = normalizeProgress({
        rewards: { xp: 120, streak: 3, bestStreak: 5, totalSolved: 9, lastSolvedDate: "2026-10-01" },
        solvedPuzzles: ["a", "b"],
        lessons: { blunder: { bestStars: 2, maxStars: 9 } },
    });
    const account = normalizeProgress({
        rewards: { xp: 300, streak: 1, bestStreak: 2, totalSolved: 4, lastSolvedDate: "2026-09-20" },
        solvedPuzzles: ["b", "c"],
        lessons: { blunder: { bestStars: 5, maxStars: 9 }, slip: { bestStars: 1, maxStars: 3 } },
    });

    const merged = mergeProgress(device, account);

    assert.deepEqual(merged.rewards, {
        xp: 300,
        streak: 3, // streak follows the most recent solve
        bestStreak: 5,
        totalSolved: 9,
        lastSolvedDate: "2026-10-01",
    });
    assert.deepEqual([...merged.solvedPuzzles].sort(), ["a", "b", "c"]);
    assert.deepEqual(merged.lessons, {
        blunder: { bestStars: 5, maxStars: 9 },
        slip: { bestStars: 1, maxStars: 3 },
    });

    // The order of the two sides does not matter.
    assert.ok(progressEquals(mergeProgress(account, device), merged));
});

test("unexpected data from the database is cleaned up", () => {
    assert.deepEqual(normalizeProgress(null), EMPTY_PROGRESS);
    assert.deepEqual(normalizeProgress("nonsense"), EMPTY_PROGRESS);

    const cleaned = normalizeProgress({
        rewards: { xp: "x", streak: -3, lastSolvedDate: "yesterday" },
        solvedPuzzles: [1, "a", "a"],
        lessons: { broken: null },
        shop: { coinsEarned: "many", owned: [4, "ocean", "ocean"], boardTheme: null },
    });

    assert.deepEqual(cleaned, {
        rewards: { xp: 0, streak: 0, bestStreak: 0, totalSolved: 0, lastSolvedDate: null },
        solvedPuzzles: ["a"],
        lessons: {},
        shop: { coinsEarned: 0, owned: ["ocean"], boardTheme: "classic" },
    });
});

test("merging with an empty side changes nothing", () => {
    const progress = normalizeProgress({
        rewards: { xp: 50, streak: 2, bestStreak: 2, totalSolved: 2, lastSolvedDate: "2026-10-02" },
        solvedPuzzles: ["z"],
    });

    assert.ok(progressEquals(mergeProgress(progress, EMPTY_PROGRESS), progress));
    assert.ok(progressEquals(mergeProgress(EMPTY_PROGRESS, progress), progress));
});

test("same last-solved day keeps the longer streak", () => {
    const a = normalizeProgress({ rewards: { xp: 1, streak: 4, bestStreak: 4, totalSolved: 4, lastSolvedDate: "2026-10-02" } });
    const b = normalizeProgress({ rewards: { xp: 1, streak: 7, bestStreak: 7, totalSolved: 7, lastSolvedDate: "2026-10-02" } });

    assert.equal(mergeProgress(a, b).rewards.streak, 7);
});

test("lesson results stay a matching pair of stars and maximum", () => {
    const device = normalizeProgress({ lessons: { "own:blunder": { bestStars: 11, maxStars: 15 } } });
    const account = normalizeProgress({ lessons: { "own:blunder": { bestStars: 8, maxStars: 9 } } });

    const merged = mergeProgress(device, account);

    // 8/9 is the better result than 11/15 - never "11 of 9".
    assert.deepEqual(merged.lessons["own:blunder"], { bestStars: 8, maxStars: 9 });
    assert.deepEqual(mergeProgress(account, device).lessons["own:blunder"], { bestStars: 8, maxStars: 9 });
});
