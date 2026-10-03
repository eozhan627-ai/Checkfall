import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Coin, { CoinAmount } from "../components/Coin";
import { T } from "../components/ui/theme";
import { BOARD_THEMES, BoardTheme, coinBalance, ownsTheme } from "../lib/boardThemes";
import { ALL_DONE_BONUS_COINS, COINS_PER_TASK } from "../lib/dailyTaskRules";
import { tr } from "../lib/i18n";
import { buyTheme, selectTheme, useShop } from "../lib/shop";

// Names of the designs, so the German dictionary can find them.
function themeName(theme: BoardTheme): string {
    switch (theme.id) {
        case "classic":
            return tr("Classic");
        case "forest":
            return tr("Forest");
        case "ocean":
            return tr("Ocean");
        case "walnut":
            return tr("Walnut");
        case "rose":
            return tr("Rose");
        case "marble":
            return tr("Marble");
        case "night":
            return tr("Night");
        case "ice":
            return tr("Ice");
        case "amethyst":
            return tr("Amethyst");
        case "gold":
            return tr("Gold");
        default:
            return theme.name;
    }
}

function Preview({ theme }: { theme: BoardTheme }) {
    return (
        <View style={styles.preview}>
            {[0, 1, 2, 3].map((row) => (
                <View key={row} style={styles.previewRow}>
                    {[0, 1, 2, 3].map((column) => (
                        <View
                            key={column}
                            style={[styles.previewSquare, { backgroundColor: (row + column) % 2 === 0 ? theme.light : theme.dark }]}
                        />
                    ))}
                </View>
            ))}
        </View>
    );
}

// Shop: board designs for coins. Coins come from the daily missions.
export default function ShopScreen() {
    const insets = useSafeAreaInsets();
    const shop = useShop();
    const balance = coinBalance(shop);

    // Buying takes two taps: the first one asks, the second one buys.
    const [confirming, setConfirming] = useState<string | null>(null);
    const [message, setMessage] = useState<{ id: string; text: string } | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
    }, []);

    const later = (action: () => void, ms: number) => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(action, ms);
    };

    async function press(theme: BoardTheme) {
        setMessage(null);

        if (ownsTheme(shop, theme.id)) {
            setConfirming(null);
            await selectTheme(theme.id);
            return;
        }

        if (balance < theme.price) {
            setConfirming(null);
            setMessage({ id: theme.id, text: tr("{0} coins missing", theme.price - balance) });
            later(() => setMessage(null), 3000);
            return;
        }

        if (confirming !== theme.id) {
            setConfirming(theme.id);
            later(() => setConfirming(null), 4000);
            return;
        }

        setConfirming(null);
        const result = await buyTheme(theme.id);

        if (!result.ok && result.reason === "coins") {
            setMessage({ id: theme.id, text: tr("{0} coins missing", result.missing ?? 0) });
        }
    }

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10} accessibilityLabel={tr("Back")}>
                        <Ionicons name="chevron-back" size={20} color={T.text} />
                    </Pressable>

                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>{tr("Shop")}</Text>
                        <Text style={styles.subtitle}>{tr("Board designs for your coins")}</Text>
                    </View>

                    <View style={styles.balance} accessibilityLabel={tr("{0} coins", balance)}>
                        <Coin size={18} />
                        <Text style={styles.balanceText}>{balance}</Text>
                    </View>
                </View>

                <View style={styles.info}>
                    <Ionicons name="information-circle-outline" size={18} color={T.accent} />
                    <Text style={styles.infoText}>
                        {tr(
                            "You earn coins with the daily missions: {0} per mission and {1} extra for finishing all three.",
                            COINS_PER_TASK,
                            ALL_DONE_BONUS_COINS
                        )}
                    </Text>
                </View>

                <Text style={styles.sectionTitle}>{tr("Board designs")}</Text>

                <View style={styles.grid}>
                    {BOARD_THEMES.map((theme) => {
                        const owned = ownsTheme(shop, theme.id);
                        const active = shop.boardTheme === theme.id;
                        const affordable = balance >= theme.price;
                        const note = message?.id === theme.id ? message.text : null;

                        return (
                            <View key={theme.id} style={[styles.card, active && styles.cardActive]}>
                                <Preview theme={theme} />

                                <Text style={styles.cardTitle}>{themeName(theme)}</Text>

                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: active }}
                                    disabled={active}
                                    onPress={() => press(theme)}
                                    style={({ pressed }) => [
                                        styles.button,
                                        owned && styles.buttonOwned,
                                        active && styles.buttonActive,
                                        !owned && !affordable && styles.buttonLocked,
                                        confirming === theme.id && styles.buttonConfirm,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    {active ? (
                                        <>
                                            <Ionicons name="checkmark" size={15} color="#6FCF97" />
                                            <Text style={[styles.buttonText, { color: "#6FCF97" }]}>{tr("In use")}</Text>
                                        </>
                                    ) : owned ? (
                                        <Text style={styles.buttonText}>{tr("Use")}</Text>
                                    ) : confirming === theme.id ? (
                                        <>
                                            <Text style={[styles.buttonText, { color: "#12151B" }]}>{tr("Buy for")}</Text>
                                            <CoinAmount amount={theme.price} color="#12151B" />
                                        </>
                                    ) : (
                                        <CoinAmount amount={theme.price} color={affordable ? "#F1D98A" : "rgba(237,240,243,0.45)"} />
                                    )}
                                </Pressable>

                                <Text style={styles.note}>{note ?? " "}</Text>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: T.bg },

    header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
    back: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: T.raised,
        borderWidth: 1,
        borderColor: T.border,
    },
    title: { color: T.text, fontSize: 24, fontWeight: "700", letterSpacing: -0.4 },
    subtitle: { color: T.textDim, fontSize: 13, marginTop: 2 },
    balance: {
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: T.goldSoft,
        borderWidth: 1,
        borderColor: T.goldBorder,
    },
    balanceText: { color: "#F1D98A", fontSize: 16, fontWeight: "800" },

    info: {
        flexDirection: "row",
        gap: 10,
        padding: 14,
        borderRadius: 14,
        backgroundColor: T.accentSoft,
        borderWidth: 1,
        borderColor: T.accentBorder,
        marginBottom: 22,
    },
    infoText: { flex: 1, color: T.text, fontSize: 13, lineHeight: 18 },

    sectionTitle: { color: "rgba(237, 240, 243, 0.8)", fontSize: 16, fontWeight: "600", marginBottom: 14, paddingLeft: 2 },

    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
    card: {
        width: "48.2%",
        borderRadius: 18,
        padding: 12,
        backgroundColor: T.raised,
        borderWidth: 1,
        borderColor: T.border,
        marginBottom: 12,
    },
    cardActive: { borderColor: "rgba(111, 207, 151, 0.5)" },
    cardTitle: { color: T.text, fontSize: 15, fontWeight: "600", marginTop: 10, marginBottom: 10 },

    preview: { aspectRatio: 1, borderRadius: 10, overflow: "hidden" },
    previewRow: { flex: 1, flexDirection: "row" },
    previewSquare: { flex: 1 },

    button: {
        minHeight: 38,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderRadius: 11,
        backgroundColor: T.goldSoft,
        borderWidth: 1,
        borderColor: T.goldBorder,
    },
    buttonOwned: { backgroundColor: T.accentSoft, borderColor: T.accentBorder },
    buttonActive: { backgroundColor: "rgba(111, 207, 151, 0.12)", borderColor: "rgba(111, 207, 151, 0.4)" },
    buttonLocked: { backgroundColor: "rgba(237, 240, 243, 0.04)", borderColor: T.border },
    buttonConfirm: { backgroundColor: T.gold, borderColor: T.gold },
    buttonText: { color: T.text, fontSize: 13.5, fontWeight: "700" },
    note: { color: "#E0735C", fontSize: 11.5, marginTop: 6, minHeight: 15, textAlign: "center" },

    pressed: { opacity: 0.72 },
});
