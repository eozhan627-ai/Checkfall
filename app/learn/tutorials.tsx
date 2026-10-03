import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LESSONS } from "../../lib/lessonContent";
import { getLessonProgress, LessonProgressMap } from "../../lib/lessonProgress";
import { tr } from "../../lib/i18n";

const PIECES = ["♞", "♝", "♜", "♛", "♟", "♚"];
const ACCENTS = ["#F5B942", "#4DA3FF", "#FF6B6B", "#5BD69A", "#B389FF", "#FF9F5A"];
const GOLD = "#F5B942";

export default function TutorialsScreen() {
    const insets = useSafeAreaInsets();
    const entries = useMemo(() => Object.entries(LESSONS), []);
    const [progress, setProgress] = useState<LessonProgressMap>({});

    // bei jeder Rückkehr auf den Screen neu laden, damit neue Sterne sofort sichtbar sind
    useFocusEffect(
        useCallback(() => {
            let alive = true;
            getLessonProgress().then((p) => {
                if (alive) setProgress(p);
            });
            return () => {
                alive = false;
            };
        }, [])
    );

    const totalMax = entries.reduce((sum, [, l]) => sum + l.exercises.length * 3, 0);
    // Never more stars than the tutorial has (older data could contain more).
    const starsOf = (key: string, max: number) => Math.min(progress[key]?.bestStars ?? 0, max);

    const totalStars = entries.reduce((sum, [key, l]) => sum + starsOf(key, l.exercises.length * 3), 0);
    const doneCount = entries.filter(([key, l]) => {
        const max = l.exercises.length * 3;
        return max > 0 && starsOf(key, max) >= max;
    }).length;

    return (
        <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
            <View style={styles.header}>
                <Pressable
                    onPress={() => router.back()}
                    style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                    hitSlop={8}
                >
                    <Text style={styles.backText}>‹</Text>
                </Pressable>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{tr("Tutorials")}</Text>
                    <Text style={styles.subtitle}>
                        {doneCount} {tr("of")} {entries.length} {tr("mastered · Fix mistakes step by step")}
                    </Text>
                </View>
                <View style={styles.starPill}>
                    <Text style={styles.starPillText}>
                        ★ {totalStars}/{totalMax}
                    </Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 32 }]}
                showsVerticalScrollIndicator={false}
            >
                {entries.map(([mistakeType, lesson], i) => {
                    const accent = ACCENTS[i % ACCENTS.length];
                    const max = lesson.exercises.length * 3;
                    const stars = starsOf(mistakeType, max);
                    const pct = max > 0 ? Math.min(1, stars / max) : 0;
                    const mastered = max > 0 && stars >= max;
                    const started = stars > 0;

                    return (
                        <Pressable
                            key={mistakeType}
                            style={({ pressed }) => [
                                styles.card,
                                { borderColor: mastered ? GOLD : accent + "55" },
                                pressed && styles.pressed,
                            ]}
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
                            <View style={styles.cardTop}>
                                <View style={[styles.pieceBadge, { backgroundColor: accent + "26" }]}>
                                    <Text style={[styles.piece, { color: accent }]}>{PIECES[i % PIECES.length]}</Text>
                                </View>
                                {mastered && <Text style={styles.crown}>👑</Text>}
                            </View>

                            <Text style={styles.cardTitle} numberOfLines={2}>
                                {lesson.title}
                            </Text>
                            <Text style={styles.cardSub} numberOfLines={3}>
                                {lesson.short}
                            </Text>

                            <View style={styles.barTrack}>
                                <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: accent }]} />
                            </View>
                            <View style={styles.cardBottom}>
                                <Text style={styles.starsText}>
                                    ★ {stars}/{max}
                                </Text>
                                <Text style={[styles.cta, { color: accent }]}>
                                    {mastered ? tr("Again ›") : started ? tr("Continue ›") : tr("Start ›")}
                                </Text>
                            </View>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0F1115" },
    header: {
        paddingHorizontal: 18,
        paddingBottom: 14,
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
    backText: { color: "#ECEDEE", fontSize: 26, fontWeight: "300", marginTop: -2 },
    title: { fontSize: 22, fontWeight: "800", color: "#fff" },
    subtitle: { fontSize: 12, color: "#8A8F98", marginTop: 2 },
    starPill: {
        backgroundColor: "rgba(245,185,66,0.15)",
        borderWidth: 1,
        borderColor: "rgba(245,185,66,0.5)",
        borderRadius: 14,
        paddingVertical: 6,
        paddingHorizontal: 10,
        marginLeft: 8,
    },
    starPillText: { color: GOLD, fontWeight: "800", fontSize: 13 },

    grid: {
        paddingHorizontal: 16,
        paddingTop: 6,
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
    },
    card: {
        width: "48%",
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 18,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        minHeight: 196,
    },
    pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    crown: { fontSize: 20 },
    pieceBadge: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 12,
    },
    piece: { fontSize: 26 },
    cardTitle: { fontSize: 16, fontWeight: "700", color: "#fff" },
    cardSub: { fontSize: 12, color: "#A9AEB7", marginTop: 6, lineHeight: 16, flexGrow: 1 },

    barTrack: {
        height: 6,
        borderRadius: 3,
        backgroundColor: "rgba(255,255,255,0.10)",
        marginTop: 12,
        overflow: "hidden",
    },
    barFill: { height: 6, borderRadius: 3 },
    cardBottom: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 8,
    },
    starsText: { fontSize: 12, color: GOLD, fontWeight: "700" },
    cta: { fontSize: 13, fontWeight: "700" },
});