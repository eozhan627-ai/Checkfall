import { useRouter } from "expo-router";
import React from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

export default function PrivacyScreen() {
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
                    <Text style={styles.title}>Privacy</Text>
                    <Text style={styles.subtitle}>
                        Data & Security
                    </Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Controller</Text>
                    <Text style={styles.text}>
                        Enes Kazim Özhan{"\n"}
                        POVCheck{"\n"}
                        checkfall744@gmail.com
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>
                        Data We Collect
                    </Text>
                    <Text style={styles.text}>
                        We collect account data such as username, avatar,
                        match history, and gameplay-related information
                        required to operate online features.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>
                        Online Gameplay
                    </Text>
                    <Text style={styles.text}>
                        When using online features, game data (moves,
                        results, session info) is transmitted to servers
                        to enable multiplayer functionality.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Storage</Text>
                    <Text style={styles.text}>
                        Data may be stored locally on the device and on
                        servers required for online gameplay and account
                        synchronization.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Purpose</Text>
                    <Text style={styles.text}>
                        Data is used to provide gameplay, matchmaking,
                        statistics, account management, and fair play
                        enforcement.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Sharing</Text>
                    <Text style={styles.text}>
                        We do not sell personal data. Data is only shared
                        with infrastructure providers necessary to
                        operate service.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Rights</Text>
                    <Text style={styles.text}>
                        Users may request access, correction, or deletion
                        of their data by contacting support.
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