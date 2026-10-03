// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { normalizePromoState, shouldShowPromo } from "../lib/vipPromoRules.ts";

test("never on the very first visit, never for VIP", () => {
    assert.equal(shouldShowPromo({ firstSeen: null, lastShown: null }, "2026-10-03", 1, false), false);
    assert.equal(shouldShowPromo({ firstSeen: "2026-10-01", lastShown: null }, "2026-10-03", 1, true), false);
});

test("at most once a day", () => {
    const seen = { firstSeen: "2026-10-01", lastShown: null };
    assert.equal(shouldShowPromo(seen, "2026-10-01", 1, false), true);

    const shown = { firstSeen: "2026-10-01", lastShown: "2026-10-03" };
    assert.equal(shouldShowPromo(shown, "2026-10-03", 1, false), false);
    assert.equal(shouldShowPromo(shown, "2026-10-04", 1, false), true);
});

test("longer pauses and month changes", () => {
    const shown = { firstSeen: "2026-09-01", lastShown: "2026-09-29" };
    assert.equal(shouldShowPromo(shown, "2026-10-01", 3, false), false);
    assert.equal(shouldShowPromo(shown, "2026-10-02", 3, false), true);
});

test("broken stored data", () => {
    assert.deepEqual(normalizePromoState("x"), { firstSeen: null, lastShown: null });
    assert.deepEqual(normalizePromoState({ firstSeen: 5, lastShown: "2026-10-03" }), { firstSeen: null, lastShown: "2026-10-03" });
});
