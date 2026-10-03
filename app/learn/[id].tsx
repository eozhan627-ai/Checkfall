import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getLessonContent } from "../../lib/lessonContent";
import { getLessonProgress, lessonProgressKey, LessonProgress } from "../../lib/lessonProgress";
import LimitGate from "../../components/LimitGate";
import { Allowance, consume, getAllowance, grantAdBonus } from "../../lib/dailyLimits";
import { getPersonalExercises } from "../../lib/personalLessons";
import { tr } from "../../lib/i18n";

const ACCENT = "#7C9473";
const GOLD = "#F5B942";

export default function LessonIntroScreen() {
    const { id, title, mistake_type } = useLocalSearchParams<{
        id: string;
        title: string;
        mistake_type: string;
    }>();

    const coachImage = require("../../assets/images/coach.png");
    const content = getLessonContent(mistake_type);
    // Positions from the user's own games come first, then the standard ones.
    const ownExercises = getPersonalExercises(id);
    const exerciseCount = ownExercises.length + content.exercises.length;
    const maxStars = exerciseCount * 3;
    // A lesson with positions from the user's games has its own best score.
    const progressKey = lessonProgressKey(mistake_type, ownExercises.length > 0);

    const [best, setBest] = useState<LessonProgress | null>(null);

    // Daily limit (1 lesson a day without VIP; an ad adds one more).
    const [allowance, setAllowance] = useState<Allowance | null>(null);
    const [gateOpen, setGateOpen] = useState(false);

    const openLesson = () =>
        router.push({
            pathname: "/learn/lesson",
            params: { id, title: title || content.title, mistake_type },
        });

    async function startLesson() {
        const current = await getAllowance("lesson");
        setAllowance(current);

        if (!current.unlimited && current.left <= 0) {
            setGateOpen(true);
            return;
        }

        setAllowance(await consume("lesson"));
        openLesson();
    }

    // An ad was watched: one more lesson for today.
    async function handleRewarded() {
        await grantAdBonus("lesson");
        setAllowance(await consume("lesson"));
        openLesson();
    }

    useFocusEffect(
        useCallback(() => {
            let alive = true;
            getLessonProgress().then((p) => {
                if (alive) setBest(p[progressKey] ?? null);
            });
            getAllowance("lesson").then((a) => alive && setAllowance(a));
            return () => {
                alive = false;
            };
        }, [progressKey])
    );

    const hasExercises = exerciseCount > 0;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.iconButton}>
                    <Text style={styles.backText}>‹</Text>
                </Pressable>
                <Text style={styles.title}>{title || content.title}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.coachRow}>
                    <View style={styles.bubble}>
                        <Text style={styles.bubbleText}>{content.coachMessage}</Text>
                        <View style={styles.bubbleTail} />
                    </View>
                    <Image source={coachImage} style={styles.coachImage} resizeMode="contain" />
                </View>

                <View style={styles.card}>
                    <Text style={styles.label}>{mistake_type?.replace(/_/g, " ")}</Text>
                    <Text style={styles.explanation}>{content.explanation}</Text>

                    {content.steps.length > 0 && (
                        <View style={styles.stepsBox}>
                            <Text style={styles.stepsLabel}>{tr("✅ Your checklist")}</Text>
                            {content.steps.map((s, i) => (
                                <View key={i} style={styles.stepRow}>
                                    <View style={styles.stepNum}>
                                        <Text style={styles.stepNumText}>{i + 1}</Text>
                                    </View>
                                    <Text style={styles.stepText}>{tr(s)}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {content.tip ? (
                        <View style={styles.tipBox}>
                            <Text style={styles.tipLabel}>{tr("💡 Tip")}</Text>
                            <Text style={styles.tipText}>{content.tip}</Text>
                        </View>
                    ) : null}
                </View>

                {hasExercises && (
                    <View style={styles.bestRow}>
                        <Text style={styles.bestText}>
                            {exerciseCount} {tr("exercises")}
                            {ownExercises.length > 0
                                ? tr(" · {0} from your games", ownExercises.length)
                                : tr(" · up to {0} ★", maxStars)}
                        </Text>
                        <Text style={[styles.bestText, { color: GOLD }]}>
                            {best ? tr("Best {0}/{1} ★", best.bestStars, best.maxStars) : tr("Not played yet")}
                        </Text>
                    </View>
                )}

                <Pressable
                    style={[styles.solveButton, !hasExercises && { opacity: 0.4 }]}
                    disabled={!hasExercises}
                    onPress={startLesson}
                >
                    <Text style={styles.solveButtonText}>
                        {!hasExercises ? tr("No exercise available yet") : best ? tr("Play again") : tr("Let's go! 🚀")}
                    </Text>
                </Pressable>

                {hasExercises && allowance && !allowance.unlimited && (
                    <Text style={styles.limitText}>
                        {allowance.left > 0
                            ? allowance.left === 1
                                ? tr("1 free lesson left today")
                                : tr("{0} free lessons left today", allowance.left)
                            : tr("Today's free lessons are used up")}
                    </Text>
                )}
            </ScrollView>

            <LimitGate
                visible={gateOpen}
                kind="lesson"
                onClose={() => setGateOpen(false)}
                onRewarded={handleRewarded}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    limitText: { color: "rgba(255,255,255,0.5)", fontSize: 12.5, textAlign: "center", marginTop: 12 },
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
        marginBottom: 24,
    },
    coachImage: {
        width: 72,
        height: 72,
        borderRadius: 36,
        marginLeft: 10,
        borderWidth: 2,
        borderColor: ACCENT,
    },
    bubble: {
        flex: 1,
        backgroundColor: "rgba(124,148,115,0.18)",
        borderColor: ACCENT,
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginRight: 8,
    },
    bubbleText: { color: "#ECEDEE", fontSize: 14, lineHeight: 20 },
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
        borderLeftColor: ACCENT,
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

    stepsBox: {
        marginTop: 16,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: 12,
        padding: 12,
    },
    stepsLabel: { fontSize: 13, fontWeight: "700", color: "#ECEDEE", marginBottom: 8 },
    stepRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
    stepNum: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: ACCENT,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 10,
    },
    stepNumText: { color: "#0F1115", fontWeight: "800", fontSize: 12 },
    stepText: { flex: 1, color: "#ECEDEE", fontSize: 14, lineHeight: 20 },

    tipBox: {
        marginTop: 12,
        backgroundColor: "rgba(124,148,115,0.12)",
        borderRadius: 12,
        padding: 12,
    },
    tipLabel: { fontSize: 13, fontWeight: "700", color: ACCENT, marginBottom: 4 },
    tipText: { fontSize: 14, color: "#ECEDEE", lineHeight: 20 },

    bestRow: {
        marginTop: 16,
        flexDirection: "row",
        justifyContent: "space-between",
    },
    bestText: { fontSize: 13, color: "#A9AEB7", fontWeight: "600" },

    solveButton: {
        marginTop: 18,
        backgroundColor: ACCENT,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
    },
    solveButtonText: { color: "#0F1115", fontWeight: "800", fontSize: 16 },
});