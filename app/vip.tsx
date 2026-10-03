import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import ImageBackground from "../components/ui/ImageBackground";
import VipBadge from "../components/VipBadge";
import { AccountType, getCurrentAccount, VipTier } from "../lib/account";
import { syncVip } from "../lib/api";
import {
    buyPlan,
    getStorePlans,
    openSubscriptionSettings,
    purchasesAvailable,
    restorePurchases,
    StorePlan,
} from "../lib/purchases";
import { tr } from "../lib/i18n";

type PlanId = "silver" | "gold" | "diamond";

const PLANS: {
    id: PlanId;
    name: string;
    monthly: string;
    features: string[];
    accent: string;
}[] = [
    {
        id: "silver",
        name: "Silver",
        monthly: "€5.99/month",
        features: [
            "Unlimited game analysis",
            "Unlimited puzzles",
            "3 lessons per day",
            "Opening trainer",
            "No ads",
        ],
        accent: "#C0C5CE",
    },
    {
        id: "gold",
        name: "Gold",
        monthly: "€8.99/month",
        features: [
            "Deeper game analysis",
            "Unlimited puzzles and lessons",
            "Opening trainer",
            "Coach: more questions per day",
            "Create clans* (even after the first 100)",
            "No ads",
        ],
        accent: "#D4AF37",
    },
    {
        id: "diamond",
        name: "Diamond",
        monthly: "€12.99/month",
        features: [
            "Full Stockfish depth + AI evaluation",
            "Unlimited puzzles and lessons",
            "Opening trainer",
            "Coach: most questions per day",
            "Create clans* (even after the first 100)",
            "Diamond profile frame & badge",
            "No ads",
        ],
        accent: "#A8E0EC",
    },
];

export default function VipScreen() {
    const [account, setAccount] = useState<AccountType | null>(null);
    const [loading, setLoading] = useState(true);

    const backgroundImage = require("../assets/images/loginbackground.jpg");

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

    // Plans as the store offers them (real prices, free trial). Empty while
    // loading or when purchases are not available in this build.
    const [storePlans, setStorePlans] = useState<StorePlan[]>([]);
    const [busy, setBusy] = useState<string | null>(null);

    const authId = account && !account.guest ? account.authId ?? null : null;

    useEffect(() => {
        let alive = true;

        if (authId && purchasesAvailable()) {
            getStorePlans(authId).then((plans) => alive && setStorePlans(plans));
        }

        return () => {
            alive = false;
        };
    }, [authId]);

    // The server checks the subscription with the store and sets the plan.
    const refreshPlan = async () => {
        try {
            await syncVip();
        } catch {
            // The store notifies the server as well - the plan arrives a
            // little later then.
        }
        await loadAccount();
    };

    const handleUpgradePress = async (planId: PlanId, planName: string) => {
        if (!authId) {
            Alert.alert(tr("Account required"), tr("Guest accounts cannot use VIP. Sign in with a real account."));
            return;
        }

        const storePlan = storePlans.find((plan) => plan.id === planId);

        if (!storePlan) {
            Alert.alert(
                tr("Coming soon"),
                tr("{0} cannot be purchased yet. VIP is still in its test phase.", planName)
            );
            return;
        }

        setBusy(planId);
        const result = await buyPlan(authId, storePlan);

        if (result === "purchased") {
            await refreshPlan();
            Alert.alert(tr("Welcome to VIP"), tr("Your {0} plan is active now.", planName));
        } else if (result === "failed") {
            Alert.alert(tr("Purchase not completed"), tr("The purchase could not be completed. You have not been charged."));
        }

        setBusy(null);
    };

    const handleRestore = async () => {
        if (!authId) return;

        setBusy("restore");
        const found = await restorePurchases(authId);
        await refreshPlan();
        setBusy(null);

        if (!found) Alert.alert(tr("Restore purchases"), tr("No purchases could be restored."));
    };

    if (loading) {
        return (
            <ImageBackground
                source={backgroundImage}
                style={styles.container}
                resizeMode="cover"
            >
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>{tr("Loading...")}</Text>
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
                    <Text style={styles.eyebrow}>{tr("POVCHECK VIP")}</Text>
                    <Text style={styles.heroTitle}>
                        {tr("Unlock the premium side of POVCheck.")}
                    </Text>

                    {currentTier !== "none" && (
                        <View style={styles.currentBadgeRow}>
                            <VipBadge tier={currentTier} />
                            <Text style={styles.currentBadgeText}>
                                {tr("Your current plan")}
                            </Text>
                        </View>
                    )}
                </View>

                {PLANS.map((plan) => {
                    const isCurrent = currentTier === plan.id;
                    const storePlan = storePlans.find((entry) => entry.id === plan.id);
                    const trialDays = storePlan?.trialDays ?? 0;

                    // The store's price in the buyer's currency, when known.
                    const priceText = storePlan?.price ? tr("{0}/month", storePlan.price) : plan.monthly;

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
                                    {priceText}
                                </Text>
                            </View>

                            <Text style={styles.planSubPrice}>
                                {trialDays > 0
                                    ? tr("{0} days free, then monthly", trialDays)
                                    : tr("Monthly subscription")}
                            </Text>

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
                                            {tr(feature)}
                                        </Text>
                                    </View>
                                ))}
                            </View>

                            <Pressable
                                onPress={() => handleUpgradePress(plan.id, plan.name)}
                                disabled={isCurrent || busy !== null}
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
                                    {isCurrent
                                        ? tr("Current plan")
                                        : busy === plan.id
                                            ? tr("One moment…")
                                            : trialDays > 0
                                                ? tr("Start {0} days free", trialDays)
                                                : tr("Subscribe")}
                                </Text>
                            </Pressable>

                            {/* What the buyer agrees to - directly at the button. */}
                            {!isCurrent && storePlan && (
                                <Text style={styles.legal}>
                                    {trialDays > 0
                                        ? tr("Free for {0} days, then {1} per month. Renews automatically every month until you cancel. Cancel any time in Google Play - at least 24 hours before the trial or the current month ends, otherwise the next month is charged.", trialDays, storePlan.price)
                                        : tr("{0} per month. Renews automatically every month until you cancel. Cancel any time in Google Play - at least 24 hours before the current month ends, otherwise the next month is charged.", storePlan.price)}
                                </Text>
                            )}
                        </View>
                    );
                })}

                <Text style={styles.footnote}>
                    {tr("* Creating clans: as long as fewer than 100 clans exist, anyone can create one. After that only Gold/Diamond.")}
                </Text>

                {authId && purchasesAvailable() && (
                    <View style={styles.manageBox}>
                        <Text style={styles.manageText}>
                            {tr("Subscriptions are billed through your Google Play account and renew automatically every month. You can cancel at any time in Google Play; VIP then stays active until the end of the paid period.")}
                        </Text>

                        <View style={styles.manageLinks}>
                            <Pressable onPress={openSubscriptionSettings} hitSlop={8}>
                                <Text style={styles.manageLink}>{tr("Manage or cancel subscription")}</Text>
                            </Pressable>
                            <Pressable onPress={handleRestore} disabled={busy !== null} hitSlop={8}>
                                <Text style={styles.manageLink}>
                                    {busy === "restore" ? tr("One moment…") : tr("Restore purchases")}
                                </Text>
                            </Pressable>
                            <Pressable onPress={() => router.push("/terms")} hitSlop={8}>
                                <Text style={styles.manageLink}>{tr("Terms of Use")}</Text>
                            </Pressable>
                            <Pressable onPress={() => router.push("/privacypolicy")} hitSlop={8}>
                                <Text style={styles.manageLink}>{tr("Privacy Policy")}</Text>
                            </Pressable>
                        </View>
                    </View>
                )}

                {isGuest && (
                    <Text style={styles.guestHint}>
                        {tr("Guest accounts cannot use VIP. Sign in with a real account.")}
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
    legal: { color: "rgba(237,240,243,0.5)", fontSize: 11.5, lineHeight: 16, marginTop: 10 },
    manageBox: {
        borderRadius: 16,
        backgroundColor: "rgba(27,32,39,0.8)",
        borderWidth: 1,
        borderColor: "rgba(237,240,243,0.08)",
        padding: 16,
        marginBottom: 18,
    },
    manageText: { color: "rgba(237,240,243,0.6)", fontSize: 12.5, lineHeight: 18 },
    manageLinks: { flexDirection: "row", flexWrap: "wrap", columnGap: 18, rowGap: 10, marginTop: 12 },
    manageLink: { color: "#7FB3DC", fontSize: 13, fontWeight: "600" },
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