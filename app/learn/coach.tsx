import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    ImageBackground,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { getSocket } from "../../lib/socket";
import {
    generateLesson,
    getLessons,
    getWeaknesses,
    Lesson,
    Weakness,
} from "../../lib/coachProfile";
export default function CoachScreen() {
    const backgroundImage = require("../../assets/images/loginbackground.png");
    const [weaknesses, setWeaknesses] = useState<Weakness[]>([]);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState<string | null>(null);
    const loadData = useCallback(async () => {
        try {
            const socket = getSocket();
            if (!socket.connected) {
                console.log("COACH: socket not connected yet");
                setLoading(false);
                return;
            }
            const [w, l] = await Promise.all([
                getWeaknesses(socket),
                getLessons(socket),
            ]);
            setWeaknesses(w.weaknesses);
            setLessons(l.lessons);
        } catch (error) {
            console.error("COACH LOAD ERROR:", error);
        } finally {
            setLoading(false);
        }
    }, []);
    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );
    const handleGenerate = async (mistakeType: string) => {
        try {
            setGenerating(mistakeType);
            const socket = getSocket();
            await generateLesson(socket, mistakeType);
            await loadData();
        } catch (error) {
            console.error("GENERATE LESSON ERROR:", error);
        } finally {
            setGenerating(null);
        }
    };
    return (
        <ImageBackground
            source={backgroundImage}
            style={styles.container}
            resizeMode="cover"
        >
            <View style={styles.overlay} />
            {/* HEADER */}
            <View style={styles.header}>
                <Pressable
                    onPress={() => router.back()}
                    style={({ pressed }) => [
                        styles.iconButton,
                        pressed && styles.iconButtonPressed,
                    ]}
                >
                    <Text style={styles.backText}>‹</Text>
                </Pressable>
                <View style={styles.headerText}>
                    <Text style={styles.title}>Your Coach</Text>
                    <Text style={styles.subtitle}>
                        Personal lessons based on your games
                    </Text>
                </View>
                {/* Unsichtbarer Platzhalter sorgt dafür,
                    dass der Titel optisch zentriert bleibt */}
                <View style={styles.headerSpacer} />
            </View>
            {loading ? (
                <ActivityIndicator
                    color="#7C9473"
                    style={{ marginTop: 40 }}
                />
            ) : (
                <ScrollView
                    contentContainerStyle={styles.lists}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.sectionLabel}>
                        Your weaknesses
                    </Text>
                    {weaknesses.length === 0 && (
                        <Text style={styles.emptyText}>
                            Not enough games analyzed yet.
                        </Text>
                    )}
                    {weaknesses.map((w) => (
                        <TouchableOpacity
                            key={w.mistake_type}
                            activeOpacity={0.85}
                            style={styles.card}
                            onPress={() => handleGenerate(w.mistake_type)}
                            disabled={generating === w.mistake_type}
                        >
                            <Text style={styles.cardTitle}>
                                {w.mistake_type.replace(/_/g, " ")}
                            </Text>
                            <Text style={styles.cardSub}>
                                {generating === w.mistake_type
                                    ? "Generating lesson…"
                                    : `${w.count} times — tap to generate a lesson`}
                            </Text>
                        </TouchableOpacity>
                    ))}
                    <Text
                        style={[
                            styles.sectionLabel,
                            { marginTop: 24 },
                        ]}
                    >
                        Your lessons
                    </Text>
                    {lessons.length === 0 && (
                        <Text style={styles.emptyText}>
                            No lessons yet.
                        </Text>
                    )}
                    {lessons.map((l) => (
                        <View key={l.id} style={styles.card}>
                            <Text style={styles.cardTitle}>
                                {l.title}
                            </Text>
                            <Text style={styles.cardSub}>
                                {l.explanation}
                            </Text>
                        </View>
                    ))}
                </ScrollView>
            )}
        </ImageBackground>
    );
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.55)",
    },
    header: {
        marginTop: 50,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: "rgba(23,26,32,0.92)",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.07)",
    },
    iconButtonPressed: {
        opacity: 0.7,
    },
    backText: {
        color: "#ECEDEE",
        fontSize: 26,
        lineHeight: 26,
        fontWeight: "300",
    },
    headerText: {
        flex: 1,
        marginLeft: 14,
    },
    headerSpacer: {
        width: 40,
        height: 40,
    },
    title: {
        fontSize: 30,
        fontWeight: "800",
        color: "#fff",
    },
    subtitle: {
        fontSize: 14,
        color: "#ccc",
        marginTop: 4,
    },
    lists: {
        paddingHorizontal: 16,
        paddingTop: 30,
        paddingBottom: 40,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: "rgba(255,255,255,0.6)",
        marginBottom: 10,
        textTransform: "uppercase",
        letterSpacing: 0.6,
    },
    emptyText: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 13,
        marginBottom: 14,
    },
    card: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 18,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#fff",
    },
    cardSub: {
        fontSize: 13,
        color: "#ccc",
        marginTop: 6,
    },
});