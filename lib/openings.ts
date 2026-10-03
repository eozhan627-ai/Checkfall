// Openings for the opening trainer (a VIP feature).
//
// Every line is checked for legal moves in tests/openings.test.mjs. The
// texts are English; German versions are in lib/translations/de.ts.

export type Opening = {
    id: string;
    name: string;
    /** Opening code used in chess books and databases. */
    eco: string;
    /** The side that is trained. */
    side: "w" | "b";
    /** Main line in standard notation. */
    moves: string[];
    /** What the opening is about, in one or two sentences. */
    summary: string;
    /** The plans worth remembering. */
    ideas: string[];
};

export const OPENINGS: Opening[] = [
    // ---------- White ----------
    {
        id: "italian",
        name: "Italian Game",
        eco: "C54",
        side: "w",
        moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d3", "d6", "O-O", "O-O", "Re1", "a6"],
        summary: "Quick development and a bishop aimed at f7. Calm, easy to learn and played at every level.",
        ideas: [
            "Put the bishop on c4, where it looks at the weak f7 pawn.",
            "Play c3 and later d4 to build a strong pawn centre.",
            "Castle early and bring the rook to e1 before you attack.",
        ],
    },
    {
        id: "ruy-lopez",
        name: "Ruy Lopez",
        eco: "C84",
        side: "w",
        moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O", "h3"],
        summary: "White puts pressure on the knight that defends e5. The classic way to fight for a lasting advantage.",
        ideas: [
            "The bishop on b5 attacks the defender of the e5 pawn.",
            "After a6 and b5 the bishop goes back to b3 and still aims at f7.",
            "Play c3 and d4 for the centre; h3 keeps a bishop away from g4.",
        ],
    },
    {
        id: "scotch",
        name: "Scotch Game",
        eco: "C45",
        side: "w",
        moves: ["e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4", "Nf6", "Nxc6", "bxc6", "e5", "Qe7", "Qe2", "Nd5", "c4"],
        summary: "White opens the centre at once with d4. Direct play with open lines for the pieces.",
        ideas: [
            "Strike in the centre with d4 on move three.",
            "The pawn on e5 chases the knight and gains space.",
            "c4 attacks the knight on d5 and frees your pieces.",
        ],
    },
    {
        id: "vienna",
        name: "Vienna Game",
        eco: "C29",
        side: "w",
        moves: ["e4", "e5", "Nc3", "Nf6", "f4", "d5", "fxe5", "Nxe4", "Nf3", "Be7", "d4", "O-O", "Bd3"],
        summary: "A knight to c3 first, then f4. A surprise weapon that leads to lively positions.",
        ideas: [
            "Nc3 protects e4 and keeps the f-pawn free to advance.",
            "f4 attacks the centre like a King's Gambit, but more safely.",
            "After d4 and Bd3 your pieces point at the black king.",
        ],
    },
    {
        id: "kings-gambit",
        name: "King's Gambit",
        eco: "C39",
        side: "w",
        moves: ["e4", "e5", "f4", "exf4", "Nf3", "g5", "h4", "g4", "Ne5", "Nf6", "d4", "d6", "Nd3", "Nxe4", "Bxf4"],
        summary: "White gives a pawn for a fast attack. Sharp and risky - games are decided early.",
        ideas: [
            "The f-pawn is offered to pull the e5 pawn away from the centre.",
            "h4 breaks up the black pawn chain on the king side.",
            "Win the pawn on f4 back and use the open f-file.",
        ],
    },
    {
        id: "london",
        name: "London System",
        eco: "D02",
        side: "w",
        moves: ["d4", "d5", "Bf4", "Nf6", "e3", "c5", "c3", "Nc6", "Nd2", "e6", "Ngf3", "Bd6", "Bg3", "O-O", "Bd3"],
        summary: "The same solid setup against almost everything. Little theory, a safe king and clear plans.",
        ideas: [
            "Bring the bishop to f4 before you play e3.",
            "The pawns on c3, d4 and e3 form a triangle that is hard to break.",
            "Later the knight goes to e5 and you attack on the king side.",
        ],
    },
    {
        id: "queens-gambit",
        name: "Queen's Gambit",
        eco: "D58",
        side: "w",
        moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7", "e3", "O-O", "Nf3", "h6", "Bh4", "b6"],
        summary: "White offers the c-pawn to take over the centre. Strategic chess with long-term pressure.",
        ideas: [
            "c4 attacks d5 - if Black takes, you get the centre with e4.",
            "The bishop on g5 pins the knight that defends d5.",
            "Develop calmly: e3, Nf3, then the rooks to the c- and d-file.",
        ],
    },
    {
        id: "english",
        name: "English Opening",
        eco: "A29",
        side: "w",
        moves: ["c4", "e5", "Nc3", "Nf6", "g3", "d5", "cxd5", "Nxd5", "Bg2", "Nb6", "Nf3", "Nc6", "O-O", "Be7"],
        summary: "White controls the centre from the side with the c-pawn. Flexible and hard to prepare against.",
        ideas: [
            "c4 controls d5 without committing the centre pawns.",
            "The bishop on g2 presses along the long diagonal.",
            "You play a Sicilian with an extra move - use the time.",
        ],
    },

    // ---------- Black ----------
    {
        id: "sicilian-najdorf",
        name: "Sicilian Najdorf",
        eco: "B90",
        side: "b",
        moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6", "Be3", "e5", "Nb3", "Be6", "f3", "Be7", "Qd2", "O-O"],
        summary: "The most ambitious answer to e4. Black fights for the win from the first move.",
        ideas: [
            "c5 trades a side pawn for White's centre pawn.",
            "a6 keeps the white pieces away from b5 and prepares b5.",
            "e5 gains space; your play is on the queen side and the c-file.",
        ],
    },
    {
        id: "sicilian-dragon",
        name: "Sicilian Dragon",
        eco: "B76",
        side: "b",
        moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6", "Be3", "Bg7", "f3", "O-O", "Qd2", "Nc6", "O-O-O"],
        summary: "The bishop on g7 breathes fire along the long diagonal. Both sides attack on opposite wings.",
        ideas: [
            "The bishop on g7 is your best piece - never trade it lightly.",
            "Use the half-open c-file for your rook and queen.",
            "White attacks your king, you attack theirs - speed decides.",
        ],
    },
    {
        id: "french",
        name: "French Defense",
        eco: "C14",
        side: "b",
        moves: ["e4", "e6", "d4", "d5", "Nc3", "Nf6", "Bg5", "Be7", "e5", "Nfd7", "Bxe7", "Qxe7", "f4", "O-O", "Nf3", "c5"],
        summary: "A solid wall of pawns, then a counter-attack on White's centre. Tough to break down.",
        ideas: [
            "e6 and d5 challenge the e4 pawn at once.",
            "When White plays e5, attack the pawn chain at its base with c5.",
            "Your light bishop is passive - plan how to activate or trade it.",
        ],
    },
    {
        id: "caro-kann",
        name: "Caro-Kann Defense",
        eco: "B18",
        side: "b",
        moves: ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Bf5", "Ng3", "Bg6", "h4", "h6", "Nf3", "Nd7", "h5", "Bh7", "Bd3", "Bxd3", "Qxd3", "e6"],
        summary: "As solid as the French, but the light bishop gets out first. A safe choice with few weaknesses.",
        ideas: [
            "c6 supports d5 without blocking the bishop on c8.",
            "Develop the bishop to f5 before you play e6.",
            "Your pawn structure is healthy - endgames are often good for you.",
        ],
    },
    {
        id: "scandinavian",
        name: "Scandinavian Defense",
        eco: "B01",
        side: "b",
        moves: ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qa5", "d4", "Nf6", "Nf3", "c6", "Bc4", "Bf5", "Bd2", "e6"],
        summary: "Black challenges e4 on the very first move. Simple to learn, with a clear setup.",
        ideas: [
            "After Qxd5 and Nc3 the queen steps aside to a5.",
            "c6 gives the queen a way back and guards d5.",
            "Bf5 and e6 give you a solid Caro-Kann structure.",
        ],
    },
    {
        id: "petrov",
        name: "Petrov's Defense",
        eco: "C42",
        side: "b",
        moves: ["e4", "e5", "Nf3", "Nf6", "Nxe5", "d6", "Nf3", "Nxe4", "d4", "d5", "Bd3", "Nc6", "O-O", "Be7"],
        summary: "Black answers the attack on e5 with an attack on e4. Very solid and hard to beat.",
        ideas: [
            "Do not take on e4 at once - first chase the knight with d6.",
            "The knight on e4 is strong; support it with d5.",
            "The position is symmetrical: develop quickly and castle.",
        ],
    },
    {
        id: "kings-indian",
        name: "King's Indian Defense",
        eco: "E97",
        side: "b",
        moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "Nf3", "O-O", "Be2", "e5", "O-O", "Nc6", "d5", "Ne7"],
        summary: "Black lets White build a big centre and then attacks it. Leads to fierce king-side attacks.",
        ideas: [
            "Castle first, then strike at the centre with e5.",
            "When the centre is closed, attack on the king side with f5.",
            "The knight goes from c6 to e7 and on to the king side.",
        ],
    },
    {
        id: "nimzo-indian",
        name: "Nimzo-Indian Defense",
        eco: "E54",
        side: "b",
        moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4", "e3", "O-O", "Bd3", "d5", "Nf3", "c5", "O-O", "Nc6"],
        summary: "The bishop pins the knight on c3 and stops e4. One of the most respected defences to d4.",
        ideas: [
            "Bb4 pins the knight and fights for the e4 square.",
            "Be ready to give the bishop for the knight to damage White's pawns.",
            "d5 and c5 attack the white centre from both sides.",
        ],
    },
    {
        id: "slav",
        name: "Slav Defense",
        eco: "D18",
        side: "b",
        moves: ["d4", "d5", "c4", "c6", "Nf3", "Nf6", "Nc3", "dxc4", "a4", "Bf5", "e3", "e6", "Bxc4", "Bb4", "O-O", "O-O"],
        summary: "Black defends d5 with the c-pawn and keeps the bishop free. Solid with real winning chances.",
        ideas: [
            "c6 holds d5 and leaves the diagonal of the c8 bishop open.",
            "Take on c4 when White cannot win the pawn back easily.",
            "Bf5 first, then e6 - the bishop stays outside the pawn chain.",
        ],
    },
    {
        id: "gruenfeld",
        name: "Grünfeld Defense",
        eco: "D85",
        side: "b",
        moves: ["d4", "Nf6", "c4", "g6", "Nc3", "d5", "cxd5", "Nxd5", "e4", "Nxc3", "bxc3", "Bg7", "Nf3", "c5"],
        summary: "Black gives White the centre on purpose and then attacks it with pieces. Dynamic and modern.",
        ideas: [
            "d5 invites White to build a big centre with e4.",
            "The bishop on g7 and the pawn on c5 attack d4 together.",
            "Your pieces must stay active - passive play loses here.",
        ],
    },
];

export function getOpening(id?: string | null): Opening | null {
    return OPENINGS.find((opening) => opening.id === id) ?? null;
}

/** "1. e4 e5 2. Nf3 Nc6 …" for the first `plies` half-moves. */
export function formatLine(moves: string[], plies: number = moves.length): string {
    const parts: string[] = [];

    moves.slice(0, plies).forEach((move, index) => {
        if (index % 2 === 0) parts.push(`${index / 2 + 1}.`);
        parts.push(move);
    });

    return parts.join(" ") + (plies < moves.length ? " …" : "");
}

/** How many moves the trained side plays in this line. */
export function ownMoveCount(opening: Opening): number {
    const first = opening.side === "w" ? 0 : 1;
    return opening.moves.filter((_, index) => index % 2 === first).length;
}

/** 3 stars = no mistake and no hint, 2 = up to two slips, otherwise 1. */
export function starsFor(mistakes: number, hints: number): number {
    const slips = mistakes + hints;
    if (slips === 0) return 3;
    if (slips <= 2) return 2;
    return 1;
}
