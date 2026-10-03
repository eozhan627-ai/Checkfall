import { useRouter } from "expo-router";
import React from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { tr } from "../lib/i18n";

export default function TermsScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable
                    onPress={() => router.back()}
                    style={({ pressed }) => [
                        styles.backButton,
                        pressed && { opacity: 0.6 },
                    ]}
                >
                    <Text style={styles.backText}>‹</Text>
                </Pressable>

                <View style={styles.headerText}>
                    <Text style={styles.title}>Terms</Text>
                    <Text style={styles.subtitle}>
                        Rules & Fair Play
                    </Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Scope</Text>
                    <Text style={styles.text}>
                        POVCheck is a digital chess platform providing
                        online and offline gameplay, training features,
                        and competitive matchmaking. By using the
                        application, you agree to these Terms.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Accounts</Text>
                    <Text style={styles.text}>
                        Users can create an account using a username and
                        password. You are responsible for your account
                        and all activity under it.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Fair Play</Text>
                    <Text style={styles.text}>
                        The use of chess engines, bots, automation tools,
                        or external assistance during online matches is
                        strictly prohibited. Exploiting bugs or
                        manipulating rankings is not allowed.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{tr("Computer opponents")}</Text>
                    <Text style={styles.text}>
                        {tr("If no suitable human opponent is found in time, you may be paired with a computer opponent that plays at about your rating. It is not marked as such during the game. These games count for your rating and statistics like any other game.")}
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Penalties</Text>
                    <Text style={styles.text}>
                        Violations may result in temporary suspension,
                        permanent ban, or removal of rankings and game
                        history.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{tr("VIP subscription")}</Text>
                    <Text style={styles.text}>
                        {tr("POVCheck VIP is a paid subscription with the plans Silver, Gold and Diamond. The price of each plan is shown in the app before you buy. Payment is handled by the store you use (Google Play or the App Store) and charged to your store account.")}
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{tr("Free trial")}</Text>
                    <Text style={styles.text}>
                        {tr("If a free trial is offered, it is shown before you buy, together with its length. You can cancel during the trial without being charged. If you do not cancel at least 24 hours before the trial ends, the subscription starts automatically and the first month is charged.")}
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{tr("Automatic renewal")}</Text>
                    <Text style={styles.text}>
                        {tr("A VIP subscription runs for one month and renews automatically for another month at the price shown, again and again, until you cancel. The payment for the next month is charged within 24 hours before the current month ends.")}
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{tr("Cancellation")}</Text>
                    <Text style={styles.text}>
                        {tr("You can cancel at any time in your store account (Google Play: Payments and subscriptions > Subscriptions). Cancel at least 24 hours before the current period ends. After cancelling, VIP stays active until the end of the period already paid for; payments already made are not refunded for the remaining time, except where the law or the store's refund rules require it. Deleting the app does not cancel the subscription.")}
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{tr("Changes and your rights")}</Text>
                    <Text style={styles.text}>
                        {tr("If the price of a plan changes, you are informed in advance through the store and can cancel before the new price applies. Your statutory rights as a consumer, including any right of withdrawal, are not affected by these Terms.")}
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Service</Text>
                    <Text style={styles.text}>
                        We do not guarantee uninterrupted access.
                        Features may change or be removed at any time.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Contact</Text>
                    <Text style={styles.text}>
                        checkfall744@gmail.com
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0B0B0B",
    },

    header: {
        paddingTop: 55,
        paddingHorizontal: 16,
        paddingBottom: 10,
        flexDirection: "row",
        alignItems: "center",
    },

    backButton: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.07)",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 13,
    },

    backText: {
        color: "#fff",
        fontSize: 34,
        lineHeight: 34,
        fontWeight: "300",
        marginTop: -2,
    },

    headerText: {
        flex: 1,
    },

    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#fff",
    },

    subtitle: {
        fontSize: 14,
        color: "#aaa",
        marginTop: 4,
    },

    scroll: {
        padding: 16,
        gap: 12,
        paddingBottom: 40,
    },

    card: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },

    cardTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#fff",
        marginBottom: 6,
    },

    text: {
        fontSize: 13,
        color: "#bbb",
        lineHeight: 18,
    },
});