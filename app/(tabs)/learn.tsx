import { Ionicons } from "@expo/vector-icons";
import { Href, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ImageBackground from "../../components/ui/ImageBackground";
import { LESSONS } from "../../lib/lessonContent";
import { OPENINGS } from "../../lib/openings";
import { getLessonProgress, LessonProgressMap } from "../../lib/lessonProgress";
import { activeStreak, getRewards, levelFromXp, Rewards, solvedToday } from "../../lib/puzzleRewards";
import { getSolvedPuzzleCount } from "../../lib/puzzleStats";
import { tr } from "../../lib/i18n";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type Tile = {
    title: string;
    subtitle: string;
    href: Href;
    icon: IconName;
};

// Same layout as the Home and Social tabs: one highlighted card, then a grid.
export default function LearnScreen() {
    const router = useRouter();
    const backgroundImage = require("../../assets/images/loginbackground.jpg");

    const [rewards, setRewards] = useState<Rewards | null>(null);
    const [lessons, setLessons] = useState<LessonProgressMap>({});
    const [puzzlesSolved, setPuzzlesSolved] = useState(0);

    useFocusEffect(
        useCallback(() => {
            let alive = true;

            getRewards().then((r) => alive && setRewards(r));
            getLessonProgress().then((p) => alive && setLessons(p));
            getSolvedPuzzleCount().then((n) => alive && setPuzzlesSolved(n));

            return () => {
                alive = false;
            };
        }, [])
    );

    const tutorials = Object.entries(LESSONS).filter(([, lesson]) => lesson.exercises.length > 0);
    const tutorialMax = tutorials.reduce((sum, [, lesson]) => sum + lesson.exercises.length * 3, 0);
    const tutorialStars = tutorials.reduce(
        (sum, [key, lesson]) => sum + Math.min(lessons[key]?.bestStars ?? 0, lesson.exercises.length * 3),
        0
    );

    const { level } = levelFromXp(rewards?.xp ?? 0);
    const streak = rewards ? activeStreak(rewards) : 0;
    const dailyDone = rewards ? solvedToday(rewards) : false;

    const statusText =
        streak > 0 ? tr("Level {0} · {1}-day streak", level, streak) : tr("Level {0} · {1} XP", level, rewards?.xp ?? 0);

    const tiles: Tile[] = [
        {
            title: tr("Tutorials"),
            subtitle: tr("{0} of {1} stars", tutorialStars, tutorialMax),
            href: "/learn/tutorials",
            icon: "school-outline",
        },
        {
            title: tr("Puzzles"),
            subtitle: tr("{0} solved", puzzlesSolved),
            href: "/learn/puzzles",
            icon: "extension-puzzle-outline",
        },
        {
            title: tr("Daily Puzzle"),
            subtitle: dailyDone ? tr("Solved today") : tr("Not solved yet"),
            href: "/puzzle/dailyPuzzle",
            icon: "calendar-outline",
        },
        {
            title: tr("Game Reviews"),
            subtitle: tr("Learn from your games"),
            href: "/Spielverlauf",
            icon: "analytics-outline",
        },
    ];

    return (
        <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
            <View style={styles.scrim} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* HEADER */}
                <View style={styles.header}>
                    <Text style={styles.logo}>{tr("LEARN")}</Text>
                    <Text style={styles.title}>{tr("Train & Improve")}</Text>
                    <Text style={styles.subtitleText}>{tr("Lessons, puzzles and your own coach")}</Text>
                </View>

                {/* HIGHLIGHT: COACH */}
                <Pressable
                    onPress={() => router.push("/learn/coach")}
                    style={({ pressed }) => [styles.mainCard, pressed && styles.pressed]}
                >
                    <View style={styles.mainContent}>
                        <View style={styles.mainTop}>
                            <View style={styles.statusDot} />
                            <Text style={styles.statusText}>{statusText}</Text>
                        </View>

                        <Text style={styles.mainTitle}>{tr("Your Coach")}</Text>
                        <Text style={styles.mainSubtitle}>{tr("Lessons built from your own games")}</Text>
                    </View>

                    <View style={styles.mainArrow}>
                        <Ionicons name="chevron-forward" size={16} color="#5B8DB8" />
                    </View>
                </Pressable>

                {/* GRID */}
                <Text style={styles.sectionTitle}>{tr("Training")}</Text>

                <View style={styles.grid}>
                    {tiles.map((tile) => (
                        <Pressable
                            key={tile.title}
                            accessibilityRole="button"
                            accessibilityLabel={tile.title}
                            onPress={() => router.push(tile.href)}
                            style={({ pressed }) => [styles.smallCard, pressed && styles.pressed]}
                        >
                            <View style={styles.iconBadge}>
                                <Ionicons name={tile.icon} size={17} color="#EDF0F3" />
                            </View>
                            <Text style={styles.smallCardTitle}>{tile.title}</Text>
                            <Text style={styles.smallCardSubtitle}>{tile.subtitle}</Text>
                        </Pressable>
                    ))}
                </View>

                {/* OPENINGS (VIP) */}
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={tr("Opening Trainer")}
                    onPress={() => router.push("/learn/openings" as Href)}
                    style={({ pressed }) => [styles.wideCard, pressed && styles.pressed]}
                >
                    <View style={[styles.iconBadge, { marginBottom: 0 }]}>
                        <Ionicons name="book-outline" size={17} color="#EDF0F3" />
                    </View>

                    <View style={{ flex: 1 }}>
                        <View style={styles.wideTitleRow}>
                            <Text style={[styles.smallCardTitle, { marginBottom: 0 }]}>{tr("Opening Trainer")}</Text>
                            <View style={styles.vipTag}>
                                <Text style={styles.vipTagText}>VIP</Text>
                            </View>
                        </View>
                        <Text style={styles.smallCardSubtitle}>{tr("{0} openings, move by move", OPENINGS.length)}</Text>
                    </View>

                    <Ionicons name="chevron-forward" size={16} color="rgba(237,240,243,0.4)" />
                </Pressable>
            </ScrollView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#12151B" },
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10, 12, 16, 0.55)" },
    scrollView: { flex: 1 },
    content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 40 },

    header: { marginBottom: 26 },
    logo: { color: "#5B8DB8", fontSize: 13, fontWeight: "700", letterSpacing: 1.4, marginBottom: 10 },
    title: { color: "#F5F7F9", fontSize: 28, fontWeight: "700", letterSpacing: -0.6, marginBottom: 6 },
    subtitleText: { color: "rgba(237, 240, 243, 0.5)", fontSize: 13.5 },

    mainCard: {
        minHeight: 120,
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#1B2027",
        borderWidth: 1,
        borderColor: "rgba(91, 141, 184, 0.22)",
        marginBottom: 28,
    },
    mainContent: { flex: 1 },
    mainTop: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
    statusDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#D4AF37" },
    statusText: { color: "rgba(237, 240, 243, 0.55)", fontSize: 12.5 },
    mainTitle: { color: "#F5F7F9", fontSize: 20, fontWeight: "700", letterSpacing: -0.4, marginBottom: 5 },
    mainSubtitle: { color: "rgba(237, 240, 243, 0.5)", fontSize: 13, lineHeight: 18 },
    mainArrow: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 8,
        backgroundColor: "rgba(91, 141, 184, 0.14)",
    },

    sectionTitle: {
        color: "rgba(237, 240, 243, 0.8)",
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 14,
        paddingLeft: 2,
    },

    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
    smallCard: {
        width: "48.2%",
        minHeight: 118,
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingVertical: 18,
        backgroundColor: "#1B2027",
        borderWidth: 1,
        borderColor: "rgba(237, 240, 243, 0.08)",
        marginBottom: 12,
    },
    iconBadge: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
        backgroundColor: "rgba(237, 240, 243, 0.06)",
    },
    smallCardTitle: { color: "#F2F4F6", fontSize: 16.5, fontWeight: "600", letterSpacing: -0.2, marginBottom: 5 },
    smallCardSubtitle: { color: "rgba(237, 240, 243, 0.5)", fontSize: 12.5, lineHeight: 17 },

    wideCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingVertical: 16,
        backgroundColor: "#1B2027",
        borderWidth: 1,
        borderColor: "rgba(212, 175, 55, 0.25)",
    },
    wideTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
    vipTag: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: "rgba(212, 175, 55, 0.14)",
        borderWidth: 1,
        borderColor: "rgba(212, 175, 55, 0.4)",
    },
    vipTagText: { color: "#D4AF37", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },

    pressed: { opacity: 0.72 },
});
