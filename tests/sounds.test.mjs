// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Chess } from "chess.js";
import { soundForPositionChange, soundForSan } from "../lib/soundRules.ts";

test("the written move decides the sound", () => {
    assert.equal(soundForSan("e4"), "move");
    assert.equal(soundForSan("Nxe5"), "capture");
    assert.equal(soundForSan("O-O"), "castle");
    assert.equal(soundForSan("O-O-O"), "castle");
    assert.equal(soundForSan("Qh5+"), "check");
    assert.equal(soundForSan("Nxf7+"), "check");
    assert.equal(soundForSan("e8=Q"), "promotion");
    assert.equal(soundForSan("exd8=Q+"), "check");
    assert.equal(soundForSan("Qxf7#"), "checkmate");
    assert.equal(soundForSan("O-O#"), "checkmate");
    assert.equal(soundForSan(""), "move");
    assert.equal(soundForSan(undefined), "move");
});

// Plays moves and asks for the sound of the last one, from the positions only.
function afterMoves(startFen, ...moves) {
    const game = startFen ? new Chess(startFen) : new Chess();
    let before = game.fen();

    for (const move of moves) {
        before = game.fen();
        game.move(move);
    }

    return soundForPositionChange(before, game.fen(), { check: game.inCheck(), mate: game.isCheckmate() });
}

test("positions: move, capture, castling, en passant", () => {
    assert.equal(afterMoves(null, "e4"), "move");
    assert.equal(afterMoves(null, "e4", "d5", "exd5"), "capture");
    assert.equal(afterMoves(null, "e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O"), "castle");
    assert.equal(afterMoves("r3k2r/8/8/8/8/8/8/4K3 b kq - 0 1", "O-O-O"), "castle");
    assert.equal(afterMoves(null, "e4", "a6", "e5", "d5", "exd6"), "capture");
});

test("positions: check, mate and promotion", () => {
    assert.equal(afterMoves(null, "e4", "f5", "Qh5+"), "check");
    assert.equal(afterMoves(null, "f3", "e5", "g4", "Qh4#"), "checkmate");
    assert.equal(afterMoves("8/4P3/8/8/8/k7/8/4K3 w - - 0 1", "e8=Q"), "promotion");
    assert.equal(afterMoves("3r4/4P3/8/8/8/k7/8/4K3 w - - 0 1", "exd8=N"), "promotion");
    assert.equal(afterMoves("8/8/8/8/8/k7/4p3/2K5 b - - 0 1", "e1=Q+"), "check");
    // A pawn that is taken is not a promotion.
    assert.equal(afterMoves("8/8/8/3p4/4N3/k7/8/4K3 b - - 0 1", "dxe4"), "capture");
    assert.equal(afterMoves("8/8/8/3p4/8/k3B3/8/4K3 w - - 0 1", "Bd4", "Kb3", "Bg7", "Kc4", "Bh8", "d4", "Bxd4"), "capture");
});

test("positions: a move plus the reply gives one sound", () => {
    const game = new Chess();
    const before = game.fen();
    game.move("e4");
    game.move("e5");
    assert.equal(soundForPositionChange(before, game.fen()), "move");
});

test("positions: a new puzzle or no change stays silent", () => {
    const start = new Chess().fen();
    assert.equal(soundForPositionChange(start, start), null);
    assert.equal(soundForPositionChange(null, start), null);
    assert.equal(soundForPositionChange(start, null), null);
    assert.equal(soundForPositionChange(start, "8/8/8/8/8/k7/4p3/2K5 b - - 0 1"), null);
    assert.equal(soundForPositionChange(start, "not a fen"), null);
});

test("every sound has its file", () => {
    const names = [
        "move-1", "move-2", "move-3", "move-4", "capture-1", "capture-2", "capture-3", "castle-1", "castle-2",
        "check", "checkmate", "promotion", "premove", "game-start", "game-end",
    ];

    for (const name of names) {
        const file = new URL(`../assets/sounds/${name}.wav`, import.meta.url);
        const data = fs.readFileSync(file);

        assert.equal(data.subarray(0, 4).toString(), "RIFF", name);
        assert.equal(data.subarray(8, 12).toString(), "WAVE", name);
        assert.ok(data.length > 2000 && data.length < 200_000, `${name}: ${data.length} bytes`);
    }

    for (const player of ["../lib/soundPlayer.ts", "../lib/soundPlayer.web.ts"]) {
        const source = fs.readFileSync(new URL(player, import.meta.url), "utf8");
        for (const name of names) assert.ok(source.includes(`sounds/${name}.wav`), `${player}: ${name}`);
    }

    // No file in the folder that the app does not use.
    const folder = fs.readdirSync(new URL("../assets/sounds/", import.meta.url)).filter((file) => file.endsWith(".wav"));
    assert.deepEqual(folder.sort(), names.map((name) => `${name}.wav`).sort());
});
