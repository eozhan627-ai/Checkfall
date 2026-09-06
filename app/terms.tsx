import { useRouter } from "expo-router";
import React from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

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
                    <Text style={styles.cardTitle}>Penalties</Text>
                    <Text style={styles.text}>
                        Violations may result in temporary suspension,
                        permanent ban, or removal of rankings and game
                        history.
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