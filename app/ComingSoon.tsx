import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function ComingSoonPage() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Coming Soon 🚀</Text>
            <Text style={styles.subtitle}>
                Diese Funktion wird bald verfügbar sein.  </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", alignItems: "center" },
    title: { fontSize: 28, fontWeight: "bold", marginBottom: 10 },
    subtitle: { fontSize: 16, color: "#555", textAlign: "center", paddingHorizontal: 20 },
});