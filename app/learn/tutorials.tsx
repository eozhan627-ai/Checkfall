import { router } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LESSONS } from "../../lib/lessonContent";

export default function TutorialsScreen() {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.iconButton}>
                    <Text style={styles.backText}>‹</Text>
                </Pressable>
                <Text style={styles.title}>Tutorials</Text>
            </View>

            <ScrollView contentContainerStyle={styles.list}>
                {Object.entries(LESSONS).map(([mistakeType, lesson]) => (
                    <Pressable
                        key={mistakeType}
                        style={styles.card}
                        onPress={() =>
                            router.push({
                                pathname: "/learn/[id]",
                                params: {
                                    id: mistakeType,
                                    title: lesson.title,
                                    mistake_type: mistakeType,
                                },
                            })
                        }
                    >
                        <Text style={styles.cardTitle}>{lesson.title}</Text>
                        <Text style={styles.cardSub} numberOfLines={2}>
                            {lesson.explanation}
                        </Text>
                    </Pressable>
                ))}
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
    title: { fontSize: 22, fontWeight: "800", color: "#fff" },
    list: { padding: 16, paddingBottom: 40 },
    card: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 18,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
    },
    cardTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
    cardSub: { fontSize: 13, color: "#ccc", marginTop: 6 },
});
