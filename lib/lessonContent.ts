export type LessonExercise = {
    fen: string;
    /** Zugfolge "e2e4": Index 0 = Spieler, 1 = Antwort des Gegners (automatisch), 2 = Spieler, ... */
    moves: string[];
    /** Kurzer Denkanstoß (Hinweis-Stufe 1). Hinweis-Stufe 2 markiert die Figur auf dem Brett. */
    hint: string;
    /** Ein Satz: Warum ist das der richtige Zug? Wird nach dem Lösen angezeigt. */
    why: string;
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
        title: "Patzer vermeiden",
        short: "Ungedeckte Figuren erkennen – bei dir und beim Gegner.",
        coachMessage: "Patzer sehe ich öfter bei dir. Lass uns das gezielt trainieren.",
        explanation:
            "Ein Patzer kostet sofort Material oder die Partie, meist weil eine Figur ungedeckt stand. Wer vor jedem Zug kurz scannt, was hängt, spart die meisten Punkte.",
        steps: [
            "Was greift mein Gegner nach meinem Zug an?",
            "Steht eine meiner Figuren ungedeckt?",
            "Steht eine gegnerische Figur ungedeckt?",
        ],
        tip: "Ungedeckte Figuren sind die häufigste Fehlerquelle – auf beiden Seiten.",
        exercises: [
            {
                fen: "6k1/8/8/3q4/8/8/6PP/3R2K1 w - - 0 1",
                moves: ["d1d5"],
                hint: "Eine schwarze Figur steht ungedeckt. Welche?",
                why: "Die Dame auf d5 war ungedeckt – Turm schlägt Dame.",
            },
            {
                fen: "8/8/4k3/8/2b5/8/8/2R1K3 w - - 0 1",
                moves: ["c1c4"],
                hint: "Dein Turm steht auf der c-Linie. Was steht dort?",
                why: "Der Läufer auf c4 wird vom König nicht gedeckt – kostenloser Gewinn.",
            },
            {
                fen: "6k1/8/8/4r3/8/3N4/8/6K1 w - - 0 1",
                moves: ["d3e5"],
                hint: "Springer greifen in L-Form an. Was erreicht er von d3?",
                why: "Der Springer schlägt den ungedeckten Turm auf e5.",
            },
        ],
    },

    mistake: {
        title: "Fehler vermeiden",
        short: "Taktik-Muster: Läuferschlag, Gabel, Spieß.",
        coachMessage: "Dieses Muster taucht bei dir öfter auf. Schauen wir es uns an.",
        explanation:
            "Ein Fehler verschlechtert die Stellung spürbar, oft weil ein taktisches Motiv übersehen wird. Wer die Standardmuster kennt, sieht sie in der Partie sofort.",
        steps: [
            "Gibt es einen Schachzug für mich?",
            "Gibt es einen Schlagzug, der Material gewinnt?",
            "Greift eine Figur zwei Ziele gleichzeitig an?",
        ],
        tip: "Schach, Schlagen, Drohen – in dieser Reihenfolge prüfen.",
        exercises: [
            {
                fen: "6k1/8/8/8/8/2n5/6PP/4B1K1 w - - 0 1",
                moves: ["e1c3"],
                hint: "Dein Läufer läuft diagonal. Was steht auf seiner Diagonale?",
                why: "Der Springer auf c3 war ungedeckt.",
            },
            {
                fen: "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1",
                moves: ["d5c7", "e8f7", "c7a8"],
                hint: "Ein Springerschach, das noch etwas anderes angreift (Gabel).",
                why: "Springergabel: Nc7+ greift König und Turm an, danach fällt der Turm.",
            },
            {
                fen: "8/8/8/4k2q/8/8/8/R5K1 w - - 0 1",
                moves: ["a1a5", "e5d6", "a5h5"],
                hint: "König und Dame stehen auf einer Reihe. Schach von der Seite!",
                why: "Spieß: Der König muss weichen, dahinter fällt die Dame.",
            },
        ],
    },

    inaccuracy: {
        title: "Ungenauigkeiten reduzieren",
        short: "Nicht den guten, sondern den besten Zug finden.",
        coachMessage: "Kleine Ungenauigkeiten summieren sich. Hier trainieren wir genaues Hinschauen.",
        explanation:
            "Eine Ungenauigkeit ist kein grober Fehler, aber es gab einen klar besseren Zug. Vergleiche vor dem Ziehen mindestens zwei Kandidaten.",
        steps: [
            "Zwei bis drei Kandidatenzüge sammeln.",
            "Forcierende Züge zuerst: Schach, Schlagen, Drohung.",
            "Den besten wählen, nicht den erstbesten.",
        ],
        tip: "Der erste gute Zug ist selten der beste.",
        exercises: [
            {
                fen: "k3r3/8/5N2/8/8/8/6PP/6K1 w - - 0 1",
                moves: ["f6e8"],
                hint: "Welche gegnerische Figur ist ungedeckt und erreichbar?",
                why: "Der Turm auf e8 steht ungedeckt.",
            },
            {
                fen: "4q1k1/8/8/8/4N3/8/8/6K1 w - - 0 1",
                moves: ["e4f6", "g8f7", "f6e8"],
                hint: "Ein Schachgebot, das zusätzlich die Dame angreift.",
                why: "Nf6+ gabelt König und Dame.",
            },
            {
                fen: "6k1/p4ppp/1r6/8/8/4B3/6PP/3R2K1 w - - 0 1",
                moves: ["d1d8"],
                hint: "Bxb6 wäre okay – aber es gibt etwas Besseres. Denk an Matt.",
                why: "Rd8# ist Grundreihenmatt. Der Läuferschlag hätte nur getauscht.",
            },
        ],
    },

    missed_win: {
        title: "Gewinnchancen nutzen",
        short: "Matt- und Gewinnzüge finden, bevor du ruhig spielst.",
        coachMessage: "Hier war mehr drin, als du herausgeholt hast. Schauen wir, wie du es findest.",
        explanation:
            "Ein verpasster Gewinn heißt: Es gab eine klar gewinnende Fortsetzung, gespielt wurde sie nicht. Bei Vorteil zuerst nach forcierenden Zügen suchen.",
        steps: [
            "Gibt es ein Schachgebot?",
            "Ist es sogar Matt?",
            "Wenn nicht: Gibt es einen Zug, der Material gewinnt?",
        ],
        tip: "Im Vorteil zuerst die forcierenden Züge prüfen.",
        exercises: [
            {
                fen: "6k1/5ppp/8/8/8/8/6PP/R5K1 w - - 0 1",
                moves: ["a1a8"],
                hint: "Der schwarze König hat keine Fluchtfelder. Matt in 1.",
                why: "Grundreihenmatt: die eigenen Bauern versperren den König.",
            },
            {
                fen: "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1",
                moves: ["g1g7"],
                hint: "Die Dame wird vom eigenen König gedeckt. Welches Feld?",
                why: "Qg7# – der König deckt die Dame, dem Gegner bleibt kein Feld.",
            },
            {
                fen: "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1",
                moves: ["g5f7"],
                hint: "Der König ist von seinen eigenen Figuren eingesperrt.",
                why: "Springermatt auf f7 – der König erstickt an den eigenen Figuren.",
            },
        ],
    },

    slip: {
        title: "Ausrutscher minimieren",
        short: "Kurz innehalten: Gabeln und Abzugsschach erkennen.",
        coachMessage: "Ein kleiner Ausrutscher, aber genau den kann man trainieren.",
        explanation:
            "Ein Ausrutscher ist eine leichte Verschlechterung durch Nachlässigkeit oder Zeitdruck, nicht durch fehlendes Verständnis. Kurzes Innehalten bei kritischen Zügen reicht meist.",
        steps: [
            "Nicht aus Routine ziehen, sondern kurz stoppen.",
            "Schachs und Schlagzüge zuerst durchgehen.",
            "Einmal kontrollieren, was der Zug freigibt.",
        ],
        tip: "Auch in einfach aussehenden Stellungen einmal kurz innehalten.",
        exercises: [
            {
                fen: "2r1k3/8/8/1N6/8/8/6PP/6K1 w - - 0 1",
                moves: ["b5d6", "e8d7", "d6c8"],
                hint: "Ein Springerschach, das zusätzlich den Turm angreift.",
                why: "Nd6+ gabelt König und Turm.",
            },
            {
                fen: "3r3k/8/8/6N1/8/8/8/6K1 w - - 0 1",
                moves: ["g5f7", "h8g8", "f7d8"],
                hint: "Springerschach mit Doppelangriff auf den Turm.",
                why: "Nf7+ gabelt König und Turm auf d8.",
            },
            {
                fen: "4k3/8/6q1/4N3/8/8/8/4R2K w - - 0 1",
                moves: ["e5g6"],
                hint: "Dein Springer verdeckt den Turm. Ziehe ihn mit Gewinn weg.",
                why: "Abzugsschach: Nxg6+ schlägt die Dame, der Turm gibt Schach.",
            },
        ],
    },
};

const DEFAULT_LESSON: LessonContent = {
    title: "Lektion",
    short: "",
    coachMessage: "Lass uns diesen Fehlertyp gemeinsam durchgehen.",
    explanation: "Für diesen Fehlertyp gibt es noch keine Lektion.",
    steps: [],
    tip: "",
    exercises: [],
};

export function getLessonContent(mistakeType?: string): LessonContent {
    if (!mistakeType) return DEFAULT_LESSON;
    return LESSONS[mistakeType] ?? DEFAULT_LESSON;
}