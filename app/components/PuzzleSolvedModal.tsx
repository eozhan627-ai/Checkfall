import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";

const { width: W, height: H } = Dimensions.get("window");
const CONFETTI_COLORS = ["#7C9473", "#6bb6ff", "#D2B45A", "#E0914D", "#B37FE0", "#DD6259"];

type Props = {
    visible: boolean;
    stars: number; // 1–3
    mistakes: number;
    hints: number;
    xpGain: number;
    xpTotal: number;
    level: number;
    streak: number;
    alreadySolvedToday: boolean;
    leveledUp: boolean;
    onHome: () => void;
    onMore: () => void;
    onClose: () => void;
};

const TITLES = ["", "Gelöst!", "Stark gelöst!", "Perfekt gelöst!"];

export default function PuzzleSolvedModal(p: Props) {
    const card = useRef(new Animated.Value(0)).current;
    const starAnims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
    const xpAnim = useRef(new Animated.Value(0)).current;
    const barAnim = useRef(new Animated.Value(0)).current;
    const [xpShown, setXpShown] = useState(0);

    const confetti = useMemo(
        () =>
            Array.from({ length: 28 }, (_, i) => ({
                x: Math.random() * W,
                size: 6 + Math.random() * 6,
                color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                drift: (Math.random() - 0.5) * 90,
                delay: Math.random() * 500,
                v: new Animated.Value(0),
            })),
        []
    );

    useEffect(() => {
        if (!p.visible) return;

        card.setValue(0);
        starAnims.forEach((a) => a.setValue(0));
        xpAnim.setValue(0);
        setXpShown(0);
        confetti.forEach((c) => c.v.setValue(0));

        const prevFrac = p.leveledUp ? 0 : ((p.xpTotal - p.xpGain) % 100) / 100;
        const newFrac = (p.xpTotal % 100) / 100;
        barAnim.setValue(prevFrac);

        const id = xpAnim.addListener(({ value }) => setXpShown(Math.round(value)));

        Animated.spring(card, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true }).start();

        Animated.sequence([
            Animated.delay(350),
            Animated.stagger(
                260,
                starAnims.slice(0, p.stars).map((a) =>
                    Animated.spring(a, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true })
                )
            ),
        ]).start();

        Animated.sequence([
            Animated.delay(900),
            Animated.parallel([
                Animated.timing(xpAnim, { toValue: p.xpGain, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
                Animated.timing(barAnim, { toValue: newFrac, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
            ]),
        ]).start();

        confetti.forEach((c) =>
            Animated.sequence([
                Animated.delay(c.delay),
                Animated.timing(c.v, { toValue: 1, duration: 2200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            ]).start()
        );

        return () => xpAnim.removeListener(id);
    }, [p.visible]);

    const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

    return (
        <Modal visible={p.visible} transparent animationType="fade" onRequestClose={p.onClose} statusBarTranslucent>
            <Pressable style={styles.backdrop} onPress={p.onClose}>
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                    {confetti.map((c, i) => (
                        <Animated.View
                            key={i}
                            style={{
                                position: "absolute",
                                left: c.x,
                                top: 0,
                                width: c.size,
                                height: c.size * 1.6,
                                borderRadius: 2,
                                backgroundColor: c.color,
                                opacity: c.v.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] }),
                                transform: [
                                    { translateY: c.v.interpolate({ inputRange: [0, 1], outputRange: [-30, H + 30] }) },
                                    { translateX: c.v.interpolate({ inputRange: [0, 1], outputRange: [0, c.drift] }) },
                                    { rotate: c.v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "540deg"] }) },
                                ],
                            }}
                        />
                    ))}
                </View>

                {/* Klick auf die Karte soll das Pop-up nicht schließen */}
                <Pressable onPress={() => { }}>
                    <Animated.View
                        style={[
                            styles.card,
                            {
                                opacity: card,
                                transform: [{ scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
                            },
                        ]}
                    >
                        <Text style={styles.title}>{TITLES[p.stars] ?? "Gelöst!"}</Text>

                        <View style={styles.starsRow}>
                            {[0, 1, 2].map((i) => {
                                const earned = i < p.stars;
                                return (
                                    <Animated.Text
                                        key={i}
                                        style={[
                                            styles.star,
                                            { color: earned ? "#F2C94C" : "#3A3F48" },
                                            earned && {
                                                transform: [
                                                    { scale: starAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
                                                    { rotate: starAnims[i].interpolate({ inputRange: [0, 1], outputRange: ["-40deg", "0deg"] }) },
                                                ],
                                            },
                                            i === 1 && { marginTop: -10 },
                                        ]}
                                    >
                                        ★
                                    </Animated.Text>
                                );
                            })}
                        </View>

                        <Text style={styles.subline}>
                            {p.mistakes === 0 && p.hints === 0
                                ? "Ohne Fehler und ohne Tipp."
                                : `${p.mistakes} Fehlversuch${p.mistakes === 1 ? "" : "e"} · ${p.hints} Tipp${p.hints === 1 ? "" : "s"}`}
                        </Text>

                        {p.alreadySolvedToday ? (
                            <Text style={styles.already}>Das heutige Puzzle hattest du schon – diesmal gibt es keine XP.</Text>
                        ) : (
                            <>
                                <Text style={styles.xp}>+{xpShown} XP</Text>
                                <View style={styles.barTrack}>
                                    <Animated.View style={[styles.barFill, { width: barWidth }]} />
                                </View>
                                <Text style={styles.levelText}>
                                    {p.leveledUp ? `Level-Up! Du bist jetzt Level ${p.level}` : `Level ${p.level}`}
                                </Text>
                            </>
                        )}

                        {p.streak > 0 && (
                            <View style={styles.streakPill}>
                                <Text style={styles.streakText}>🔥 {p.streak} {p.streak === 1 ? "Tag" : "Tage"} in Folge</Text>
                            </View>
                        )}

                        <Pressable onPress={p.onMore} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
                            <Text style={styles.primaryText}>Weitere Puzzles</Text>
                        </Pressable>
                        <Pressable onPress={p.onHome} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}>
                            <Text style={styles.secondaryText}>Home</Text>
                        </Pressable>
                    </Animated.View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(6,8,11,0.78)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
    card: {
        width: Math.min(W - 48, 360),
        backgroundColor: "#171A20",
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        paddingVertical: 28,
        paddingHorizontal: 22,
        alignItems: "center",
    },
    title: { color: "#ECEDEE", fontSize: 24, fontWeight: "800" },
    starsRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 14 },
    star: { fontSize: 54 },
    subline: { color: "#868C94", fontSize: 13, marginTop: 6 },
    xp: { color: "#9BB58F", fontSize: 30, fontWeight: "800", marginTop: 18, fontVariant: ["tabular-nums"] },
    barTrack: { width: "100%", height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.07)", marginTop: 10, overflow: "hidden" },
    barFill: { height: "100%", borderRadius: 4, backgroundColor: "#7C9473" },
    levelText: { color: "#868C94", fontSize: 12.5, marginTop: 6 },
    already: { color: "#868C94", fontSize: 13, textAlign: "center", marginTop: 16, lineHeight: 19 },
    streakPill: { marginTop: 16, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(224,145,77,0.15)", borderWidth: 1, borderColor: "rgba(224,145,77,0.4)" },
    streakText: { color: "#E0914D", fontSize: 13, fontWeight: "700" },
    primary: { width: "100%", marginTop: 22, backgroundColor: "#7C9473", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
    primaryText: { color: "#12151B", fontSize: 15, fontWeight: "800" },
    secondary: { width: "100%", marginTop: 10, paddingVertical: 13, borderRadius: 14, alignItems: "center", backgroundColor: "#1D2129", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
    secondaryText: { color: "#ECEDEE", fontSize: 14.5, fontWeight: "600" },
});