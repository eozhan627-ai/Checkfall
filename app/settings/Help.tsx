import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function Hilfe() {
    return (
        <View style={styles.container}>

            <View style={styles.header}>
                <Text style={styles.title}>Help</Text>
                <Text style={styles.subtitle}>FAQ & Support</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>General</Text>
                    <Text style={styles.text}>
                        Checkfall is a chess app for playing, learning, and training.
                        Some features are still in development and may change over time.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Playing</Text>
                    <Text style={styles.text}>
                        • Play locally against another player or a bot{"\n"}
                        • Online matches are available through matchmaking
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Game History</Text>
                    <Text style={styles.text}>
                        Saved games are stored locally on your device.
                    </Text>

                    <Text style={styles.text}>
                        • Long-press a saved game to delete it{"\n"}
                        • Deleted games cannot be restored
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Important Notes</Text>
                    <Text style={styles.text}>
                        • This app is still in testing phase{"\n"}
                        • Visual or functional changes may occur{"\n"}
                        • Data is stored locally or on servers for online play
                    </Text>
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0B0B0B",
    },

    header: {
        paddingTop: 60,
        paddingHorizontal: 16,
        paddingBottom: 10,
    },

    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#fff",
    },

    subtitle: {
        fontSize: 14,
        color: "#aaa",
        marginTop: 4,
    },

    content: {
        padding: 16,
        gap: 12,
    },

    card: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },

    cardTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#fff",
        marginBottom: 6,
    },

    text: {
        fontSize: 13,
        lineHeight: 18,
        color: "#bbb",
    },
});