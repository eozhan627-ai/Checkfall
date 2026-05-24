import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    ImageBackground,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { getCurrentAccount, saveAccount } from "../../lib/account";

export default function LoginPage() {
    const router = useRouter();

    const [username, setUsername] = useState("");
    const [loading, setLoading] = useState(true);

    const backgroundImage = require("../../assets/images/loginbackground.png");

    useEffect(() => {
        (async () => {
            const acc = await getCurrentAccount();

            if (acc) {
                router.replace("/");
            } else {
                setLoading(false);
            }
        })();
    }, []);

    async function handleCreateAccount() {
        if (!username.trim()) {
            Alert.alert(
                "Fehler",
                "Bitte gib einen Benutzernamen ein."
            );
            return;
        }

        await saveAccount({
            username,
            guest: false,
        });

        router.replace("/");
    }

    async function handleGuest() {
        await saveAccount({
            username: "Gast",
            guest: true,
        });

        router.replace("/");
    }

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>
                    Lade...
                </Text>
            </View>
        );
    }

    return (
        <ImageBackground
            source={backgroundImage}
            style={styles.container}
            resizeMode="cover"
        >
            <View style={styles.overlay} />

            <View style={styles.card}>
                <Text style={styles.logo}>
                    Willkommen bei Checkfall
                </Text>

                <Text style={styles.subtitle}>
                    Play. Learn. Improve.
                </Text>

                <TextInput
                    style={styles.input}
                    placeholder="Benutzername"
                    placeholderTextColor="#999"
                    value={username}
                    onChangeText={setUsername}
                />

                <Pressable
                    style={styles.primaryButton}
                    onPress={handleCreateAccount}
                >
                    <Text style={styles.primaryButtonText}>
                        Account erstellen
                    </Text>
                </Pressable>

                <Pressable
                    style={styles.secondaryButton}
                    onPress={handleGuest}
                >
                    <Text style={styles.secondaryButtonText}>
                        Als Gast spielen
                    </Text>
                </Pressable>
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },

    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.45)",
    },

    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0d0d0d",
    },

    loadingText: {
        color: "#fff",
        fontSize: 18,
    },

    card: {
        width: "88%",
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 24,

        padding: 24,

        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
    },

    logo: {
        fontSize: 34,
        fontWeight: "700",
        color: "#fff",
        textAlign: "center",
    },

    subtitle: {
        fontSize: 15,
        color: "#d4d4d4",
        textAlign: "center",
        marginTop: 6,
        marginBottom: 28,
    },

    input: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 14,

        paddingHorizontal: 16,
        paddingVertical: 14,

        color: "#fff",
        fontSize: 16,

        marginBottom: 16,

        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },

    primaryButton: {
        backgroundColor: "#d4af37",

        paddingVertical: 15,
        borderRadius: 14,

        alignItems: "center",

        marginBottom: 12,
    },

    primaryButtonText: {
        color: "#111",
        fontWeight: "700",
        fontSize: 16,
    },

    secondaryButton: {
        backgroundColor: "rgba(255,255,255,0.08)",

        paddingVertical: 15,
        borderRadius: 14,

        alignItems: "center",
    },

    secondaryButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 15,
    },
});