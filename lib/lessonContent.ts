
import { tr } from "./i18n";export type LessonExercise = {
    fen: string;
    /** Zugfolge "e2e4": Index 0 = Spieler, 1 = Antwort des Gegners (automatisch), 2 = Spieler, ... */
    moves: string[];
    /** Kurzer Denkanstoß (Hinweis-Stufe 1). Hinweis-Stufe 2 markiert die Figur auf dem Brett. */
    hint: string;
    /** Ein Satz: Warum ist das der richtige Zug? Wird nach dem Lösen angezeigt. */
    why: string;
    /** Shown by the coach when the exercise starts (instead of the default text). */
    intro?: string;
    /** The position comes from one of the user's own games. */
    fromOwnGame?: boolean;
};

export type LessonContent = {
    title: string;
    /** Ein Einzeiler für die Übersichtskarte */
    short: string;
    coachMessage: string;
    /** Maximal 2 Sätze */
    explanation: string;
    /** Kurze Checkliste, die man vor jedem Zug durchgeht */
    steps: string[];
    tip: string;
    exercises: LessonExercise[];
};

export const LESSONS: Record<string, LessonContent> = {
    blunder: {
        get title() { return tr("Avoid blunders"); },
        get short() { return tr("Spot undefended pieces – yours and your opponent's."); },
        get coachMessage() { return tr("I see blunders in your games quite often. Let's train that specifically."); },
        get explanation() { return tr("A blunder costs material or the game right away, usually because a piece was left undefended. Scanning for hanging pieces before every move saves the most points."); },
        steps: [
            "What does my opponent attack after my move?",
            "Is one of my pieces undefended?",
            "Is an enemy piece undefended?",
        ],
        get tip() { return tr("Undefended pieces are the most common source of mistakes – on both sides."); },
        exercises: [
            {
                fen: "6k1/8/8/3q4/8/8/6PP/3R2K1 w - - 0 1",
                moves: ["d1d5"],
                get hint() { return tr("One black piece is undefended. Which one?"); },
                get why() { return tr("The queen on d5 was undefended – rook takes queen."); },
            },
            {
                fen: "8/8/4k3/8/2b5/8/8/2R1K3 w - - 0 1",
                moves: ["c1c4"],
                get hint() { return tr("Your rook is on the c-file. What else is on it?"); },
                get why() { return tr("The bishop on c4 is not defended by the king – a free piece."); },
            },
            {
                fen: "6k1/8/8/4r3/8/3N4/8/6K1 w - - 0 1",
                moves: ["d3e5"],
                get hint() { return tr("Knights attack in an L-shape. What can it reach from d3?"); },
                get why() { return tr("The knight captures the undefended rook on e5."); },
            },
        ],
    },

    mistake: {
        get title() { return tr("Avoid mistakes"); },
        get short() { return tr("Tactical patterns: bishop capture, fork, skewer."); },
        get coachMessage() { return tr("This pattern shows up in your games quite often. Let's take a look."); },
        get explanation() { return tr("A mistake noticeably worsens the position, often because a tactical motif was missed. If you know the standard patterns, you spot them immediately in a game."); },
        steps: [
            "Do I have a check?",
            "Is there a capture that wins material?",
            "Does a piece attack two targets at once?",
        ],
        get tip() { return tr("Checks, captures, threats – check them in that order."); },
        exercises: [
            {
                fen: "6k1/8/8/8/8/2n5/6PP/4B1K1 w - - 0 1",
                moves: ["e1c3"],
                get hint() { return tr("Your bishop moves diagonally. What is on its diagonal?"); },
                get why() { return tr("The knight on c3 was undefended."); },
            },
            {
                fen: "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1",
                moves: ["d5c7", "e8f7", "c7a8"],
                get hint() { return tr("A knight check that also attacks something else (a fork)."); },
                get why() { return tr("Knight fork: Nc7+ attacks king and rook, and the rook falls next."); },
            },
            {
                fen: "8/8/8/4k2q/8/8/8/R5K1 w - - 0 1",
                moves: ["a1a5", "e5d6", "a5h5"],
                get hint() { return tr("King and queen are on the same rank. Check from the side!"); },
                get why() { return tr("Skewer: the king has to move and the queen behind it is lost."); },
            },
        ],
    },

    inaccuracy: {
        get title() { return tr("Reduce inaccuracies"); },
        get short() { return tr("Find the best move, not just a good one."); },
        get coachMessage() { return tr("Small inaccuracies add up. Here we practice looking closely."); },
        get explanation() { return tr("An inaccuracy is not a serious mistake, but there was a clearly better move. Compare at least two candidates before you move."); },
        steps: [
            "Collect two or three candidate moves.",
            "Forcing moves first: checks, captures, threats.",
            "Choose the best one, not the first one.",
        ],
        get tip() { return tr("The first good move is rarely the best one."); },
        exercises: [
            {
                fen: "k3r3/8/5N2/8/8/8/6PP/6K1 w - - 0 1",
                moves: ["f6e8"],
                get hint() { return tr("Which enemy piece is undefended and within reach?"); },
                get why() { return tr("The rook on e8 is undefended."); },
            },
            {
                fen: "4q1k1/8/8/8/4N3/8/8/6K1 w - - 0 1",
                moves: ["e4f6", "g8f7", "f6e8"],
                get hint() { return tr("A check that also attacks the queen."); },
                get why() { return tr("Nf6+ forks king and queen."); },
            },
            {
                fen: "6k1/p4ppp/1r6/8/8/4B3/6PP/3R2K1 w - - 0 1",
                moves: ["d1d8"],
                get hint() { return tr("Bxb6 would be okay – but there is something better. Think about mate."); },
                get why() { return tr("Rd8# is a back-rank mate. Taking with the bishop would only have traded."); },
            },
        ],
    },

    missed_win: {
        get title() { return tr("Convert winning chances"); },
        get short() { return tr("Find mating and winning moves before you play quietly."); },
        get coachMessage() { return tr("There was more in this position than you got out of it. Let's see how you can find it."); },
        get explanation() { return tr("A missed win means there was a clearly winning continuation that was not played. When you are ahead, look for forcing moves first."); },
        steps: [
            "Is there a check?",
            "Is it even mate?",
            "If not: is there a move that wins material?",
        ],
        get tip() { return tr("When ahead, check the forcing moves first."); },
        exercises: [
            {
                fen: "6k1/5ppp/8/8/8/8/6PP/R5K1 w - - 0 1",
                moves: ["a1a8"],
                get hint() { return tr("The black king has no escape squares. Mate in 1."); },
                get why() { return tr("Back-rank mate: the king is blocked by its own pawns."); },
            },
            {
                fen: "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1",
                moves: ["g1g7"],
                get hint() { return tr("The queen is defended by your own king. Which square?"); },
                get why() { return tr("Qg7# – the king defends the queen and the opponent has no square left."); },
            },
            {
                fen: "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1",
                moves: ["g5f7"],
                get hint() { return tr("The king is boxed in by its own pieces."); },
                get why() { return tr("Knight mate on f7 – the king is smothered by its own pieces."); },
            },
        ],
    },

    slip: {
        get title() { return tr("Minimize slips"); },
        get short() { return tr("Pause briefly: spot forks and discovered checks."); },
        get coachMessage() { return tr("A small slip, but that is exactly what you can train."); },
        get explanation() { return tr("A slip is a slight worsening caused by carelessness or time pressure, not by a lack of understanding. A short pause at critical moves is usually enough."); },
        steps: [
            "Do not move out of routine – stop for a moment.",
            "Go through checks and captures first.",
            "Check once what the move gives up.",
        ],
        get tip() { return tr("Pause briefly even in positions that look simple."); },
        exercises: [
            {
                fen: "2r1k3/8/8/1N6/8/8/6PP/6K1 w - - 0 1",
                moves: ["b5d6", "e8d7", "d6c8"],
                get hint() { return tr("A knight check that also attacks the rook."); },
                get why() { return tr("Nd6+ forks king and rook."); },
            },
            {
                fen: "3r3k/8/8/6N1/8/8/8/6K1 w - - 0 1",
                moves: ["g5f7", "h8g8", "f7d8"],
                get hint() { return tr("A knight check with a double attack on the rook."); },
                get why() { return tr("Nf7+ forks the king and the rook on d8."); },
            },
            {
                fen: "4k3/8/6q1/4N3/8/8/8/4R2K w - - 0 1",
                moves: ["e5g6"],
                get hint() { return tr("Your knight is blocking the rook. Move it away with a gain."); },
                get why() { return tr("Discovered check: Nxg6+ takes the queen while the rook gives check."); },
            },
        ],
    },
};

const DEFAULT_LESSON: LessonContent = {
    get title() { return tr("Lesson"); },
    short: "",
    get coachMessage() { return tr("Let's go through this type of mistake together."); },
    get explanation() { return tr("There is no lesson for this type of mistake yet."); },
    steps: [],
    tip: "",
    exercises: [],
};

export function getLessonContent(mistakeType?: string): LessonContent {
    if (!mistakeType) return DEFAULT_LESSON;
    return LESSONS[mistakeType] ?? DEFAULT_LESSON;
}