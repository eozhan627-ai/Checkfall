import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
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

    // Animations
    const appear = useRef(new Animated.Value(0)).current;
    const float = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        (async () => {
            const acc = await getCurrentAccount();
            if (acc) router.replace("/");
            else setLoading(false);
        })();
    }, []);

    useEffect(() => {
        // entrance animation
        Animated.timing(appear, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
        }).start(() => {
            // floating loop AFTER appear
            Animated.loop(
                Animated.sequence([
                    Animated.timing(float, {
                        toValue: 1,
                        duration: 2200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(float, {
                        toValue: 0,
                        duration: 2200,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        });
    }, []);

    async function handleCreateAccount() {
        if (!username.trim()) {
            Alert.alert("Error", "Enter username");
            return;
        }

        await saveAccount({ username, guest: false });
        router.replace("/");
    }

    async function handleGuest() {
        await saveAccount({ username: "Guest", guest: true });
        router.replace("/");
    }

    if (loading) {
        return (
            <View style={styles.loading}>
                <Text style={{ color: "#fff" }}>Loading...</Text>
            </View>
        );
    }

    const translateY = float.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -6], // VERY subtle float
    });

    const scale = appear.interpolate({
        inputRange: [0, 1],
        outputRange: [0.96, 1],
    });

    const opacity = appear;

    return (
        <ImageBackground source={backgroundImage} style={styles.bg}>
            <View style={styles.overlay} />

            <View style={styles.root}>
                <View style={styles.right}>
                    <Animated.View
                        style={{
                            transform: [{ translateY }, { scale }],
                            opacity,
                            width: "100%",
                            alignItems: "center",
                        }}
                    >
                        <BlurView intensity={35} tint="dark" style={styles.card}>
                            <Text style={styles.title}>
                                Welcome to Checkfall
                            </Text>

                            <Text style={styles.subtitle}>
                                Play. Learn. Improve.
                            </Text>

                            <TextInput
                                style={styles.input}
                                placeholder="Create a username"
                                placeholderTextColor="#888"
                                value={username}
                                onChangeText={setUsername}
                            />

                            <Pressable
                                style={styles.primary}
                                onPress={handleCreateAccount}
                            >
                                <Text style={styles.primaryText}>
                                    Create Account
                                </Text>
                            </Pressable>

                            <Pressable
                                style={styles.secondary}
                                onPress={handleGuest}
                            >
                                <Text style={styles.secondaryText}>
                                    Continue as guest
                                </Text>
                            </Pressable>
                        </BlurView>
                    </Animated.View>
                </View>
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    bg: {
        flex: 1,
        width: "100%",
        height: "100%",
    },

    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.55)",
    },

    root: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },

    right: {
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
    },

    card: {
        width: "90%",
        maxWidth: 380,
        borderRadius: 20,
        padding: 24,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },

    title: {
        fontSize: 24,
        fontWeight: "800",
        color: "#fff",
        textAlign: "center",
    },

    subtitle: {
        fontSize: 14,
        color: "#ccc",
        textAlign: "center",
        marginBottom: 20,
    },

    input: {
        backgroundColor: "rgba(255,255,255,0.06)",
        padding: 14,
        borderRadius: 12,
        color: "#fff",
        marginBottom: 14,
    },

    primary: {
        backgroundColor: "#d4af37",
        padding: 14,
        borderRadius: 12,
        alignItems: "center",
        marginBottom: 10,
    },

    primaryText: {
        fontWeight: "700",
        color: "#111",
    },

    secondary: {
        backgroundColor: "rgba(255,255,255,0.08)",
        padding: 14,
        borderRadius: 12,
        alignItems: "center",
    },

    secondaryText: {
        color: "#fff",
        fontWeight: "600",
    },

    loading: {
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
    },
});