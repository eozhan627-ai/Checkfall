import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getLessonContent } from "../../lib/lessonContent";


export default function LessonScreen() {
    const { id, title, explanation, mistake_type } = useLocalSearchParams<{
        id: string;
        title: string;
        explanation: string;
        mistake_type: string;
    }>();

    const coachImage = require("../../assets/images/coach.png");
    const content = getLessonContent(mistake_type);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.iconButton}>
                    <Text style={styles.backText}>‹</Text>
                </Pressable>
                <Text style={styles.title}>{title || content.title}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Coach mit Sprechblase, die zu ihm zeigt */}
                <View style={styles.coachRow}>
                    <View style={styles.bubble}>
                        <Text style={styles.bubbleText}>{content.coachMessage}</Text>
                        <View style={styles.bubbleTail} />
                    </View>
                    <Image source={coachImage} style={styles.coachImage} resizeMode="contain" />
                </View>

                <View style={styles.card}>
                    <Text style={styles.label}>
                        {mistake_type?.replace(/_/g, " ")}
                    </Text>
                    <Text style={styles.explanation}>{explanation || content.explanation}</Text>

                    {content.tip ? (
                        <View style={styles.tipBox}>
                            <Text style={styles.tipLabel}>💡 Tipp</Text>
                            <Text style={styles.tipText}>{content.tip}</Text>
                        </View>
                    ) : null}
                </View>

                <Pressable
                    style={styles.solveButton}
                    onPress={() =>
                        router.push({
                            pathname: "/learn/lesson",
                            params: {
                                id,
                                title: title || content.title,
                                explanation: explanation || content.explanation,
                                mistake_type,
                            },
                        })
                    }
                >
                    <Text style={styles.solveButtonText}>Übung starten</Text>
                </Pressable>
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
    content: { padding: 20, paddingBottom: 40 },

    coachRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "flex-end",
        marginBottom: 24,
    },
    coachImage: {
        width: 72,
        height: 72,
        borderRadius: 36,
        marginLeft: 10,
        borderWidth: 2,
        borderColor: "#7C9473",
    },
    bubble: {
        maxWidth: "72%",
        backgroundColor: "rgba(124,148,115,0.18)",
        borderColor: "#7C9473",
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        position: "relative",
    },
    bubbleText: {
        color: "#ECEDEE",
        fontSize: 14,
        lineHeight: 20,
    },
    // kleines Dreieck, das die Sprechblase in Richtung Coach zeigen lässt
    bubbleTail: {
        position: "absolute",
        right: -8,
        bottom: 14,
        width: 0,
        height: 0,
        borderTopWidth: 8,
        borderBottomWidth: 8,
        borderLeftWidth: 10,
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
        borderLeftColor: "#7C9473",
    },

    card: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
    },
    label: {
        fontSize: 13,
        fontWeight: "700",
        color: "rgba(255,255,255,0.55)",
        textTransform: "uppercase",
        letterSpacing: 0.6,
        marginBottom: 10,
    },
    explanation: { fontSize: 16, color: "#ECEDEE", lineHeight: 24 },

    tipBox: {
        marginTop: 16,
        backgroundColor: "rgba(124,148,115,0.12)",
        borderRadius: 12,
        padding: 12,
    },
    tipLabel: { fontSize: 13, fontWeight: "700", color: "#7C9473", marginBottom: 4 },
    tipText: { fontSize: 14, color: "#ECEDEE", lineHeight: 20 },

    solveButton: {
        marginTop: 24,
        backgroundColor: "#7C9473",
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
    },
    solveButtonText: { color: "#0F1115", fontWeight: "800", fontSize: 16 },
});