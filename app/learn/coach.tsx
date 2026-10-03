import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import ImageBackground from "../../components/ui/ImageBackground";
import { accuracyColor } from "../../components/review/AccuracyRing";
import ClassificationBadge from "../../components/review/ClassificationBadge";
import { T } from "../../components/ui/theme";
import { getCurrentAccount } from "../../lib/account";
import { Classification, CLASSIFICATION_META, normalizeAnalysis } from "../../lib/analysis";
import {
    generateLesson,
    getLessons,
    getWeaknesses,
    Lesson,
    Weakness,
} from "../../lib/coachProfile";
import { getLessonProgress, lessonProgressKey, LessonProgressMap } from "../../lib/lessonProgress";
import { log } from "../../lib/log";
import { exercisesFromLesson, rememberLesson } from "../../lib/personalLessons";
import { ensureSocketConnected } from "../../lib/socket";
import { supabase } from "../../lib/supabase";
import { tr } from "../../lib/i18n";

const backgroundImage = require("../../assets/images/loginbackground.jpg");
const coachImage = require("../../assets/images/coach.png");

// Category the server stores -> label used in the game review.
const WEAKNESS_CLASS: Record<string, Classification> = {
    blunder: "blunder",
    mistake: "mistake",
    inaccuracy: "inaccuracy",
    missed_win: "miss",
    slip: "inaccuracy",
};

const WEAKNESS_TEXT: Record<string, { title: string; advice: string }> = {
    blunder: { get title() { return tr("Blunders"); }, get advice() { return tr("Pieces left hanging and tactics you walked into."); } },
    mistake: { get title() { return tr("Mistakes"); }, get advice() { return tr("Moves that gave away a clear part of your position."); } },
    inaccuracy: { get title() { return tr("Inaccuracies"); }, get advice() { return tr("A good move was played, but a better one was there."); } },
    missed_win: { get title() { return tr("Missed chances"); }, get advice() { return tr("Your opponent went wrong and got away with it."); } },
    slip: { get title() { return tr("Slips"); }, get advice() { return tr("Small lapses after a run of good moves."); } },
};

type Status = "loading" | "guest" | "not_vip" | "ready" | "error";

type GamePoint = { id: string; accuracy: number };

export default function CoachScreen() {
    const [status, setStatus] = useState<Status>("loading");
    const [weaknesses, setWeaknesses] = useState<Weakness[]>([]);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [games, setGames] = useState<GamePoint[]>([]);
    const [progress, setProgress] = useState<LessonProgressMap>({});
    const [generating, setGenerating] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            const acc = await getCurrentAccount();

            if (!acc || acc.guest || !acc.authId) {
                setStatus("guest");
                return;
            }

            getLessonProgress().then(setProgress).catch(() => undefined);

            // Accuracy of the last analysed games (own moves where known).
            supabase
                .from("games")
                .select("id, created_at, analysis")
                .eq("user_id", acc.authId)
                .eq("analyzed", true)
                .order("created_at", { ascending: false })
                .limit(10)
                .then(({ data }) => {
                    const points = (data || [])
                        .map((g: any) => {
                            const review = normalizeAnalysis(g.analysis);
                            if (!review) return null;

                            const own = review.playerColor ? review.accuracy[review.playerColor] : null;
                            const both =
                                review.accuracy.w !== null && review.accuracy.b !== null
                                    ? (review.accuracy.w + review.accuracy.b) / 2
                                    : null;
                            const accuracy = own ?? both;

                            return accuracy === null ? null : { id: g.id as string, accuracy };
                        })
                        .filter((p): p is GamePoint => p !== null)
                        .reverse();

                    setGames(points);
                });

            const socket = await ensureSocketConnected();

            const [w, l] = await Promise.all([getWeaknesses(socket), getLessons(socket)]);

            l.lessons.forEach(rememberLesson);

            setWeaknesses(w.weaknesses);
            setLessons(l.lessons);
            setStatus(!acc.vipTier || acc.vipTier === "none" ? "not_vip" : "ready");
        } catch (error: any) {
            log("COACH LOAD ERROR:", error);
            setStatus("error");
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    function openLesson(lesson: Lesson) {
        rememberLesson(lesson);

        router.push({
            pathname: "/learn/[id]",
            params: {
                id: lesson.id,
                title: lesson.title,
                explanation: lesson.explanation,
                mistake_type: lesson.mistake_type,
            },
        });
    }

    const handleGenerate = async (mistakeType: string) => {
        if (generating) return;

        try {
            setGenerating(mistakeType);
            setMessage(null);

            const socket = await ensureSocketConnected();
            const { lesson } = await generateLesson(socket, mistakeType);

            setLessons((prev) => [lesson, ...prev.filter((l) => l.id !== lesson.id)]);
            openLesson(lesson);
        } catch (error) {
            log("GENERATE LESSON ERROR:", error);
            setMessage(tr("The lesson could not be created. Please try again."));
        } finally {
            setGenerating(null);
        }
    };

    const maxCount = Math.max(1, ...weaknesses.map((w) => w.count));
    const top = weaknesses[0];
    const average = games.length ? games.reduce((sum, g) => sum + g.accuracy, 0) / games.length : null;

    const coachLine =
        status === "guest"
            ? tr("Sign in and I will learn from your games which mistakes cost you the most.")
            : weaknesses.length === 0
                ? tr("Analyze one of your games and I will show you what to work on first.")
                : tr("Your biggest leak right now: {0} ({1}×). Let's work on that first.", WEAKNESS_TEXT[top.mistake_type]?.title ?? top.mistake_type, top.count);

    return (
        <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
            <View style={styles.overlay} />

            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}>
                    <Text style={styles.backText}>‹</Text>
                </Pressable>
                <Text style={styles.headerTitle}>{tr("Your Coach")}</Text>
                <View style={{ width: 42 }} />
            </View>

            {status === "loading" ? (
                <ActivityIndicator color={T.text} style={{ marginTop: 60 }} />
            ) : (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Coach */}
                    <View style={styles.hero}>
                        <Image source={coachImage} style={styles.coach} resizeMode="contain" />
                        <View style={styles.bubble}>
                            <Text style={styles.bubbleName}>{tr("UHU · YOUR COACH")}</Text>
                            <Text style={styles.bubbleText}>{coachLine}</Text>
                        </View>
                    </View>

                    {status === "error" && (
                        <Pressable onPress={loadData} style={styles.notice}>
                            <Text style={styles.noticeText}>{tr("The coach could not be reached. Tap to try again.")}</Text>
                        </Pressable>
                    )}

                    {status === "not_vip" && (
                        <Pressable onPress={() => router.push("/vip")} style={[styles.notice, styles.noticeGold]}>
                            <Text style={[styles.noticeText, { color: T.gold }]}>
                                {tr("Personal lessons are built from analyzed games - game analysis is part of VIP. See plans ›")}
                            </Text>
                        </Pressable>
                    )}

                    {/* Form */}
                    {games.length > 0 && (
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>{tr("Your form")}</Text>
                                {average !== null && (
                                    <Text style={[styles.cardValue, { color: accuracyColor(average) }]}>
                                        {average.toFixed(1)}
                                        <Text style={styles.cardValueUnit}> {tr("avg. accuracy")}</Text>
                                    </Text>
                                )}
                            </View>

                            <View style={styles.bars}>
                                {games.map((game) => (
                                    <Pressable
                                        key={game.id}
                                        style={styles.barWrap}
                                        onPress={() => router.push({ pathname: "/game/review", params: { gameId: game.id } })}
                                    >
                                        <Text style={styles.barValue}>{Math.round(game.accuracy)}</Text>
                                        <View
                                            style={[
                                                styles.bar,
                                                {
                                                    height: `${Math.max(8, (game.accuracy - 30) * (100 / 70))}%`,
                                                    backgroundColor: accuracyColor(game.accuracy),
                                                },
                                            ]}
                                        />
                                    </Pressable>
                                ))}
                            </View>
                            <Text style={styles.cardHint}>{tr("Your last")} {games.length} {tr("analyzed games, oldest first. Tap a bar to open the review.")}</Text>
                        </View>
                    )}

                    {/* Weaknesses */}
                    <Text style={styles.sectionTitle}>{tr("What costs you points")}</Text>

                    {weaknesses.length === 0 ? (
                        <View style={styles.card}>
                            <Text style={styles.emptyTitle}>{tr("Nothing to show yet")}</Text>
                            <Text style={styles.emptyText}>
                                {tr("After a game, open it in your game history and run the analysis. Every mistake found there turns into training material here.")}
                            </Text>
                            {status !== "guest" && (
                                <Pressable onPress={() => router.push("/Spielverlauf")} style={styles.secondaryButton}>
                                    <Text style={styles.secondaryButtonText}>{tr("Open game history")}</Text>
                                </Pressable>
                            )}
                        </View>
                    ) : (
                        weaknesses.map((weakness, index) => {
                            const key = WEAKNESS_CLASS[weakness.mistake_type] ?? "mistake";
                            const meta = CLASSIFICATION_META[key];
                            const text = WEAKNESS_TEXT[weakness.mistake_type];
                            const busy = generating === weakness.mistake_type;

                            return (
                                <View key={weakness.mistake_type} style={[styles.card, index === 0 && { borderColor: `${meta.color}73` }]}>
                                    <View style={styles.weaknessTop}>
                                        <ClassificationBadge classification={key} size={34} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.weaknessTitle}>{text?.title ?? weakness.mistake_type.replace(/_/g, " ")}</Text>
                                            <Text style={styles.weaknessAdvice}>{text?.advice ?? ""}</Text>
                                        </View>
                                        <Text style={[styles.weaknessCount, { color: meta.color }]}>{weakness.count}×</Text>
                                    </View>

                                    <View style={styles.track}>
                                        <View style={[styles.fill, { width: `${(weakness.count / maxCount) * 100}%`, backgroundColor: meta.color }]} />
                                    </View>

                                    <Pressable
                                        onPress={() => handleGenerate(weakness.mistake_type)}
                                        disabled={!!generating}
                                        style={({ pressed }) => [styles.trainButton, (pressed || busy) && { opacity: 0.8 }]}
                                    >
                                        {busy ? (
                                            <ActivityIndicator color="#FFFFFF" size="small" />
                                        ) : (
                                            <Text style={styles.trainButtonText}>{tr("Train with positions from my games")}</Text>
                                        )}
                                    </Pressable>
                                </View>
                            );
                        })
                    )}

                    {message && <Text style={styles.message}>{message}</Text>}

                    {/* Lessons */}
                    {lessons.length > 0 && (
                        <>
                            <Text style={styles.sectionTitle}>{tr("Your lessons")}</Text>

                            {lessons.map((lesson) => {
                                const key = WEAKNESS_CLASS[lesson.mistake_type] ?? "mistake";
                                const own = exercisesFromLesson(lesson).length;
                                const best =
                                    (own > 0 ? progress[lessonProgressKey(lesson.mistake_type, true)] : undefined) ??
                                    progress[lessonProgressKey(lesson.mistake_type)];

                                return (
                                    <Pressable
                                        key={lesson.id}
                                        onPress={() => openLesson(lesson)}
                                        style={({ pressed }) => [styles.lessonRow, pressed && { opacity: 0.85 }]}
                                    >
                                        <ClassificationBadge classification={key} size={30} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.lessonTitle} numberOfLines={1}>
                                                {tr(lesson.title)}
                                            </Text>
                                            <Text style={styles.lessonMeta}>
                                                {own > 0 ? (own === 1 ? tr("1 position from your games") : tr("{0} positions from your games", own)) : tr("Standard exercises")}
                                                {best ? tr(" · best {0}/{1} ★", best.bestStars, best.maxStars) : ""}
                                            </Text>
                                        </View>
                                        <Text style={styles.chevron}>›</Text>
                                    </Pressable>
                                );
                            })}
                        </>
                    )}
                </ScrollView>
            )}
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,10,13,0.72)" },

    header: { marginTop: 46, height: 62, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    iconButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: T.cardSolid, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
    backText: { color: T.text, fontSize: 30, lineHeight: 32, fontWeight: "300" },
    headerTitle: { color: T.text, fontSize: 16, fontWeight: "700" },

    content: { paddingHorizontal: 16, paddingBottom: 48 },

    hero: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 6, marginBottom: 6 },
    coach: { width: 92, height: 92 },
    bubble: { flex: 1, backgroundColor: T.card, borderRadius: 18, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: T.accentBorder, padding: 14, marginBottom: 10 },
    bubbleName: { color: T.accent, fontSize: 10.5, fontWeight: "800", letterSpacing: 1, marginBottom: 5 },
    bubbleText: { color: T.text, fontSize: 14.5, lineHeight: 20.5, fontWeight: "500" },

    notice: { backgroundColor: T.redSoft, borderRadius: 14, borderWidth: 1, borderColor: "rgba(217,83,79,0.4)", padding: 12, marginTop: 8 },
    noticeGold: { backgroundColor: T.goldSoft, borderColor: T.goldBorder },
    noticeText: { color: "#F2B5B2", fontSize: 13.5, lineHeight: 19 },

    sectionTitle: { color: T.text, fontSize: 17, fontWeight: "800", marginTop: 22, marginBottom: 2 },

    card: { backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 16, marginTop: 10 },
    cardHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    cardTitle: { color: T.text, fontSize: 15.5, fontWeight: "800" },
    cardValue: { fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
    cardValueUnit: { color: T.textFaint, fontSize: 11.5, fontWeight: "600" },
    cardHint: { color: T.textFaint, fontSize: 11.5, marginTop: 10, lineHeight: 16 },

    bars: { flexDirection: "row", alignItems: "flex-end", height: 96, gap: 7, marginTop: 12 },
    barWrap: { flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center" },
    barValue: { color: T.textDim, fontSize: 10.5, fontWeight: "700", marginBottom: 3, fontVariant: ["tabular-nums"] },
    bar: { width: "100%", borderRadius: 5, minHeight: 6 },

    emptyTitle: { color: T.text, fontSize: 15.5, fontWeight: "800" },
    emptyText: { color: T.textDim, fontSize: 13.5, lineHeight: 19.5, marginTop: 6 },
    secondaryButton: { marginTop: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: T.accentSoft, borderWidth: 1, borderColor: T.accentBorder, alignItems: "center" },
    secondaryButtonText: { color: "#BFD9EF", fontSize: 13.5, fontWeight: "800" },

    weaknessTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    weaknessTitle: { color: T.text, fontSize: 16, fontWeight: "800" },
    weaknessAdvice: { color: T.textDim, fontSize: 12.5, lineHeight: 17.5, marginTop: 2 },
    weaknessCount: { fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
    track: { height: 6, borderRadius: 3, backgroundColor: "rgba(237,240,243,0.08)", overflow: "hidden", marginTop: 12 },
    fill: { height: "100%", borderRadius: 3 },
    trainButton: { marginTop: 12, height: 44, borderRadius: 12, backgroundColor: T.accent, alignItems: "center", justifyContent: "center" },
    trainButtonText: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "800" },

    message: { color: "#F2B5B2", fontSize: 13, marginTop: 10 },

    lessonRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border, padding: 13, marginTop: 8 },
    lessonTitle: { color: T.text, fontSize: 15, fontWeight: "700" },
    lessonMeta: { color: T.textFaint, fontSize: 12, marginTop: 2 },
    chevron: { color: T.textFaint, fontSize: 24, fontWeight: "300" },
});
