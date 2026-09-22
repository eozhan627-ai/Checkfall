export type LessonExercise = {
    fen: string;
    moves: string[]; // Zugfolge im UCI-artigen Format ("e2e4"), gleiches Schema wie puzzle.json
};

export type LessonContent = {
    title: string;
    coachMessage: string;
    explanation: string;
    tip: string;
    exercises: LessonExercise[];
};

export const LESSONS: Record<string, LessonContent> = {
    blunder: {
        title: "Patzer vermeiden",
        coachMessage: "Diesen Fehlertyp sehe ich öfter bei dir — lass uns das gemeinsam durchgehen.",
        explanation: "Ein Patzer ist ein grober Fehler, der sofort Material oder die Partie kostet — meist, weil eine gegnerische Antwort übersehen wurde. Bevor du ziehst, prüfe kurz: Kann mein Gegner nach diesem Zug eine Figur schlagen, ein Matt setzen oder eine Fesselung ausnutzen?",
        tip: "Faustregel: Prüfe nach jedem geplanten Zug, welche drei stärksten Antworten dein Gegner hätte.",
        exercises: [
            {
                // Weiß am Zug, schwarze Dame steht ungedeckt auf d5
                fen: "6k1/8/8/3q4/8/8/6PP/3R2K1 w - - 0 1",
                moves: ["d1d5"],
            },
        ],
    },
    mistake: {
        title: "Fehler vermeiden",
        coachMessage: "Das ist ein Muster, das bei dir häufiger vorkommt — schauen wir's uns an.",
        explanation: "Ein Fehler ist ein Zug, der die Stellung spürbar verschlechtert, auch wenn er nicht sofort Material kostet. Oft entsteht er durch einen zu kurzen Plan oder das Übersehen einer positionellen Schwäche, die der Gegner ausnutzen kann.",
        tip: "Faustregel: Frag dich vor dem Zug nicht nur 'Ist das sicher?', sondern auch 'Verbessert das meine Stellung wirklich?'",
        exercises: [
            {
                // Weiß am Zug, schwarzer Springer steht ungedeckt auf c3
                fen: "6k1/8/8/8/8/2n5/6PP/4B1K1 w - - 0 1",
                moves: ["e1c3"],
            },
        ],
    },
    inaccuracy: {
        title: "Ungenauigkeiten reduzieren",
        coachMessage: "Kleinigkeiten wie diese summieren sich über die Partie — lohnt sich, genauer hinzuschauen.",
        explanation: "Eine Ungenauigkeit ist kein grober Fehler, aber nicht der objektiv beste Zug — die Engine hätte eine klar bessere Fortsetzung gefunden. Häufig passiert das, wenn man sich zu schnell für eine 'gute genug' Option entscheidet, statt kurz die Alternativen zu vergleichen.",
        tip: "Faustregel: Nimm dir bei ruhigen Stellungen einen Moment mehr Zeit und vergleiche mindestens zwei plausible Züge, bevor du ziehst.",
        exercises: [
            {
                // Weißer Springer kann den ungedeckten schwarzen Turm auf e8 gewinnen
                fen: "k3r3/8/5N2/8/8/8/6PP/6K1 w - - 0 1",
                moves: ["f6e8"],
            },
        ],
    },
    missed_win: {
        title: "Gewinnchancen nicht verpassen",
        coachMessage: "Hier war mehr drin, als du rausgeholt hast — lass es uns anschauen.",
        explanation: "Ein verpasster Gewinn bedeutet, dass eine klar gewinnende Fortsetzung zur Verfügung stand, die nicht gespielt wurde. Das passiert oft, wenn man sich mit einem 'guten' Zug zufriedengibt, statt aktiv nach der stärksten, entscheidenden Fortsetzung zu suchen.",
        tip: "Faustregel: Wenn du im Vorteil bist, prüfe gezielt nach forcierenden Zügen — Schachs, Schlagzügen, Drohungen — bevor du einen ruhigen Zug spielst.",
        exercises: [
            {
                // Matt in 1: Ra8 ist Grundreihenmatt
                fen: "6k1/5ppp/8/8/8/8/6PP/R5K1 w - - 0 1",
                moves: ["a1a8"],
            },
        ],
    },
    slip: {
        title: "Ausrutscher minimieren",
        coachMessage: "Ein kleiner Ausrutscher, aber genau solche Kleinigkeiten kann man trainieren.",
        explanation: "Ein Ausrutscher ist eine leichte Verschlechterung, oft aus Nachlässigkeit oder Zeitdruck entstanden, nicht aus fehlendem Verständnis. Meist reicht schon etwas mehr Konzentration in entscheidenden Momenten, um diese Fehler zu vermeiden.",
        tip: "Faustregel: Bei kritischen Zügen kurz innehalten, statt aus Routine zu ziehen — auch wenn die Stellung einfach aussieht.",
        exercises: [
            {
                // Springergabel: Sb5-d6+ gabelt König e8 und Turm c8
                fen: "2r1k3/8/8/1N6/8/8/6PP/6K1 w - - 0 1",
                moves: ["b5d6"],
            },
        ],
    },
};

const DEFAULT_LESSON: LessonContent = {
    title: "Lektion",
    coachMessage: "Lass uns diesen Fehlertyp gemeinsam durchgehen.",
    explanation: "Für diesen Fehlertyp gibt es noch keinen spezifischen Erklärungstext.",
    tip: "",
    exercises: [],
};

export function getLessonContent(mistakeType?: string): LessonContent {
    if (!mistakeType) return DEFAULT_LESSON;
    return LESSONS[mistakeType] ?? DEFAULT_LESSON;
}