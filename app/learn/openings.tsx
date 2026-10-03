import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ImageBackground from "../../components/ui/ImageBackground";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LimitGate from "../../components/LimitGate";
import { T } from "../../components/ui/theme";
import { getCurrentAccount } from "../../lib/account";
import { tr } from "../../lib/i18n";
import { getOpeningProgress, OpeningProgress } from "../../lib/openingProgress";
import { formatLine, Opening, OPENINGS } from "../../lib/openings";

const GOLD = "#D4AF37";
const backgroundImage = require("../../assets/images/loginbackground.jpg");

// Opening trainer: list of openings. Part of every VIP plan - without VIP
// the list is visible, but the openings are locked.
export default function OpeningsScreen() {
    const insets = useSafeAreaInsets();

    const [isVip, setIsVip] = useState<boolean | null>(null);
    const [progress, setProgress] = useState<OpeningProgress>({});
    const [gateOpen, setGateOpen] = useState(false);

    useFocusEffect(
        useCallback(() => {
            let alive = true;

            getCurrentAccount().then((account) => {
                if (alive) setIsVip(!!account?.vipTier && account.vipTier !== "none");
            });
            getOpeningProgress().then((p) => alive && setProgress(p));

            return () => {
                alive = false;
            };
        }, [])
    );

    function open(opening: Opening) {
        if (!isVip) {
            setGateOpen(true);
            return;
        }

        router.push({ pathname: "/learn/opening", params: { id: opening.id } } as any);
    }

    const learned = OPENINGS.filter((opening) => (progress[opening.id] ?? 0) > 0).length;

    const section = (title: string, side: "w" | "b") => (
        <>
            <Text style={styles.sectionTitle}>{title}</Text>

            {OPENINGS.filter((opening) => opening.side === side).map((opening) => {
                const stars = progress[opening.id] ?? 0;

                return (
                    <Pressable
                        key={opening.id}
                        onPress={() => open(opening)}
                        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                    >
                        <View style={[styles.sideBadge, side === "w" ? styles.sideWhite : styles.sideBlack]}>
                            <Text style={[styles.sideBadgeText, { color: side === "w" ? "#12151B" : "#EDF0F3" }]}>
                                {side === "w" ? "♔" : "♚"}
                            </Text>
                        </View>

                        <View style={styles.cardBody}>
                            <View style={styles.cardTitleRow}>
                                <Text style={styles.cardTitle} numberOfLines={1}>
                                    {tr(opening.name)}
                                </Text>
                                <Text style={styles.eco}>{opening.eco}</Text>
                            </View>
                            <Text style={styles.line} numberOfLines={1}>
                                {formatLine(opening.moves, 6)}
                            </Text>
                        </View>

                        {isVip ? (
                            stars > 0 ? (
                                <Text style={styles.stars}>
                                    {"★".repeat(stars)}
                                    <Text style={styles.starsOff}>{"★".repeat(3 - stars)}</Text>
                                </Text>
                            ) : (
                                <Ionicons name="chevron-forward" size={17} color={T.textFaint} />
                            )
                        ) : (
                            <Ionicons name="lock-closed" size={16} color={GOLD} />
                        )}
                    </Pressable>
                );
            })}
        </>
    );

    return (
        <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
            <View style={styles.scrim} />

            <ScrollView
                contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingTop: insets.top + 14,
                    paddingBottom: insets.bottom + 32,
                }}
                showsVerticalScrollIndicator={false}
            >
                <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10} accessibilityLabel={tr("Back")}>
                    <Ionicons name="chevron-back" size={20} color={T.text} />
                </Pressable>

                <View style={styles.header}>
                    <Text style={styles.logo}>{tr("OPENINGS")}</Text>
                    <Text style={styles.title}>{tr("Opening Trainer")}</Text>
                    <Text style={styles.subtitle}>{tr("Learn the first moves and the ideas behind them")}</Text>
                </View>

                {isVip === false ? (
                    <Pressable onPress={() => setGateOpen(true)} style={({ pressed }) => [styles.vipCard, pressed && styles.pressed]}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.vipEyebrow}>POVCHECK VIP</Text>
                            <Text style={styles.vipTitle}>{tr("Unlock all {0} openings", OPENINGS.length)}</Text>
                            <Text style={styles.vipText}>{tr("Included in every VIP plan")}</Text>
                        </View>
                        <View style={styles.vipArrow}>
                            <Ionicons name="lock-open-outline" size={17} color={GOLD} />
                        </View>
                    </Pressable>
                ) : (
                    isVip && (
                        <View style={styles.progressCard}>
                            <Text style={styles.progressText}>
                                {tr("{0} of {1} openings practised", learned, OPENINGS.length)}
                            </Text>
                            <View style={styles.track}>
                                <View style={[styles.fill, { width: `${(learned / OPENINGS.length) * 100}%` }]} />
                            </View>
                        </View>
                    )
                )}

                {section(tr("Play as White"), "w")}
                {section(tr("Play as Black"), "b")}
            </ScrollView>

            <LimitGate visible={gateOpen} kind="openings" onClose={() => setGateOpen(false)} />
        </ImageBackground>
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

    vipCard: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 18,
        backgroundColor: "#1B2027",
        borderWidth: 1,
        borderColor: "rgba(212, 175, 55, 0.35)",
        marginBottom: 24,
    },
    vipEyebrow: { color: GOLD, fontSize: 11, fontWeight: "800", letterSpacing: 1.4, marginBottom: 8 },
    vipTitle: { color: "#F5F7F9", fontSize: 19, fontWeight: "700", letterSpacing: -0.3, marginBottom: 4 },
    vipText: { color: "rgba(237, 240, 243, 0.5)", fontSize: 13 },
    vipArrow: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(212, 175, 55, 0.14)",
        marginLeft: 10,
    },

    progressCard: {
        borderRadius: 18,
        padding: 16,
        backgroundColor: "#1B2027",
        borderWidth: 1,
        borderColor: "rgba(91, 141, 184, 0.22)",
        marginBottom: 24,
    },
    progressText: { color: T.text, fontSize: 14, fontWeight: "600", marginBottom: 10 },
    track: { height: 6, borderRadius: 3, backgroundColor: "rgba(237,240,243,0.1)", overflow: "hidden" },
    fill: { height: 6, borderRadius: 3, backgroundColor: "#5B8DB8" },

    sectionTitle: {
        color: "rgba(237, 240, 243, 0.8)",
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 12,
        marginTop: 4,
        paddingLeft: 2,
    },
    card: {
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 13,
        backgroundColor: "#1B2027",
        borderWidth: 1,
        borderColor: "rgba(237, 240, 243, 0.08)",
        marginBottom: 10,
    },
    sideBadge: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
    sideWhite: { backgroundColor: "#E9E4DA" },
    sideBlack: { backgroundColor: "#0E1116", borderWidth: 1, borderColor: "rgba(237,240,243,0.16)" },
    sideBadgeText: { fontSize: 21 },
    cardBody: { flex: 1 },
    cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    cardTitle: { color: "#F2F4F6", fontSize: 15.5, fontWeight: "600", flexShrink: 1 },
    eco: { color: T.textFaint, fontSize: 11.5, fontWeight: "700", fontVariant: ["tabular-nums"] },
    line: { color: "rgba(237, 240, 243, 0.5)", fontSize: 12.5, marginTop: 3, fontVariant: ["tabular-nums"] },
    stars: { color: "#F5B942", fontSize: 14, letterSpacing: 1 },
    starsOff: { color: "rgba(237,240,243,0.18)" },
});
