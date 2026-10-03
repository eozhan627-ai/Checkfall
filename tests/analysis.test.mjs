// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
    CLASSIFICATION_META,
    CLASSIFICATION_ORDER,
    describeMove,
    formatEval,
    isCurrentReview,
    moveLabel,
    normalizeAnalysis,
    summarize,
    whiteShare,
    winPct,
} from "../lib/analysis.ts";

test("winning chances are symmetric and bounded", () => {
    assert.equal(winPct(0), 50);
    assert.ok(Math.abs(winPct(300) + winPct(-300) - 100) < 1e-9);
    assert.ok(winPct(100000) <= 100);
    assert.ok(winPct(-100000) >= 0);
    assert.ok(winPct(200) > winPct(100));
});

test("evaluations are written the way chess players write them", () => {
    assert.equal(formatEval(null), "0.0");
    assert.equal(formatEval({ evalCp: 140, mate: null, mateFor: null }), "+1.4");
    assert.equal(formatEval({ evalCp: -30, mate: null, mateFor: null }), "−0.3");
    assert.equal(formatEval({ evalCp: 0, mate: null, mateFor: null }), "0.0");
    assert.equal(formatEval({ evalCp: 1250, mate: null, mateFor: null }), "+13");
    assert.equal(formatEval({ evalCp: 9997, mate: 3, mateFor: "w" }), "M3");
    assert.equal(formatEval({ evalCp: -9997, mate: 3, mateFor: "b" }), "−M3");
    assert.equal(formatEval({ evalCp: 10000, mate: 0, mateFor: "w" }), "1-0");
    assert.equal(formatEval({ evalCp: -10000, mate: 0, mateFor: "b" }), "0-1");
});

test("the evaluation bar stays inside the board", () => {
    assert.equal(whiteShare(null), 0.5);
    assert.equal(whiteShare({ evalCp: 9998, mate: 2, mateFor: "w" }), 1);
    assert.equal(whiteShare({ evalCp: -9998, mate: 2, mateFor: "b" }), 0);

    const share = whiteShare({ evalCp: 5000, mate: null, mateFor: null });
    assert.ok(share > 0.9 && share < 1);
});

test("move labels", () => {
    assert.equal(moveLabel({ moveNumber: 12, color: "w", san: "Nf3" }), "12. Nf3");
    assert.equal(moveLabel({ moveNumber: 12, color: "b", san: "Qxd5" }), "12… Qxd5");
});

test("every classification has a label, an icon and a colour", () => {
    const expected = [
        "brilliant", "great", "best", "excellent", "good", "book",
        "forced", "inaccuracy", "mistake", "miss", "blunder",
    ];
    // "Forced" moves are not listed in the move-quality table.
    assert.deepEqual(
        [...CLASSIFICATION_ORDER].sort(),
        expected.filter((key) => key !== "forced").sort()
    );
    assert.equal(CLASSIFICATION_ORDER[0], "brilliant");
    assert.equal(CLASSIFICATION_ORDER.at(-1), "blunder");

    for (const key of expected) {
        const meta = CLASSIFICATION_META[key];
        assert.ok(meta, key);
        assert.ok(meta.label.length > 0, key);
        assert.match(meta.color, /^#[0-9a-f]{6}$/i, key);
    }
});

test("old analyses are converted into the new shape", () => {
    assert.equal(normalizeAnalysis(null), null);
    assert.equal(normalizeAnalysis({}), null);

    const review = normalizeAnalysis({
        depth: 12,
        moves: [
            { moveNumber: 1, san: "e4", evalCp: 30 },
            { moveNumber: 1, san: "e5", evalCp: 25 },
            { moveNumber: 2, san: "Qh5", evalCp: -20 },
            { moveNumber: 2, san: "g6", evalCp: 900 },
        ],
    });

    assert.ok(review);
    assert.equal(review.version, 1);
    assert.equal(isCurrentReview(review), false);
    assert.equal(review.moves.length, 4);
    assert.deepEqual(review.moves.map((m) => m.color), ["w", "b", "w", "b"]);
    assert.equal(review.moves[3].classification, "blunder");
    assert.deepEqual(review.keyMoments, [3]);
    assert.equal(review.counts.b.blunder, 1);
    assert.ok(review.accuracy.w > review.accuracy.b);
});

test("current analyses get safe defaults", () => {
    const review = normalizeAnalysis({ version: 2, depth: 16, tier: "gold", moves: [] });

    assert.ok(review);
    assert.equal(isCurrentReview(review), true);
    assert.deepEqual(review.opening, { name: null, plies: 0 });
    assert.deepEqual(review.keyMoments, []);
    assert.equal(review.playerColor, null);
    assert.deepEqual(review.estimatedRating, { w: null, b: null });
});

test("the coach text names the better move for a blunder", () => {
    const move = {
        ply: 20,
        moveNumber: 11,
        color: "w",
        san: "Qd2",
        evalCp: -450,
        mate: null,
        mateFor: null,
        bestMove: "d1e2",
        bestSan: "Qe2",
        bestLine: ["Qe2", "Nf6"],
        reply: ["Nxe4"],
        classification: "blunder",
        winBefore: 55,
        winAfter: 16,
        loss: 39,
        accuracy: 15,
    };

    const comment = describeMove(move, { opening: { name: null, plies: 0 }, playerColor: "w" });

    assert.ok(comment.headline.length > 0);
    assert.match(comment.text, /Qe2/);
});

test("the summary is a non-empty sentence", () => {
    const review = normalizeAnalysis({
        moves: [
            { moveNumber: 1, san: "e4", evalCp: 30 },
            { moveNumber: 1, san: "e5", evalCp: 25 },
        ],
    });

    const text = summarize(review);
    assert.equal(typeof text, "string");
    assert.ok(text.length > 10);
});

test("the coach text is also available in German", () => {
    const move = {
        ply: 20, moveNumber: 11, color: "w", san: "Qd2", evalCp: -450, mate: null, mateFor: null,
        bestMove: "d1e2", bestSan: "Qe2", bestLine: ["Qe2"], reply: ["Nxe4"], classification: "blunder",
        winBefore: 55, winAfter: 16, loss: 39, accuracy: 15,
    };
    const review = { opening: { name: null, plies: 0 }, playerColor: "w" };

    const german = describeMove(move, review, "de");
    assert.equal(german.headline, "Qd2 ist ein Patzer");
    assert.equal(
        german.text,
        "Dein Gegner kann mit Nxe4 antworten, und du stehst deutlich schlechter. Qe2 war der richtige Zug."
    );

    // Every label has its own German sentence; none falls back to English.
    for (const classification of ["brilliant", "great", "best", "excellent", "good", "book", "forced", "inaccuracy", "mistake", "miss", "blunder"]) {
        const comment = describeMove({ ...move, classification }, review, "de");
        assert.ok(comment.text.length > 5, classification);
        assert.doesNotMatch(comment.headline + comment.text, /\b(is|the|was|You|Your)\b/, classification);
    }

    const summary = summarize(
        { accuracy: { w: 90, b: 70 }, playerColor: "w", counts: { w: {}, b: { blunder: 2 } } },
        "de"
    );
    assert.equal(summary, "Du hast die genauere Partie gespielt; deinem Gegner sind 2 schwere Fehler unterlaufen.");
});
