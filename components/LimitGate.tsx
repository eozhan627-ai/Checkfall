import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, BackHandler, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { preloadRewardedAd, showRewardedAd } from "../lib/ads";
import { FALLBACK_AD_SECONDS, VIP_TRIAL_DAYS } from "../lib/config";
import { tr } from "../lib/i18n";
import { T } from "./ui/theme";

// "vip" is the app's own VIP pop-up (home screen): no limit was reached.
export type GateKind = "analysis" | "puzzle" | "lesson" | "openings" | "vip";

type Props = {
    visible: boolean;
    kind: GateKind;
    onClose: () => void;
    /** The player chose "Watch an ad" - called right before the ad starts. */
    onAdStart?: () => void;
    /** The ad (or the built-in VIP screen) was watched to the end. */
    onRewarded?: () => void;
    /** False when no more ads can be used today. */
    adAllowed?: boolean;
};

type Phase = "offer" | "loading" | "promo";

const GOLD = "#D4AF37";
const kingImage = require("../assets/images/king_white.png");

function content(kind: GateKind): { title: string; text: string } {
    switch (kind) {
        case "analysis":
            return {
                title: tr("You reached your daily limit"),
                text: tr("One game analysis a day is free. Upgrade to VIP for unlimited analyses - or watch a short ad to analyse this game."),
            };
        case "puzzle":
            return {
                title: tr("You reached your daily limit"),
                text: tr("Four puzzles a day are free. Upgrade to VIP for unlimited puzzles - or watch a short ad for four more."),
            };
        case "lesson":
            return {
                title: tr("You reached your daily limit"),
                text: tr("Your lessons for today are used up. Upgrade to VIP for more - or watch a short ad for one more lesson."),
            };
        case "vip":
            return {
                title: tr("Play without limits"),
                text:
                    VIP_TRIAL_DAYS > 0
                        ? tr("Try VIP free for {0} days. After that it renews monthly - cancel any time.", VIP_TRIAL_DAYS)
                        : tr("Get more out of every game with VIP."),
            };
        case "openings":
            return {
                title: tr("Openings are part of VIP"),
                text: tr("Learn the most important openings move by move, with the ideas behind them. Included in every VIP plan."),
            };
    }
}

const PERKS = [
    "Unlimited game analysis",
    "Unlimited puzzles and more lessons",
    "Opening trainer",
    "No ads",
];

// Shown when a daily limit is reached: upgrade to VIP, or watch an ad.
//
// Rendered as an overlay inside the screen (not as a Modal), because a
// full-screen ad cannot be opened on top of a Modal on iOS. Place it as the
// last child of the screen's root view.
export default function LimitGate({ visible, kind, onClose, onAdStart, onRewarded, adAllowed = true }: Props) {
    const [phase, setPhase] = useState<Phase>("offer");
    const [note, setNote] = useState<string | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(FALLBACK_AD_SECONDS);

    const float = useRef(new Animated.Value(0)).current;
    const glow = useRef(new Animated.Value(0)).current;
    const appear = useRef(new Animated.Value(0)).current;

    const canWatchAd = kind !== "openings" && kind !== "vip" && adAllowed;

    // Fresh start every time the window opens.
    useEffect(() => {
        if (!visible) return;

        setPhase("offer");
        setNote(null);
        if (canWatchAd) preloadRewardedAd();

        appear.setValue(0);
        Animated.spring(appear, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }).start();

        const loop = (value: Animated.Value, duration: number) =>
            Animated.loop(
                Animated.sequence([
                    Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                    Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                ])
            );

        const floating = loop(float, 1500);
        const glowing = loop(glow, 1100);
        floating.start();
        glowing.start();

        return () => {
            floating.stop();
            glowing.stop();
        };
    }, [visible, canWatchAd, appear, float, glow]);

    // Android back button closes the window (not while an ad is running).
    useEffect(() => {
        if (!visible || Platform.OS === "web") return;

        const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
            if (phase === "offer") onClose();
            return true;
        });

        return () => subscription.remove();
    }, [visible, phase, onClose]);

    // Countdown of the built-in VIP screen.
    useEffect(() => {
        if (!visible || phase !== "promo") return;

        if (secondsLeft <= 0) {
            onRewarded?.();
            onClose();
            return;
        }

        const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
        return () => clearTimeout(timer);
    }, [visible, phase, secondsLeft, onRewarded, onClose]);

    if (!visible) return null;

    async function watchAd() {
        setNote(null);
        setPhase("loading");
        onAdStart?.();

        const result = await showRewardedAd();

        if (result === "rewarded") {
            onRewarded?.();
            onClose();
            return;
        }

        if (result === "dismissed") {
            setNote(tr("Watch the ad to the end to unlock it."));
            setPhase("offer");
            preloadRewardedAd();
            return;
        }

        // No ad available right now: our own VIP screen instead.
        setSecondsLeft(FALLBACK_AD_SECONDS);
        setPhase("promo");
    }

    function openVip() {
        onClose();
        router.push("/vip");
    }

    const { title, text } = content(kind);

    const king = (
        <View style={styles.kingWrap}>
            <Animated.View
                style={[
                    styles.kingGlow,
                    {
                        opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] }),
                        transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] }) }],
                    },
                ]}
            />
            <Animated.View
                style={{
                    transform: [
                        { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [4, -8] }) },
                        { rotate: float.interpolate({ inputRange: [0, 1], outputRange: ["-3deg", "3deg"] }) },
                    ],
                }}
            >
                <Image source={kingImage} style={styles.king} resizeMode="contain" />
            </Animated.View>
            {[styles.sparkleA, styles.sparkleB, styles.sparkleC].map((position, index) => (
                <Animated.Text
                    key={index}
                    style={[
                        styles.sparkle,
                        position,
                        {
                            opacity: glow.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: index === 1 ? [1, 0.2, 1] : [0.2, 1, 0.2],
                            }),
                        },
                    ]}
                >
                    ✦
                </Animated.Text>
            ))}
        </View>
    );

    return (
        <View style={styles.backdrop} accessibilityViewIsModal>
            <Animated.View
                style={[
                    styles.card,
                    {
                        opacity: appear,
                        transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
                    },
                ]}
            >
                {phase === "offer" && (
                    <>
                        <Pressable onPress={onClose} style={styles.close} hitSlop={10} accessibilityLabel={tr("Close")}>
                            <Ionicons name="close" size={18} color={T.textDim} />
                        </Pressable>

                        {king}

                        <Text style={styles.eyebrow}>POVCHECK VIP</Text>
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.text}>{text}</Text>

                        {kind === "vip" && (
                            <View style={styles.perks}>
                                {PERKS.map((perk) => (
                                    <View key={perk} style={styles.perk}>
                                        <Ionicons name="checkmark-circle" size={17} color={GOLD} />
                                        <Text style={styles.perkText}>{tr(perk)}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {note && <Text style={styles.note}>{note}</Text>}

                        <Pressable onPress={openVip} style={({ pressed }) => [styles.vipButton, pressed && styles.pressed]}>
                            <Ionicons name="diamond" size={16} color="#1B1405" />
                            <Text style={styles.vipButtonText}>
                                {kind === "vip" && VIP_TRIAL_DAYS > 0
                                    ? tr("Start {0} days free", VIP_TRIAL_DAYS)
                                    : tr("Upgrade to VIP")}
                            </Text>
                        </Pressable>

                        {canWatchAd ? (
                            <Pressable onPress={watchAd} style={({ pressed }) => [styles.adButton, pressed && styles.pressed]}>
                                <Ionicons name="play-circle-outline" size={18} color={T.text} />
                                <Text style={styles.adButtonText}>{tr("Watch an ad")}</Text>
                            </Pressable>
                        ) : (
                            kind !== "openings" &&
                            kind !== "vip" && (
                                <Text style={styles.noAds}>{tr("No more ads available today. Come back tomorrow.")}</Text>
                            )
                        )}

                        <Pressable onPress={onClose} hitSlop={8} style={styles.later}>
                            <Text style={styles.laterText}>{tr("Not now")}</Text>
                        </Pressable>
                    </>
                )}

                {phase === "loading" && (
                    <View style={styles.loading}>
                        <ActivityIndicator color={GOLD} size="large" />
                        <Text style={styles.text}>{tr("Loading the ad…")}</Text>
                    </View>
                )}

                {phase === "promo" && (
                    <>
                        {king}

                        <Text style={styles.eyebrow}>POVCHECK VIP</Text>
                        <Text style={styles.title}>{tr("Play without limits")}</Text>

                        <View style={styles.perks}>
                            {PERKS.map((perk) => (
                                <View key={perk} style={styles.perk}>
                                    <Ionicons name="checkmark-circle" size={17} color={GOLD} />
                                    <Text style={styles.perkText}>{tr(perk)}</Text>
                                </View>
                            ))}
                        </View>

                        <View style={styles.countTrack}>
                            <View
                                style={[
                                    styles.countFill,
                                    { width: `${(1 - secondsLeft / FALLBACK_AD_SECONDS) * 100}%` },
                                ]}
                            />
                        </View>
                        <Text style={styles.countText}>{tr("Continues in {0} s", Math.max(0, secondsLeft))}</Text>

                        <Pressable onPress={openVip} style={({ pressed }) => [styles.vipButton, pressed && styles.pressed]}>
                            <Ionicons name="diamond" size={16} color="#1B1405" />
                            <Text style={styles.vipButtonText}>{tr("See plans ›")}</Text>
                        </Pressable>
                    </>
                )}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 8000,
        elevation: 8000,
        backgroundColor: "rgba(4,6,9,0.86)",
        alignItems: "center",
        justifyContent: "center",
        padding: 22,
    },
    card: {
        width: "100%",
        maxWidth: 380,
        borderRadius: 26,
        paddingHorizontal: 22,
        paddingTop: 26,
        paddingBottom: 20,
        alignItems: "center",
        backgroundColor: "#14181E",
        borderWidth: 1,
        borderColor: "rgba(212,175,55,0.38)",
    },
    pressed: { opacity: 0.8 },
    close: {
        position: "absolute",
        top: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(237,240,243,0.07)",
        zIndex: 2,
    },

    kingWrap: { width: 132, height: 132, alignItems: "center", justifyContent: "center", marginBottom: 12 },
    kingGlow: {
        position: "absolute",
        width: 112,
        height: 112,
        borderRadius: 56,
        backgroundColor: "rgba(212,175,55,0.22)",
        borderWidth: 1,
        borderColor: "rgba(212,175,55,0.5)",
    },
    king: { width: 86, height: 86 },
    sparkle: { position: "absolute", color: GOLD, fontSize: 15 },
    sparkleA: { top: 10, left: 14 },
    sparkleB: { top: 24, right: 8, fontSize: 11 },
    sparkleC: { bottom: 14, left: 26, fontSize: 10 },

    eyebrow: { color: GOLD, fontSize: 11, fontWeight: "800", letterSpacing: 1.6, marginBottom: 8 },
    title: { color: "#F5F7F9", fontSize: 22, fontWeight: "700", letterSpacing: -0.4, textAlign: "center" },
    text: { color: T.textDim, fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 10 },
    note: { color: "#E8B93E", fontSize: 13, textAlign: "center", marginTop: 10 },

    vipButton: {
        alignSelf: "stretch",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 20,
        paddingVertical: 14,
        borderRadius: 15,
        backgroundColor: GOLD,
    },
    vipButtonText: { color: "#1B1405", fontSize: 15.5, fontWeight: "800" },
    adButton: {
        alignSelf: "stretch",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 10,
        paddingVertical: 13,
        borderRadius: 15,
        backgroundColor: "rgba(237,240,243,0.07)",
        borderWidth: 1,
        borderColor: T.border,
    },
    adButtonText: { color: T.text, fontSize: 15, fontWeight: "700" },
    noAds: { color: T.textFaint, fontSize: 12.5, textAlign: "center", marginTop: 12 },
    later: { marginTop: 14 },
    laterText: { color: T.textFaint, fontSize: 13.5, fontWeight: "600" },

    loading: { paddingVertical: 40, alignItems: "center", gap: 6 },

    perks: { alignSelf: "stretch", gap: 9, marginTop: 16 },
    perk: { flexDirection: "row", alignItems: "center", gap: 10 },
    perkText: { color: T.text, fontSize: 14.5, flex: 1 },
    countTrack: {
        alignSelf: "stretch",
        height: 6,
        borderRadius: 3,
        backgroundColor: "rgba(237,240,243,0.1)",
        overflow: "hidden",
        marginTop: 20,
    },
    countFill: { height: 6, borderRadius: 3, backgroundColor: GOLD },
    countText: { color: T.textDim, fontSize: 12.5, marginTop: 8, fontVariant: ["tabular-nums"] },
});
