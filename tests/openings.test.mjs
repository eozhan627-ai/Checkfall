// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { formatLine, getOpening, OPENINGS, ownMoveCount, starsFor } from "../lib/openings.ts";

test("every opening line consists of legal moves", () => {
    for (const opening of OPENINGS) {
        const game = new Chess();

        opening.moves.forEach((san, index) => {
            let move = null;
            try {
                move = game.move(san);
            } catch {
                // reported below
            }
            assert.ok(move, `${opening.name}: move ${index + 1} (${san}) is not legal`);
            assert.equal(move.san, san, `${opening.name}: write ${san} as ${move.san}`);
        });
    }
});

test("openings have what the trainer needs", () => {
    const ids = new Set();

    for (const opening of OPENINGS) {
        assert.ok(!ids.has(opening.id), `duplicate id ${opening.id}`);
        ids.add(opening.id);

        assert.ok(opening.side === "w" || opening.side === "b");
        assert.match(opening.eco, /^[A-E]\d\d$/);
        assert.ok(opening.moves.length >= 10, opening.name);
        assert.ok(opening.summary.length > 20, opening.name);
        assert.equal(opening.ideas.length, 3, opening.name);
        assert.ok(ownMoveCount(opening) >= 5, opening.name);
    }

    assert.ok(OPENINGS.some((o) => o.side === "w") && OPENINGS.some((o) => o.side === "b"));
    assert.equal(getOpening("italian")?.name, "Italian Game");
    assert.equal(getOpening("nope"), null);
});

test("helpers", () => {
    assert.equal(formatLine(["e4", "e5", "Nf3", "Nc6"]), "1. e4 e5 2. Nf3 Nc6");
    assert.equal(formatLine(["e4", "e5", "Nf3", "Nc6"], 3), "1. e4 e5 2. Nf3 …");
    assert.equal(ownMoveCount({ side: "w", moves: ["e4", "e5", "Nf3"] }), 2);
    assert.equal(ownMoveCount({ side: "b", moves: ["e4", "e5", "Nf3"] }), 1);
    assert.deepEqual([starsFor(0, 0), starsFor(1, 1), starsFor(2, 1)], [3, 2, 1]);
});
