import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    Alert,
    ImageBackground,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import VipBadge from "../components/VipBadge";
import { AccountType, getCurrentAccount, VipTier } from "../lib/account";
import { supabase } from "../lib/supabase";

type PlanId = "silver" | "gold" | "diamond";

const PLANS: {
    id: PlanId;
    name: string;
    monthly: string;
    yearly?: string;
    lifetime?: string;
    features: string[];
    accent: string;
}[] = [
    {
        id: "silver",
        name: "Silver",
        monthly: "5,99 €/Monat",
        features: [
            "Basic-KI Analyse (unbegrenzt)",
            "3 Lektionen pro Tag",
            "Unbegrenzte Puzzles",
            "Keine Werbung",
        ],
        accent: "#C0C5CE",
    },
    {
        id: "gold",
        name: "Gold",
        monthly: "8,99 €/Monat",
        yearly: "97,99 €/Jahr",
        features: [
            "Basic-KI Analyse (unbegrenzt)",
            "Unbegrenzte Lektionen",
            "Unbegrenzte Puzzles",
            "Exklusive Skins",
            "Clans gründen* (auch nach den ersten 100)",
            "Keine Werbung",
        ],
        accent: "#D4AF37",
    },
    {
        id: "diamond",
        name: "Diamond",
        monthly: "12,99 €/Monat",
        yearly: "129,99 €/Jahr",
        lifetime: "309,99 € (einmalig, lebenslang)",
        features: [
            "Volle Stockfish-Tiefe + KI-Auswertung",
            "Langzeitstatistiken & Fortschritt",
            "Unbegrenzte Lektionen & Puzzles",
            "Exklusive Skins & Emotes",
            "Clans gründen* (auch nach den ersten 100)",
            "Diamond-Profilrahmen & Badge",
            "Keine Werbung",
        ],
        accent: "#A8E0EC",
    },
];

export default function VipScreen() {
    const [account, setAccount] = useState<AccountType | null>(null);
    const [loading, setLoading] = useState(true);
    const [busyTier, setBusyTier] = useState<PlanId | null>(null);

    const backgroundImage = require("../assets/images/loginbackground.png");

    const loadAccount = useCallback(async () => {
        const acc = await getCurrentAccount();
        setAccount(acc);
        setLoading(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadAccount();
        }, [loadAccount])
    );

    const currentTier: VipTier = account?.vipTier ?? "none";
    const isGuest = !!account?.guest;

    const handleUpgradePress = (planName: string) => {
        Alert.alert(
            "Bald verfügbar",
            `${planName} kann aktuell noch nicht gekauft werden. VIP befindet sich in der Testphase.`
        );
    };

    const handleDevSetTier = async (tier: PlanId) => {
        if (!account || isGuest) return;

        setBusyTier(tier);

        try {
            const nextTier = currentTier === tier ? "none" : tier;

            const { data, error } = await supabase.rpc(
                "dev_set_own_vip_tier",
                { new_tier: nextTier }
            );

            if (error) {
                console.log("DEV VIP TIER ERROR:", error);
                Alert.alert("Fehler", "VIP-Stufe konnte nicht geändert werden.");
                return;
            }

            setAccount((prev) =>
                prev ? { ...prev, vipTier: data as VipTier } : prev
            );
        } catch (error) {
            console.log("DEV VIP TIER ERROR:", error);
        } finally {
            setBusyTier(null);
        }
    };

    if (loading) {
        return (
            <ImageBackground
                source={backgroundImage}
                style={styles.container}
                resizeMode="cover"
            >
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Wird geladen...</Text>
                </View>
            </ImageBackground>
        );
    }

    return (
        <ImageBackground
            source={backgroundImage}
            style={styles.container}
            resizeMode="cover"
        >
            <View style={styles.scrim} />

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Pressable
                        onPress={() => router.back()}
                        style={styles.backButton}
                    >
                        <Text style={styles.backText}>‹</Text>
                    </Pressable>
                    <View style={{ width: 42 }} />
                </View>

                <View style={styles.hero}>
                    <Text style={styles.eyebrow}>POV CHECK VIP</Text>
                    <Text style={styles.heroTitle}>
                        Unlock the premium side of POV Check.
                    </Text>

                    {currentTier !== "none" && (
                        <View style={styles.currentBadgeRow}>
                            <VipBadge tier={currentTier} />
                            <Text style={styles.currentBadgeText}>
                                Dein aktueller Plan
                            </Text>
                        </View>
                    )}
                </View>

                {PLANS.map((plan) => {
                    const isCurrent = currentTier === plan.id;

                    return (
                        <View
                            key={plan.id}
                            style={[
                                styles.planCard,
                                { borderColor: `${plan.accent}33` },
                                isCurrent && {
                                    borderColor: plan.accent,
                                    borderWidth: 1.5,
                                },
                            ]}
                        >
                            <View style={styles.planHeader}>
                                <Text
                                    style={[
                                        styles.planName,
                                        { color: plan.accent },
                                    ]}
                                >
                                    {plan.name}
                                </Text>

                                <Text style={styles.planPrice}>
                                    {plan.monthly}
                                </Text>
                            </View>

                            {(plan.yearly || plan.lifetime) && (
                                <Text style={styles.planSubPrice}>
                                    {[plan.yearly, plan.lifetime]
                                        .filter(Boolean)
                                        .join("  ·  ")}
                                </Text>
                            )}

                            <View style={styles.featureList}>
                                {plan.features.map((feature) => (
                                    <View
                                        key={feature}
                                        style={styles.featureRow}
                                    >
                                        <View
                                            style={[
                                                styles.checkCircle,
                                                {
                                                    backgroundColor: `${plan.accent}22`,
                                                    borderColor: `${plan.accent}66`,
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.checkMark,
                                                    { color: plan.accent },
                                                ]}
                                            >
                                                ✓
                                            </Text>
                                        </View>

                                        <Text style={styles.featureText}>
                                            {feature}
                                        </Text>
                                    </View>
                                ))}
                            </View>

                            <Pressable
                                onPress={() => handleUpgradePress(plan.name)}
                                disabled={isCurrent}
                                style={({ pressed }) => [
                                    styles.upgradeButton,
                                    {
                                        backgroundColor: `${plan.accent}22`,
                                        borderColor: `${plan.accent}88`,
                                    },
                                    pressed && styles.pressed,
                                    isCurrent && styles.upgradeButtonDisabled,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.upgradeText,
                                        { color: plan.accent },
                                    ]}
                                >
                                    {isCurrent ? "Aktueller Plan" : "Upgrade"}
                                </Text>
                            </Pressable>

                            {__DEV__ && !isGuest && (
                                <Pressable
                                    onPress={() => handleDevSetTier(plan.id)}
                                    disabled={busyTier === plan.id}
                                    style={({ pressed }) => [
                                        styles.devButton,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Text style={styles.devButtonText}>
                                        {busyTier === plan.id
                                            ? "..."
                                            : isCurrent
                                            ? `Dev: ${plan.name} deaktivieren`
                                            : `Dev: ${plan.name} aktivieren`}
                                    </Text>
                                </Pressable>
                            )}
                        </View>
                    );
                })}

                <Text style={styles.footnote}>
                    * Clans gründen: Solange weniger als 100 Clans existieren,
                    kann jeder gründen. Danach nur noch Gold/Diamond.
                </Text>

                {isGuest && (
                    <Text style={styles.guestHint}>
                        Gäste-Accounts können VIP nicht nutzen. Melde dich mit
                        einem echten Account an.
                    </Text>
                )}

                <View style={{ height: 30 }} />
            </ScrollView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#12151B" },
    scrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(10, 12, 16, 0.6)",
    },
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
    loadingText: { color: "#EDF0F3", fontSize: 16 },
    content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 40 },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 28,
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: "rgba(237,240,243,0.06)",
        borderWidth: 1,
        borderColor: "rgba(237,240,243,0.09)",
        justifyContent: "center",
        alignItems: "center",
    },
    backText: {
        color: "#EDF0F3",
        fontSize: 30,
        lineHeight: 30,
        fontWeight: "300",
    },
    hero: { marginBottom: 26 },
    eyebrow: {
        color: "#D4AF37",
        fontSize: 13,
        fontWeight: "700",
        letterSpacing: 1.6,
        marginBottom: 14,
    },
    heroTitle: {
        color: "#F5F7F9",
        fontSize: 26,
        fontWeight: "700",
        letterSpacing: -0.6,
        lineHeight: 32,
    },
    currentBadgeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginTop: 16,
    },
    currentBadgeText: { color: "rgba(237,240,243,0.6)", fontSize: 13 },
    planCard: {
        borderRadius: 20,
        backgroundColor: "#1B2027",
        borderWidth: 1,
        paddingHorizontal: 20,
        paddingVertical: 20,
        marginBottom: 18,
    },
    planHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    planName: { fontSize: 19, fontWeight: "700" },
    planPrice: { color: "#F5F7F9", fontSize: 15, fontWeight: "600" },
    planSubPrice: {
        color: "rgba(237,240,243,0.5)",
        fontSize: 12.5,
        marginBottom: 14,
    },
    featureList: { marginBottom: 16 },
    featureRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
    checkCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    checkMark: { fontSize: 11, fontWeight: "700" },
    featureText: { color: "#EDF0F3", fontSize: 13.5, flex: 1 },
    upgradeButton: {
        height: 46,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    upgradeButtonDisabled: { opacity: 0.5 },
    upgradeText: { fontSize: 14.5, fontWeight: "700" },
    devButton: {
        height: 40,
        borderRadius: 12,
        backgroundColor: "rgba(237,240,243,0.05)",
        borderWidth: 1,
        borderColor: "rgba(237,240,243,0.1)",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 10,
    },
    devButtonText: {
        color: "rgba(237,240,243,0.6)",
        fontSize: 12.5,
        fontWeight: "600",
    },
    footnote: {
        color: "rgba(237,240,243,0.4)",
    
        fontSize: 11.5,
        lineHeight: 16,
        marginTop: 4,
        marginBottom: 18,
    },
    guestHint: {
        color: "rgba(237,240,243,0.45)",
        fontSize: 12.5,
        textAlign: "center",
        lineHeight: 17,
    },
    pressed: { opacity: 0.72 },
});