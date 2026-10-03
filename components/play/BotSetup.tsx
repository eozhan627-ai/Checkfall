import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ImageBackground from "../ui/ImageBackground";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "../ui/theme";
import Segmented from "./Segmented";
import Slider from "./Slider";
import { tr } from "../../lib/i18n";

export const BOT_ELO_MIN = 100;
export const BOT_ELO_MAX = 3200;
export const BOT_ELO_STEP = 50;

export type BotColorChoice = "w" | "b" | "random";

type Level = { upTo: number; name: string; text: string; color: string };

// Ordered from weak to strong; the first entry whose limit is above the
// rating describes the bot.
const LEVELS: Level[] = [
    { upTo: 250, name: "Beginner", get text() { return tr("Gives pieces away and misses simple threats."); }, color: "#7FB77E" },
    { upTo: 600, name: "Casual", get text() { return tr("Knows the rules well, but overlooks tactics."); }, color: "#8DBB5A" },
    { upTo: 1000, name: "Club Player", get text() { return tr("Solid moves, punishes obvious blunders."); }, color: "#5B9BD5" },
    { upTo: 1500, name: "Strong", get text() { return tr("Sees most tactics and plays with a plan."); }, color: "#5B8DB8" },
    { upTo: 2000, name: "Expert", get text() { return tr("Rarely blunders and converts advantages."); }, color: "#B58CE0" },
    { upTo: 2600, name: "Master", get text() { return tr("Deep calculation, strong endgames."); }, color: "#E8B93E" },
    { upTo: 3200, name: "Grandmaster", get text() { return tr("World-class play in every phase."); }, color: "#EE8D3F" },
    { upTo: Infinity, name: "Full Stockfish", get text() { return tr("The engine at full strength. Good luck."); }, color: "#D9534F" },
];

export function getBotLevel(elo: number): Level {
    return LEVELS.find((level) => elo < level.upTo) ?? LEVELS[LEVELS.length - 1];
}

const PRESETS = [200, 400, 800, 1200, 1600, 2000, 2400, 2800, 3200];

type Props = {
    elo: number;
    onEloChange: (elo: number) => void;
    color: BotColorChoice;
    onColorChange: (color: BotColorChoice) => void;
    /** A saved game is waiting: the button continues it instead. */
    hasSavedGame: boolean;
    onStart: () => void;
    onBack: () => void;
};

const backgroundImage = require("../../assets/images/loginbackground.jpg");

/** Everything the player chooses before a game against the bot. */
export default function BotSetup({ elo, onEloChange, color, onColorChange, hasSavedGame, onStart, onBack }: Props) {
    const insets = useSafeAreaInsets();
    const level = getBotLevel(elo);

    const change = (delta: number) =>
        onEloChange(Math.min(BOT_ELO_MAX, Math.max(BOT_ELO_MIN, elo + delta)));

    return (
        <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
            <View style={styles.scrim} />

            <ScrollView
                contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 28 }]}
                showsVerticalScrollIndicator={false}
            >
                <Pressable onPress={onBack} style={styles.back} hitSlop={10} accessibilityLabel={tr("Back")}>
                    <Ionicons name="chevron-back" size={20} color={T.text} />
                </Pressable>

                <View style={styles.header}>
                    <Text style={styles.logo}>{tr("PLAY")}</Text>
                    <Text style={styles.title}>{tr("Play against Bot")}</Text>
                    <Text style={styles.subtitle}>{tr("Pick a strength that challenges you")}</Text>
                </View>

                {/* OPPONENT */}
                <View style={[styles.card, { borderColor: level.color + "55" }]}>
                    <View style={styles.botRow}>
                        <View style={[styles.botAvatar, { backgroundColor: level.color + "22", borderColor: level.color + "66" }]}>
                            <Ionicons name="hardware-chip-outline" size={26} color={level.color} />
                        </View>

                        <View style={{ flex: 1 }}>
                            <Text style={[styles.levelName, { color: level.color }]}>{tr(level.name)}</Text>
                            <Text style={styles.levelText}>{level.text}</Text>
                        </View>
                    </View>

                    <View style={styles.eloRow}>
                        <Pressable
                            onPress={() => change(-BOT_ELO_STEP)}
                            disabled={elo <= BOT_ELO_MIN}
                            style={({ pressed }) => [styles.stepButton, elo <= BOT_ELO_MIN && styles.disabled, pressed && styles.pressed]}
                            accessibilityLabel={tr("Weaker")}
                            hitSlop={6}
                        >
                            <Ionicons name="remove" size={20} color={T.text} />
                        </Pressable>

                        <View style={styles.eloBox}>
                            <Text style={styles.eloValue}>{elo >= BOT_ELO_MAX ? tr("MAX") : elo}</Text>
                            <Text style={styles.eloLabel}>{tr("ELO")}</Text>
                        </View>

                        <Pressable
                            onPress={() => change(BOT_ELO_STEP)}
                            disabled={elo >= BOT_ELO_MAX}
                            style={({ pressed }) => [styles.stepButton, elo >= BOT_ELO_MAX && styles.disabled, pressed && styles.pressed]}
                            accessibilityLabel={tr("Stronger")}
                            hitSlop={6}
                        >
                            <Ionicons name="add" size={20} color={T.text} />
                        </Pressable>
                    </View>

                    <Slider
                        minimumValue={BOT_ELO_MIN}
                        maximumValue={BOT_ELO_MAX}
                        step={BOT_ELO_STEP}
                        value={elo}
                        onValueChange={onEloChange}
                        color={level.color}
                    />

                    <View style={styles.scale}>
                        <Text style={styles.scaleText}>{BOT_ELO_MIN}</Text>
                        <Text style={styles.scaleText}>{BOT_ELO_MAX}</Text>
                    </View>
                </View>

                {/* QUICK PICK */}
                <Text style={styles.sectionTitle}>{tr("Quick pick")}</Text>
                <View style={styles.presets}>
                    {PRESETS.map((preset) => {
                        const active = preset === elo;

                        return (
                            <Pressable
                                key={preset}
                                onPress={() => onEloChange(preset)}
                                style={({ pressed }) => [styles.preset, active && styles.presetActive, pressed && styles.pressed]}
                            >
                                <Text style={[styles.presetValue, active && { color: "#FFFFFF" }]}>
                                    {preset >= BOT_ELO_MAX ? tr("MAX") : preset}
                                </Text>
                                <Text style={styles.presetName} numberOfLines={1}>
                                    {tr(getBotLevel(preset).name)}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                {/* COLOUR */}
                <Text style={styles.sectionTitle}>{tr("Your colour")}</Text>
                <Segmented
                    value={color}
                    onChange={onColorChange}
                    options={[
                        { value: "w", label: tr("White"), hint: tr("You move first") },
                        { value: "random", label: tr("Random") , hint: tr("Surprise me") },
                        { value: "b", label: tr("Black"), hint: tr("Bot moves first") },
                    ]}
                />

                <Pressable onPress={onStart} style={({ pressed }) => [styles.start, pressed && styles.pressed]}>
                    <Text style={styles.startText}>{hasSavedGame ? tr("Continue saved game") : tr("Start game")}</Text>
                    {!hasSavedGame && (
                        <Text style={styles.startSub}>
                            {tr(level.name)} · {elo >= BOT_ELO_MAX ? tr("full strength") : tr("{0} Elo", elo)}
                        </Text>
                    )}
                </Pressable>

                <Text style={styles.footnote}>{tr("Games against the bot do not change your rating.")}</Text>
            </ScrollView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#12151B" },
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10, 12, 16, 0.6)" },
    content: { paddingHorizontal: 20 },
    pressed: { opacity: 0.72 },
    disabled: { opacity: 0.3 },

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

    card: {
        borderRadius: 20,
        padding: 18,
        backgroundColor: "#1B2027",
        borderWidth: 1,
        marginBottom: 24,
    },
    botRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    botAvatar: {
        width: 54,
        height: 54,
        borderRadius: 17,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    levelName: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
    levelText: { color: "rgba(237, 240, 243, 0.55)", fontSize: 13, lineHeight: 18, marginTop: 3 },

    eloRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 18,
        marginBottom: 6,
    },
    stepButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(237, 240, 243, 0.06)",
        borderWidth: 1,
        borderColor: T.border,
    },
    eloBox: { alignItems: "center" },
    eloValue: { color: "#F5F7F9", fontSize: 40, fontWeight: "700", letterSpacing: -1, fontVariant: ["tabular-nums"] },
    eloLabel: { color: T.textFaint, fontSize: 11, fontWeight: "700", letterSpacing: 1.4, marginTop: -2 },

    scale: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 },
    scaleText: { color: T.textFaint, fontSize: 11.5, fontVariant: ["tabular-nums"] },

    sectionTitle: {
        color: "rgba(237, 240, 243, 0.8)",
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 12,
        paddingLeft: 2,
    },

    presets: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
    preset: {
        width: "31.6%",
        paddingVertical: 10,
        borderRadius: 14,
        alignItems: "center",
        backgroundColor: "#1B2027",
        borderWidth: 1,
        borderColor: T.border,
    },
    presetActive: { backgroundColor: T.accentSoft, borderColor: T.accent },
    presetValue: { color: T.text, fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
    presetName: { color: T.textFaint, fontSize: 11.5, marginTop: 2 },

    start: {
        marginTop: 26,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: "center",
        backgroundColor: "#5B8DB8",
    },
    startText: { color: "#FFFFFF", fontSize: 16.5, fontWeight: "800" },
    startSub: { color: "rgba(255,255,255,0.78)", fontSize: 12, marginTop: 2 },
    footnote: { color: T.textFaint, fontSize: 12, textAlign: "center", marginTop: 12 },
});
