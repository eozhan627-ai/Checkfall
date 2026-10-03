import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import ImageBackground from "../components/ui/ImageBackground";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "../components/ui/theme";
import { log } from "../lib/log";
import { tr } from "../lib/i18n";

const STORAGE_KEY = "game_history";

type GameHistoryItem = {
    id: string;
    mode: "bot" | "local" | "online";
    date: string;
    result: "win" | "loss" | "draw" | "aborted";
    timestamp: number;
    /** Id of the game on the server; only these games can be reviewed. */
    remoteId?: string | null;
    /** Colour the user played (missing for older entries and local games). */
    color?: "w" | "b" | null;
};

type Filter = "all" | GameHistoryItem["mode"];

const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", get label() { return tr("All"); } },
    { key: "online", get label() { return tr("Online"); } },
    { key: "bot", get label() { return tr("Bot"); } },
    { key: "local", get label() { return tr("Local"); } },
];

const MODE_LABEL: Record<GameHistoryItem["mode"], string> = {
    get online() { return tr("Online game"); },
    get bot() { return tr("Game against the bot"); },
    get local() { return tr("Local game"); },
};

const RESULT: Record<GameHistoryItem["result"], { letter: string; label: string; color: string; soft: string }> = {
    win: { letter: "W", get label() { return tr("Won"); }, color: "#6FBF73", soft: "rgba(111,191,115,0.16)" },
    loss: { letter: "L", get label() { return tr("Lost"); }, color: "#D9534F", soft: "rgba(217,83,79,0.16)" },
    draw: { letter: "D", get label() { return tr("Draw"); }, color: "#B9C2CC", soft: "rgba(185,194,204,0.14)" },
    aborted: { letter: "–", get label() { return tr("Aborted"); }, color: "#8A9099", soft: "rgba(138,144,153,0.14)" },
};

function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return "";

    return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function GameHistory() {
    const insets = useSafeAreaInsets();
    const backgroundImage = require("../assets/images/loginbackground.jpg");

    const [history, setHistory] = useState<GameHistoryItem[]>([]);
    const [filter, setFilter] = useState<Filter>("all");

    useFocusEffect(
        useCallback(() => {
            let alive = true;

            (async () => {
                try {
                    const data = await AsyncStorage.getItem(STORAGE_KEY);
                    const list = data ? JSON.parse(data) : [];

                    if (alive && Array.isArray(list)) {
                        setHistory([...list].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
                    }
                } catch (e) {
                    log("Error loading game history", e);
                }
            })();

            return () => {
                alive = false;
            };
        }, [])
    );

    async function deleteGame(id: string) {
        try {
            const updated = history.filter((item) => item.id !== id);
            setHistory(updated);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
            log("Error deleting game", e);
        }
    }

    function confirmDelete(id: string) {
        // Alert.alert with buttons shows nothing on the web.
        if (Platform.OS === "web") {
            if (typeof window !== "undefined" && window.confirm(tr("Delete this game from your history?"))) {
                deleteGame(id);
            }
            return;
        }

        Alert.alert(tr("Delete game"), tr("Delete this game from your history?"), [
            { text: tr("Cancel"), style: "cancel" },
            { text: tr("Delete"), style: "destructive", onPress: () => deleteGame(id) },
        ]);
    }

    const counts = useMemo(() => {
        const finished = history.filter((item) => item.result !== "aborted");

        return {
            games: finished.length,
            win: finished.filter((item) => item.result === "win").length,
            loss: finished.filter((item) => item.result === "loss").length,
            draw: finished.filter((item) => item.result === "draw").length,
        };
    }, [history]);

    const visible = useMemo(
        () => (filter === "all" ? history : history.filter((item) => item.mode === filter)),
        [history, filter]
    );

    function renderItem({ item }: { item: GameHistoryItem }) {
        const result = RESULT[item.result] ?? RESULT.aborted;
        const canReview = !!item.remoteId;

        const details = [
            formatDate(item.timestamp) || item.date,
            item.color === "w" ? tr("White") : item.color === "b" ? tr("Black") : null,
        ].filter(Boolean);

        return (
            <Pressable
                disabled={!canReview}
                onPress={() =>
                    router.push({
                        pathname: "/game/review",
                        params: { gameId: item.remoteId!, color: item.color ?? "" },
                    })
                }
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
                <View style={[styles.resultBadge, { backgroundColor: result.soft }]}>
                    <Text style={[styles.resultLetter, { color: result.color }]}>{result.letter}</Text>
                </View>

                <View style={styles.cardBody}>
                    <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle}>{MODE_LABEL[item.mode] ?? tr("Game")}</Text>
                        <Text style={[styles.resultLabel, { color: result.color }]}>{result.label}</Text>
                    </View>

                    <Text style={styles.cardMeta}>{details.join(" · ")}</Text>

                    <View style={styles.cardFooter}>
                        {canReview ? (
                            <View style={styles.reviewPill}>
                                <Ionicons name="analytics-outline" size={13} color="#CFE0EF" />
                                <Text style={styles.reviewPillText}>{tr("Game review")}</Text>
                            </View>
                        ) : (
                            <Text style={styles.noReview}>
                                {item.mode === "local" ? tr("Local games have no review") : tr("No review for this game")}
                            </Text>
                        )}

                        <Pressable
                            onPress={() => confirmDelete(item.id)}
                            hitSlop={12}
                            accessibilityLabel={tr("Delete game")}
                            style={({ pressed }) => pressed && styles.pressed}
                        >
                            <Ionicons name="trash-outline" size={17} color={T.textFaint} />
                        </Pressable>
                    </View>
                </View>
            </Pressable>
        );
    }

    const header = (
        <View>
            <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10} accessibilityLabel={tr("Back")}>
                <Ionicons name="chevron-back" size={20} color={T.text} />
            </Pressable>

            <View style={styles.header}>
                <Text style={styles.logo}>{tr("HISTORY")}</Text>
                <Text style={styles.title}>{tr("Your Games")}</Text>
                <Text style={styles.subtitle}>{tr("Games played on this device")}</Text>
            </View>

            {history.length > 0 && (
                <>
                    <View style={styles.summary}>
                        <Summary value={counts.games} label={tr("Games")} />
                        <View style={styles.summaryDivider} />
                        <Summary value={counts.win} label={tr("Won")} color={RESULT.win.color} />
                        <View style={styles.summaryDivider} />
                        <Summary value={counts.loss} label={tr("Lost")} color={RESULT.loss.color} />
                        <View style={styles.summaryDivider} />
                        <Summary value={counts.draw} label={tr("Draw")} />
                    </View>

                    <View style={styles.filters}>
                        {FILTERS.map((entry) => {
                            const active = entry.key === filter;

                            return (
                                <Pressable
                                    key={entry.key}
                                    onPress={() => setFilter(entry.key)}
                                    style={[styles.filter, active && styles.filterActive]}
                                >
                                    <Text style={[styles.filterText, active && styles.filterTextActive]}>
                                        {entry.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </>
            )}
        </View>
    );

    return (
        <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
            <View style={styles.scrim} />

            <FlatList
                data={visible}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                ListHeaderComponent={header}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyTitle}>
                            {history.length === 0 ? tr("No games yet") : tr("No games in this category")}
                        </Text>
                        <Text style={styles.cardMeta}>
                            {history.length === 0
                                ? tr("Your finished games appear here.")
                                : tr("Choose another filter above.")}
                        </Text>
                    </View>
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingTop: insets.top + 14,
                    paddingBottom: insets.bottom + 32,
                }}
            />
        </ImageBackground>
    );
}

function Summary({ value, label, color }: { value: number; label: string; color?: string }) {
    return (
        <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, color ? { color } : null]}>{value}</Text>
            <Text style={styles.summaryLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#12151B" },
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10, 12, 16, 0.6)" },
    pressed: { opacity: 0.72 },

    back: {
        width: 40,
        height: 40,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1B2027",
        borderWidth: 1,
        borderColor: T.border,
        marginBottom: 18,
    },

    header: { marginBottom: 22 },
    logo: { color: "#5B8DB8", fontSize: 13, fontWeight: "700", letterSpacing: 1.4, marginBottom: 10 },
    title: { color: "#F5F7F9", fontSize: 28, fontWeight: "700", letterSpacing: -0.6, marginBottom: 6 },
    subtitle: { color: "rgba(237, 240, 243, 0.5)", fontSize: 13.5 },

    summary: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 20,
        paddingVertical: 16,
        backgroundColor: "#1B2027",
        borderWidth: 1,
        borderColor: "rgba(91, 141, 184, 0.22)",
        marginBottom: 16,
    },
    summaryItem: { flex: 1, alignItems: "center" },
    summaryValue: { color: "#F5F7F9", fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] },
    summaryLabel: { color: "rgba(237, 240, 243, 0.5)", fontSize: 12, marginTop: 3 },
    summaryDivider: { width: 1, height: 30, backgroundColor: "rgba(237, 240, 243, 0.08)" },

    filters: { flexDirection: "row", gap: 8, marginBottom: 16 },
    filter: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "rgba(237, 240, 243, 0.05)",
        borderWidth: 1,
        borderColor: T.border,
    },
    filterActive: { backgroundColor: T.accentSoft, borderColor: T.accent },
    filterText: { color: T.textDim, fontSize: 13, fontWeight: "600" },
    filterTextActive: { color: "#FFFFFF" },

    card: {
        flexDirection: "row",
        gap: 14,
        borderRadius: 18,
        padding: 14,
        backgroundColor: "#1B2027",
        borderWidth: 1,
        borderColor: "rgba(237, 240, 243, 0.08)",
        marginBottom: 10,
    },
    resultBadge: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    resultLetter: { fontSize: 18, fontWeight: "800" },
    cardBody: { flex: 1 },
    cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    cardTitle: { color: "#F2F4F6", fontSize: 15.5, fontWeight: "600", flexShrink: 1 },
    resultLabel: { fontSize: 13, fontWeight: "700" },
    cardMeta: { color: "rgba(237, 240, 243, 0.5)", fontSize: 12.5, marginTop: 3 },
    cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
    reviewPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: "rgba(91, 141, 184, 0.16)",
        borderWidth: 1,
        borderColor: "rgba(91, 141, 184, 0.4)",
    },
    reviewPillText: { color: "#CFE0EF", fontSize: 12, fontWeight: "700" },
    noReview: { color: T.textFaint, fontSize: 12 },

    empty: {
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingVertical: 20,
        backgroundColor: "rgba(27, 32, 39, 0.7)",
        borderWidth: 1,
        borderColor: "rgba(237, 240, 243, 0.08)",
    },
    emptyTitle: { color: "#F2F4F6", fontSize: 15.5, fontWeight: "600" },
});
