import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function LessonScreen() {
    const { title, explanation, mistake_type } = useLocalSearchParams<{
        id: string;
        title: string;
        explanation: string;
        mistake_type: string;
    }>();

    const coachImage = require("../../assets/images/coach.png");

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.iconButton}>
                    <Text style={styles.backText}>‹</Text>
                </Pressable>
                <Text style={styles.title}>{title}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.coachRow}>
                    <Image source={coachImage} style={styles.coachImage} resizeMode="contain" />
                    <View style={styles.coachBubble}>
                        <Text style={styles.label}>{mistake_type?.replace(/_/g, " ")}</Text>
                    </View>
                </View>

                <Text style={styles.explanation}>{explanation}</Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0F1115" },
    header: {
        marginTop: 50,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: "rgba(23,26,32,0.92)",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 14,
    },
    backText: { color: "#ECEDEE", fontSize: 26, fontWeight: "300" },
    title: { fontSize: 22, fontWeight: "800", color: "#fff", flexShrink: 1 },
    content: { padding: 20 },
    coachRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 20,
    },
    coachImage: {
        width: 64,
        height: 64,
        borderRadius: 32,
        marginRight: 14,
    },
    coachBubble: {
        flex: 1,
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
    },
    label: {
        fontSize: 13,
        fontWeight: "700",
        color: "rgba(255,255,255,0.85)",
        textTransform: "uppercase",
    },
    explanation: { fontSize: 16, color: "#ECEDEE", lineHeight: 24 },
});
