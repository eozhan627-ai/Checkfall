// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { AD_BONUS, allowanceFor, dayKey, usageForToday } from "../lib/dailyLimitRules.ts";

test("free players get 4 puzzles and 1 lesson a day", () => {
    const fresh = usageForToday(null, "2026-10-02");

    assert.deepEqual(allowanceFor("puzzle", "none", fresh), { unlimited: false, used: 0, limit: 4, left: 4 });
    assert.deepEqual(allowanceFor("lesson", "none", fresh), { unlimited: false, used: 0, limit: 1, left: 1 });
    assert.equal(allowanceFor("puzzle", null, fresh).left, 4);
    assert.equal(allowanceFor("puzzle", "something-new", fresh).left, 4);
});

test("the limit is reached after the allowed uses", () => {
    const usage = { date: "2026-10-02", used: 4, bonus: 0 };
    assert.equal(allowanceFor("puzzle", "none", usage).left, 0);
    assert.equal(allowanceFor("puzzle", "none", { ...usage, used: 9 }).left, 0);
});

test("a watched ad adds uses for the same day only", () => {
    const afterAd = { date: "2026-10-02", used: 4, bonus: AD_BONUS.puzzle };
    assert.equal(allowanceFor("puzzle", "none", afterAd).left, 4);

    const nextDay = usageForToday(afterAd, "2026-10-03");
    assert.deepEqual(nextDay, { date: "2026-10-03", used: 0, bonus: 0 });
    assert.equal(allowanceFor("puzzle", "none", nextDay).left, 4);
});

test("VIP plans", () => {
    const usage = { date: "2026-10-02", used: 50, bonus: 0 };

    assert.equal(allowanceFor("puzzle", "silver", usage).unlimited, true);
    assert.equal(allowanceFor("lesson", "silver", { ...usage, used: 2 }).left, 1);
    assert.equal(allowanceFor("lesson", "silver", { ...usage, used: 3 }).left, 0);
    assert.equal(allowanceFor("lesson", "gold", usage).unlimited, true);
    assert.equal(allowanceFor("lesson", "diamond", usage).unlimited, true);
});

test("broken stored data is treated as a fresh day", () => {
    assert.deepEqual(usageForToday("nonsense", "2026-10-02"), { date: "2026-10-02", used: 0, bonus: 0 });
    assert.deepEqual(usageForToday({ date: "2026-10-02", used: -3, bonus: "x" }, "2026-10-02"), { date: "2026-10-02", used: 0, bonus: 0 });
    assert.match(dayKey(new Date(2026, 0, 5)), /^2026-01-05$/);
});
