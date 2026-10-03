// Shared types and pure helpers for the game review: the labels a move can
// get, how numbers are formatted and the coach's short explanation of a move.
// No React and no network in here, so it can be unit-tested.

export type Classification =
    | "brilliant"
    | "great"
    | "best"
    | "excellent"
    | "good"
    | "book"
    | "forced"
    | "inaccuracy"
    | "mistake"
    | "miss"
    | "blunder";

export type Side = "w" | "b";

export type ReviewMove = {
    ply: number;
    moveNumber: number;
    color: Side;
    san: string;
    uci?: string;
    /** Evaluation after the move, in centipawns, from White's point of view. */
    evalCp: number;
    /** Forced mate after the move: number of moves (0 = checkmate on the board). */
    mate: number | null;
    mateFor: Side | null;
    bestMove: string | null;
    bestSan: string | null;
    /** Engine's best line from the position before the move (SAN). */
    bestLine: string[];
    /** Engine's best continuation after the move that was played (SAN). */
    reply: string[];
    classification: Classification;
    /** Mover's winning chances (0-100) before and after the move. */
    winBefore: number;
    winAfter: number;
    loss: number;
    accuracy: number;
    phase?: "opening" | "middlegame" | "endgame";
    sacrifice?: boolean;
    motif?: { type: "fork" | "pin" | "skewer" } | null;
};

export type PlayerInfo = {
    name: string;
    rating: number | null;
    avatar: string | null;
    isUser: boolean;
};

export type PerSide<T> = { w: T; b: T };

export type GameReview = {
    version: number;
    depth: number;
    tier: string;
    opening: { name: string | null; plies: number };
    moves: ReviewMove[];
    accuracy: PerSide<number | null>;
    estimatedRating: PerSide<number | null>;
    counts: PerSide<Partial<Record<Classification, number>>>;
    phases: PerSide<Record<"opening" | "middlegame" | "endgame", number | null>>;
    keyMoments: number[];
    playerColor: Side | null;
    players: { white: PlayerInfo; black: PlayerInfo } | null;
    result?: string | null;
    mode?: string | null;
};

export type ClassificationMeta = {
    label: string;
    /** Short symbol shown in the round badge. */
    icon: string;
    color: string;
};

export const CLASSIFICATION_META: Record<Classification, ClassificationMeta> = {
    brilliant: { label: "Brilliant", icon: "!!", color: "#26C2A3" },
    great: { label: "Great", icon: "!", color: "#5B9BD5" },
    best: { label: "Best", icon: "★", color: "#8DBB5A" },
    excellent: { label: "Excellent", icon: "✓", color: "#8DBB5A" },
    good: { label: "Good", icon: "✓", color: "#7FA37A" },
    book: { label: "Book", icon: "B", color: "#B08B62" },
    forced: { label: "Forced", icon: "→", color: "#8A9099" },
    inaccuracy: { label: "Inaccuracy", icon: "?!", color: "#E8B93E" },
    mistake: { label: "Mistake", icon: "?", color: "#EE8D3F" },
    miss: { label: "Miss", icon: "✕", color: "#E86B6B" },
    blunder: { label: "Blunder", icon: "??", color: "#D9453D" },
};

/** Order of the rows in the move-quality table. */
export const CLASSIFICATION_ORDER: Classification[] = [
    "brilliant",
    "great",
    "best",
    "excellent",
    "good",
    "book",
    "inaccuracy",
    "mistake",
    "miss",
    "blunder",
];

export const NEGATIVE: Classification[] = ["inaccuracy", "mistake", "miss", "blunder"];

/** Labels that get a badge on the board and a dot in the graph. */
export const HIGHLIGHTED: Classification[] = [
    "brilliant",
    "great",
    "inaccuracy",
    "mistake",
    "miss",
    "blunder",
];

// =============================
// NUMBERS
// =============================

/** Winning chances (0-100) for the side the centipawn value belongs to. */
export function winPct(cp: number): number {
    const clamped = Math.max(-10000, Math.min(10000, cp));
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

function moveAccuracy(loss: number): number {
    return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** "+1.4", "−0.3", "M3" - evaluation the way chess players write it. */
export function formatEval(move: Pick<ReviewMove, "evalCp" | "mate" | "mateFor"> | null): string {
    if (!move) return "0.0";

    if (move.mate !== null && move.mate !== undefined) {
        if (move.mate === 0) return move.mateFor === "w" ? "1-0" : "0-1";
        return `${move.mateFor === "b" ? "−" : ""}M${move.mate}`;
    }

    const pawns = Math.abs(move.evalCp) / 100;
    const text = pawns >= 10 ? pawns.toFixed(0) : pawns.toFixed(1);
    return `${move.evalCp > 0 ? "+" : move.evalCp < 0 ? "−" : ""}${text}`;
}

/** Share of the evaluation bar that belongs to White (0-1). */
export function whiteShare(move: Pick<ReviewMove, "evalCp" | "mate" | "mateFor"> | null): number {
    if (!move) return 0.5;
    if (move.mate !== null && move.mate !== undefined) return move.mateFor === "w" ? 1 : 0;
    return winPct(Math.max(-1500, Math.min(1500, move.evalCp))) / 100;
}

/** "12." for a white move, "12…" for a black move. */
export function moveLabel(move: Pick<ReviewMove, "moveNumber" | "color" | "san">): string {
    return `${move.moveNumber}${move.color === "w" ? "." : "…"} ${move.san}`;
}

// =============================
// OLDER ANALYSES
// =============================
// Analyses stored before the review was rebuilt only contain the engine
// evaluation per move. They are converted here so the screen has one format
// to deal with. (VIP users get them re-analysed automatically.)

type LegacyMove = {
    moveNumber: number;
    san: string;
    evalCp: number | null;
    bestMove?: string | null;
};

export function isCurrentReview(raw: any): raw is GameReview {
    return !!raw && typeof raw === "object" && raw.version === 2 && Array.isArray(raw.moves);
}

export function normalizeAnalysis(raw: any): GameReview | null {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.moves)) return null;
    if (isCurrentReview(raw)) {
        // Fill in fields that may be missing so the screen can rely on them.
        return {
            ...raw,
            opening: raw.opening ?? { name: null, plies: 0 },
            keyMoments: raw.keyMoments ?? [],
            playerColor: raw.playerColor === "w" || raw.playerColor === "b" ? raw.playerColor : null,
            players: raw.players ?? null,
            estimatedRating: raw.estimatedRating ?? { w: null, b: null },
        };
    }

    const legacy = raw.moves as LegacyMove[];
    const moves: ReviewMove[] = [];
    const counts: GameReview["counts"] = { w: {}, b: {} };
    const sum = { w: 0, b: 0 };
    const count = { w: 0, b: 0 };

    let previousCp = 0;

    legacy.forEach((m, index) => {
        const color: Side = index % 2 === 0 ? "w" : "b";
        const evalCp = typeof m.evalCp === "number" ? m.evalCp : previousCp;

        const before = color === "w" ? winPct(previousCp) : 100 - winPct(previousCp);
        const after = color === "w" ? winPct(evalCp) : 100 - winPct(evalCp);
        const loss = Math.max(0, before - after);

        let classification: Classification;
        if (before >= 80 && after <= 65 && loss >= 12 && after >= 35) classification = "miss";
        else if (loss > 20) classification = "blunder";
        else if (loss > 10) classification = "mistake";
        else if (loss > 5) classification = "inaccuracy";
        else if (loss <= 0.5) classification = "best";
        else if (loss <= 2) classification = "excellent";
        else classification = "good";

        const accuracy = moveAccuracy(loss);
        counts[color][classification] = (counts[color][classification] || 0) + 1;
        sum[color] += accuracy;
        count[color] += 1;

        moves.push({
            ply: index,
            moveNumber: m.moveNumber ?? Math.floor(index / 2) + 1,
            color,
            san: m.san,
            evalCp,
            mate: Math.abs(evalCp) >= 9900 ? Math.max(0, 10000 - Math.abs(evalCp)) : null,
            mateFor: Math.abs(evalCp) >= 9900 ? (evalCp > 0 ? "w" : "b") : null,
            bestMove: m.bestMove ?? null,
            bestSan: null,
            bestLine: [],
            reply: [],
            classification,
            winBefore: round1(before),
            winAfter: round1(after),
            loss: round1(loss),
            accuracy: round1(accuracy),
        });

        previousCp = evalCp;
    });

    const average = (side: Side) => (count[side] ? round1(sum[side] / count[side]) : null);

    return {
        version: 1,
        depth: typeof raw.depth === "number" ? raw.depth : 0,
        tier: typeof raw.tier === "string" ? raw.tier : "",
        opening: { name: null, plies: 0 },
        moves,
        accuracy: { w: average("w"), b: average("b") },
        estimatedRating: { w: null, b: null },
        counts,
        phases: {
            w: { opening: null, middlegame: null, endgame: null },
            b: { opening: null, middlegame: null, endgame: null },
        },
        keyMoments: moves
            .filter((m) => ["mistake", "miss", "blunder"].includes(m.classification))
            .map((m) => m.ply),
        playerColor: null,
        players: null,
    };
}

// =============================
// COACH TEXT
// =============================

function standing(win: number): string {
    if (win >= 97) return "completely winning";
    if (win >= 85) return "winning";
    if (win >= 68) return "clearly better";
    if (win >= 57) return "slightly better";
    if (win > 43) return "about equal";
    if (win > 32) return "slightly worse";
    if (win > 15) return "clearly worse";
    return "losing";
}

const MOTIF_TEXT: Record<string, string> = {
    fork: "a fork",
    pin: "a pin",
    skewer: "a skewer",
};

export type MoveComment = {
    /** e.g. "Nf3 is a mistake" */
    headline: string;
    /** One or two sentences of explanation. */
    text: string;
};

/**
 * Short explanation of a move in plain language.
 *
 * @param move        the move to explain
 * @param review      the whole review (for the opening name and the players)
 */
export function describeMove(
    move: ReviewMove,
    review: Pick<GameReview, "opening" | "playerColor">,
    language: "en" | "de" = "en"
): MoveComment {
    if (language === "de") return describeMoveDe(move, review);

    const meta = CLASSIFICATION_META[move.classification];
    const isYou = review.playerColor !== null && review.playerColor === move.color;
    const knowsPlayer = review.playerColor !== null;

    const who = knowsPlayer ? (isYou ? "You" : "Your opponent") : move.color === "w" ? "White" : "Black";
    const whoIs = knowsPlayer ? (isYou ? "You are" : "Your opponent is") : `${who} is`;
    const other = knowsPlayer
        ? isYou
            ? "your opponent"
            : "you"
        : move.color === "w"
            ? "Black"
            : "White";

    // Mid-sentence form: "you are" / "your opponent is", but "White is".
    const whoIsMid = knowsPlayer ? whoIs.charAt(0).toLowerCase() + whoIs.slice(1) : whoIs;

    const best = move.bestSan && move.bestSan !== move.san ? move.bestSan : null;
    const after = standing(move.winAfter);
    const reply = move.reply[0] ?? null;

    const mateForMover = move.mate !== null && move.mateFor === move.color;
    const mateAgainstMover = move.mate !== null && move.mateFor !== null && move.mateFor !== move.color;

    const article = /^[aeiou]/i.test(meta.label) ? "an" : "a";
    let headline = `${move.san} is ${article} ${meta.label.toLowerCase()}`;
    let text = "";

    switch (move.classification) {
        case "brilliant":
            headline = `${move.san} is brilliant`;
            text = `A sacrifice that works: the piece can be taken, but ${whoIsMid} ${after} afterwards.`;
            if (mateForMover && move.mate) text = `A sacrifice that leads to mate in ${move.mate}.`;
            break;

        case "great":
            headline = `${move.san} is a great move`;
            text = `The only move that keeps the position together - everything else was clearly worse. ${whoIs} ${after}.`;
            break;

        case "best":
            headline = move.mate === 0 ? `${move.san} is checkmate` : `${move.san} is the best move`;
            text =
                move.mate === 0
                    ? "The game is over."
                    : mateForMover && move.mate
                        ? `Mate in ${move.mate} is on the board.`
                        : `Exactly what the engine would play. ${whoIs} ${after}.`;
            break;

        case "excellent":
            headline = `${move.san} is excellent`;
            text = best
                ? `Almost as strong as the engine's first choice ${best}.`
                : "Almost as strong as the engine's first choice.";
            break;

        case "good":
            headline = `${move.san} is good`;
            text = best ? `A solid move. ${best} was a little stronger.` : "A solid move.";
            break;

        case "book":
            headline = `${move.san} is a book move`;
            text = review.opening.name
                ? `Known opening theory: ${review.opening.name}.`
                : "Known opening theory.";
            break;

        case "forced":
            headline = `${move.san} is forced`;
            text = "The only legal move.";
            break;

        case "inaccuracy":
            text = best ? `${best} was more precise.` : "There was a more precise move.";
            text += ` ${whoIs} ${after} now.`;
            break;

        case "mistake":
            text = best ? `${best} was clearly better.` : "There was a clearly better move.";
            if (move.motif?.type && best) {
                text = `${best} was clearly better - it sets up ${MOTIF_TEXT[move.motif.type]}.`;
            }
            text += ` ${whoIs} ${after} now.`;
            break;

        case "miss":
            headline = `${move.san} misses a chance`;
            text = best
                ? `${capitalize(other)} went wrong on the move before and ${best} would have punished it.`
                : `${capitalize(other)} went wrong on the move before and this lets them off the hook.`;
            if (move.motif?.type && best) {
                text = `${best} was ${MOTIF_TEXT[move.motif.type]} and would have punished the last move.`;
            }
            break;

        case "blunder":
            if (mateAgainstMover && move.mate) {
                text = reply
                    ? `After ${reply} it is mate in ${move.mate}.`
                    : `This allows mate in ${move.mate}.`;
            } else if (reply) {
                text = `${capitalize(other)} can answer ${reply}, and ${whoIsMid} ${after}.`;
            } else {
                text = `${whoIs} ${after} now.`;
            }
            if (best) text += ` ${best} was the move.`;
            break;
    }

    return { headline, text };
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** One sentence about the whole game for the summary card. */
export function summarize(review: GameReview, language: "en" | "de" = "en"): string {
    if (language === "de") return summarizeDe(review);

    const { accuracy, playerColor } = review;
    const w = accuracy.w ?? 0;
    const b = accuracy.b ?? 0;

    const name = (side: Side) =>
        playerColor ? (side === playerColor ? "You" : "Your opponent") : side === "w" ? "White" : "Black";

    const blunders = (side: Side) =>
        (review.counts[side].blunder || 0) + (review.counts[side].miss || 0) + (review.counts[side].mistake || 0);

    const lead = w === b ? null : w > b ? "w" : "b";

    if (!lead || Math.abs(w - b) < 3) {
        return "A close game - both sides played with similar accuracy.";
    }

    const errors = blunders(lead === "w" ? "b" : "w");
    const loser = name(lead === "w" ? "b" : "w");

    const loserMid = playerColor ? loser.charAt(0).toLowerCase() + loser.slice(1) : loser;

    return `${name(lead)} played the more accurate game${
        errors > 0 ? `; ${loserMid} made ${errors} serious ${errors === 1 ? "error" : "errors"}` : ""
    }.`;
}

// =============================
// COACH TEXT - GERMAN
// =============================
// The same explanations as above in German. They are written out instead of
// being translated word by word, because the sentence order differs.

function standingDe(win: number): string {
    if (win >= 97) return "klar auf Gewinn";
    if (win >= 85) return "auf Gewinn";
    if (win >= 68) return "deutlich besser";
    if (win >= 57) return "etwas besser";
    if (win > 43) return "ungefähr ausgeglichen";
    if (win > 32) return "etwas schlechter";
    if (win > 15) return "deutlich schlechter";
    return "auf Verlust";
}

const MOTIF_TEXT_DE: Record<string, string> = {
    fork: "eine Gabel",
    pin: "eine Fesselung",
    skewer: "einen Spieß",
};

const HEADLINE_DE: Record<Classification, string> = {
    brilliant: "ist brillant",
    great: "ist ein starker Zug",
    best: "ist der beste Zug",
    excellent: "ist ausgezeichnet",
    good: "ist gut",
    book: "ist ein Buchzug",
    forced: "ist erzwungen",
    inaccuracy: "ist eine Ungenauigkeit",
    mistake: "ist ein Fehler",
    miss: "lässt eine Chance aus",
    blunder: "ist ein Patzer",
};

function describeMoveDe(move: ReviewMove, review: Pick<GameReview, "opening" | "playerColor">): MoveComment {
    const knowsPlayer = review.playerColor !== null;
    const isYou = knowsPlayer && review.playerColor === move.color;

    // "Du stehst ..." / "Dein Gegner steht ..." / "Weiß steht ..."
    const stands = (positionText: string, suffix = "") => {
        if (!knowsPlayer) return `${move.color === "w" ? "Weiß" : "Schwarz"} steht${suffix} ${positionText}`;
        return isYou ? `Du stehst${suffix} ${positionText}` : `Dein Gegner steht${suffix} ${positionText}`;
    };
    // The same after a comma: "..., aber du stehst danach ..."
    const standsMid = (positionText: string, suffix = "") => {
        const sentence = stands(positionText, suffix);
        return knowsPlayer ? sentence.charAt(0).toLowerCase() + sentence.slice(1) : sentence;
    };

    const other = knowsPlayer ? (isYou ? "Dein Gegner" : "Du") : move.color === "w" ? "Schwarz" : "Weiß";
    const otherHas = other === "Du" ? "Du hast" : `${other} hat`;
    const otherCan = other === "Du" ? "Du kannst" : `${other} kann`;

    const best = move.bestSan && move.bestSan !== move.san ? move.bestSan : null;
    const after = standingDe(move.winAfter);
    const reply = move.reply[0] ?? null;

    const mateForMover = move.mate !== null && move.mateFor === move.color;
    const mateAgainstMover = move.mate !== null && move.mateFor !== null && move.mateFor !== move.color;

    let headline = `${move.san} ${HEADLINE_DE[move.classification]}`;
    let text = "";

    switch (move.classification) {
        case "brilliant":
            text = `Ein Opfer, das funktioniert: Die Figur kann geschlagen werden, aber ${standsMid(after, " danach")}.`;
            if (mateForMover && move.mate) text = `Ein Opfer, das zum Matt in ${move.mate} führt.`;
            break;

        case "great":
            text = `Der einzige Zug, der die Stellung hält - alles andere war deutlich schlechter. ${stands(after)}.`;
            break;

        case "best":
            if (move.mate === 0) headline = `${move.san} ist Schachmatt`;
            text =
                move.mate === 0
                    ? "Die Partie ist vorbei."
                    : mateForMover && move.mate
                        ? `Matt in ${move.mate} steht auf dem Brett.`
                        : `Genau das würde auch die Engine spielen. ${stands(after)}.`;
            break;

        case "excellent":
            text = best
                ? `Fast so stark wie die erste Wahl der Engine, ${best}.`
                : "Fast so stark wie die erste Wahl der Engine.";
            break;

        case "good":
            text = best ? `Ein solider Zug. ${best} war etwas stärker.` : "Ein solider Zug.";
            break;

        case "book":
            text = review.opening.name
                ? `Bekannte Eröffnungstheorie: ${review.opening.name}.`
                : "Bekannte Eröffnungstheorie.";
            break;

        case "forced":
            text = "Der einzige erlaubte Zug.";
            break;

        case "inaccuracy":
            text = best ? `${best} war genauer.` : "Es gab einen genaueren Zug.";
            text += ` ${stands(after, " jetzt")}.`;
            break;

        case "mistake":
            text = best ? `${best} war deutlich besser.` : "Es gab einen deutlich besseren Zug.";
            if (move.motif?.type && best && MOTIF_TEXT_DE[move.motif.type]) {
                text = `${best} war deutlich besser - der Zug bereitet ${MOTIF_TEXT_DE[move.motif.type]} vor.`;
            }
            text += ` ${stands(after, " jetzt")}.`;
            break;

        case "miss":
            text = best
                ? `${otherHas} im Zug davor einen Fehler gemacht, und ${best} hätte ihn bestraft.`
                : `${otherHas} im Zug davor einen Fehler gemacht, und dieser Zug lässt ihn ungestraft.`;
            if (move.motif?.type && best && MOTIF_TEXT_DE[move.motif.type]) {
                text = `${best} war ${MOTIF_TEXT_DE[move.motif.type]} und hätte den letzten Zug bestraft.`;
            }
            break;

        case "blunder":
            if (mateAgainstMover && move.mate) {
                text = reply
                    ? `Nach ${reply} ist es Matt in ${move.mate}.`
                    : `Das erlaubt Matt in ${move.mate}.`;
            } else if (reply) {
                text = `${otherCan} mit ${reply} antworten, und ${standsMid(after)}.`;
            } else {
                text = `${stands(after, " jetzt")}.`;
            }
            if (best) text += ` ${best} war der richtige Zug.`;
            break;
    }

    return { headline, text };
}

function summarizeDe(review: GameReview): string {
    const { accuracy, playerColor } = review;
    const w = accuracy.w ?? 0;
    const b = accuracy.b ?? 0;

    const lead = w === b ? null : w > b ? "w" : "b";

    if (!lead || Math.abs(w - b) < 3) {
        return "Eine enge Partie - beide Seiten haben ähnlich genau gespielt.";
    }

    const loserSide: Side = lead === "w" ? "b" : "w";
    const errors =
        (review.counts[loserSide].blunder || 0) +
        (review.counts[loserSide].miss || 0) +
        (review.counts[loserSide].mistake || 0);

    const youLead = playerColor !== null && lead === playerColor;

    const winner = playerColor ? (youLead ? "Du hast" : "Dein Gegner hat") : lead === "w" ? "Weiß hat" : "Schwarz hat";
    const loser = playerColor
        ? youLead
            ? "deinem Gegner"
            : "dir"
        : loserSide === "w"
            ? "Weiß"
            : "Schwarz";

    const errorText =
        errors > 0
            ? `; ${loser} ${errors === 1 ? "ist ein schwerer Fehler" : `sind ${errors} schwere Fehler`} unterlaufen`
            : "";

    return `${winner} die genauere Partie gespielt${errorText}.`;
}
