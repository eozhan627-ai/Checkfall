import { ScrollView, StyleSheet, Text } from "react-native";

export default function Hilfe() {
    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>

            <Text style={styles.title}>Hilfe</Text>

            {/* 🔹 Allgemein */}
            <Text style={styles.sectionTitle}>Allgemein</Text>
            <Text style={styles.text}>
                Checkfall ist eine Schach-App zum Spielen, Lernen und Trainieren.
                Einige Funktionen befinden sich noch in Entwicklung.
            </Text>

            {/* 🔹 Spielen */}
            <Text style={styles.sectionTitle}>Spielen</Text>
            <Text style={styles.text}>
                • Du kannst lokal gegen dich selbst oder einen Bot spielen.
                {"\n"}• Online-Spiele sind aktuell noch nicht verfügbar.
            </Text>



            {/* 🔹 Spielverlauf */}
            <Text style={styles.sectionTitle}>Spielverlauf</Text>
            <Text style={styles.text}>
                Gespielte Partien werden lokal auf deinem Gerät gespeichert.
            </Text>
            <Text style={styles.text}>

                {"\n"}• Halte ein gespeichertes Spiel gedrückt, um es zu löschen.
            </Text>
            <Text style={styles.text}>
                Hinweis: Gelöschte Spiele können nicht wiederhergestellt werden.
            </Text>

            {/* 🔹 Hinweise */}
            <Text style={styles.sectionTitle}>Hinweise</Text>
            <Text style={styles.text}>
                • Diese App befindet sich aktuell in der Testphase.
                {"\n"}• Es kann zu Darstellungs- oder Funktionsabweichungen kommen.
                {"\n"}• Alle Daten werden ausschließlich lokal gespeichert.
            </Text>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f0f0f0",
    },
    content: {
        padding: 16,
        paddingBottom: 40, // 👈 Abstand nach unten
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        marginTop: 16,
        marginBottom: 6,
    },
    text: {
        fontSize: 14,
        lineHeight: 20,
        color: "#334155",
    },
});