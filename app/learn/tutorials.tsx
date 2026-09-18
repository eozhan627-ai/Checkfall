import React from "react";
import { StyleSheet, Text, View } from "react-native";

export type LessonContent = {
    title: string;
    coachMessage: string;
    explanation: string;
    tip: string;
};

export const LESSONS: Record<string, LessonContent> = {
    blunder: {
        title: "Blunder vermeiden",
        coachMessage:
            "Diesen Fehlertyp sehe ich öfter bei dir — lass uns das gemeinsam durchgehen.",
        explanation:
            "Ein Blunder ist ein grober Fehler, der sofort Material oder die Partie kostet — meist, weil eine gegnerische Antwort übersehen wurde. Bevor du ziehst, prüfe kurz: Kann mein Gegner nach diesem Zug eine Figur schlagen, ein Matt setzen oder eine Fesselung ausnutzen?",
        tip: "Faustregel: Prüfe nach jedem geplanten Zug, welche drei stärksten Antworten dein Gegner hätte.",
    },
    opening_mistake: {
        title: "Fehler in der Eröffnung",
        coachMessage:
            "Der Start der Partie entscheidet oft mehr, als man denkt — schauen wir uns das an.",
        explanation:
            "In der Eröffnung geht es vor allem um Entwicklung, Zentrumskontrolle und Königssicherheit. Häufige Fehler sind: zu früh mit der Dame ziehen, dieselbe Figur mehrfach bewegen, oder die Rochade zu lange hinauszögern.",
        tip: "Faustregel: Entwickle in den ersten Zügen Springer und Läufer, bevor du die Dame aktiv einsetzt, und rochiere früh.",
    },
    endgame_mistake: {
        title: "Fehler im Endspiel",
        coachMessage: "Endspiele werden oft unterschätzt — dabei entscheiden sie viele Partien.",
        explanation:
            "Im Endspiel zählt jeder Zug doppelt: König aktivieren, Freibauern vorantreiben und Figuren koordinieren. Ein häufiger Fehler ist, den eigenen König passiv zu lassen, obwohl er im Endspiel eine starke Figur ist.",
        tip: "Faustregel: Sobald wenige Figuren auf dem Brett sind, wird dein König zu einer aktiven Kampffigur — nutze ihn.",
    },
    time_trouble: {
        title: "Zeitnot-Fehler",
        coachMessage: "Unter Zeitdruck passieren Fehler, die du normalerweise nie machen würdest.",
        explanation:
            "Fehler in Zeitnot entstehen meist, weil zu viel Zeit in unwichtigen Phasen verbraucht wurde. Wichtig ist, in klaren Stellungen schnell zu spielen und sich Bedenkzeit für wirklich kritische Momente aufzuheben.",
        tip: "Faustregel: Verbring die meiste Zeit auf den 3–5 wirklich entscheidenden Zügen der Partie, nicht auf jedem einzelnen.",
    },
};

const DEFAULT_LESSON: LessonContent = {
    title: "Lektion",
    coachMessage: "Lass uns diesen Fehlertyp gemeinsam durchgehen.",
    explanation: "Für diesen Fehlertyp gibt es noch keinen spezifischen Erklärungstext.",
    tip: "",
};

export function getLessonContent(mistakeType?: string): LessonContent {
    if (!mistakeType) return DEFAULT_LESSON;
    return LESSONS[mistakeType] ?? DEFAULT_LESSON;
}

// Default export nur, damit Expo Router die Datei als gültige Route akzeptiert.
// Diese Route wird aktuell nirgends verlinkt.
export default function TutorialsDataFile() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>—</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    text: { display: "none" },
});
