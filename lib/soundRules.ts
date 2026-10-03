// Which sound belongs to which move. Pure functions (tested in
// tests/sounds.test.mjs); playing the files happens in lib/sounds.ts.

export type SoundName =
    | "move"
    | "capture"
    | "castle"
    | "check"
    | "checkmate"
    | "promotion"
    | "premove"
    | "gameStart"
    | "gameEnd";

// From the written move ("Nxe5+", "O-O", "e8=Q#"). The most important thing
// about a move wins: mate, then check, promotion, castling, capture.
export function soundForSan(san: string | null | undefined): SoundName {
    if (!san) return "move";
    if (san.includes("#")) return "checkmate";
    if (san.includes("+")) return "check";
    if (san.includes("=")) return "promotion";
    if (san.startsWith("O-O")) return "castle";
    if (san.includes("x")) return "capture";
    return "move";
}

// The 64 squares of a FEN as one string, "." for an empty square.
function squares(fen: string): string | null {
    const board = fen.split(" ")[0] ?? "";
    const flat = board.replace(/\//g, "").replace(/\d/g, (digit) => ".".repeat(Number(digit)));
    return flat.length === 64 ? flat : null;
}

const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;

/**
 * For boards that only know positions (puzzles, lessons, openings, review):
 * the sound for going from one position to the next.
 * Returns null when the new position is not the result of a move or two -
 * for example when a new puzzle was loaded.
 */
export function soundForPositionChange(
    previousFen: string | null | undefined,
    nextFen: string | null | undefined,
    state: { check?: boolean; mate?: boolean } = {}
): SoundName | null {
    if (!previousFen || !nextFen) return null;

    const before = squares(previousFen);
    const after = squares(nextFen);
    if (!before || !after || before === after) return null;

    let changed = 0;
    for (let i = 0; i < 64; i++) {
        if (before[i] !== after[i]) changed++;
    }

    // One move changes 2 squares (castling 4), a move plus the reply up to 8.
    if (changed > 8) return null;

    if (state.mate) return "checkmate";
    if (state.check) return "check";

    // A pawn of one colour is gone and that colour has one more piece.
    const promoted = (pawn: RegExp, pieces: RegExp) =>
        count(before, pawn) > count(after, pawn) && count(after, pieces) > count(before, pieces);

    if (promoted(/P/g, /[QRBN]/g) || promoted(/p/g, /[qrbn]/g)) return "promotion";

    if (count(after, /[a-zA-Z]/g) < count(before, /[a-zA-Z]/g)) return "capture";

    // The king went two squares sideways: castling.
    const kingJumped = (king: string) => Math.abs(before.indexOf(king) - after.indexOf(king)) === 2;
    if (changed === 4 && (kingJumped("K") || kingJumped("k"))) return "castle";

    return "move";
}
