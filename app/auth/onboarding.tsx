import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { saveAccount } from "../../lib/account";
import { supabase } from "../../lib/supabase";
export default function OnboardingPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const [error, setError] = useState("");
    // Prüfen, ob überhaupt ein Google/Supabase-User eingeloggt ist
    useEffect(() => {
        checkUser();
    }, []);
    async function checkUser() {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                console.log("ONBOARDING: NO SUPABASE USER");
                setError("No Supabase user found.");
                setChecking(false);
                return;
            }

            console.log(
                "ONBOARDING: USER FOUND",
                user.id,
                user.email
            );

            setChecking(false);
        } catch (e) {
            console.error("ONBOARDING USER CHECK:", e);
            router.replace("/auth/login");
        }
    }
    async function handleContinue() {
        const name = username.trim();
        setError("");
        if (!name) {
            setError("Please choose a username.");
            return;
        }
        if (name.length < 3) {
            setError("Username must be at least 3 characters.");
            return;
        }
        if (name.length > 20) {
            setError("Username can be maximum 20 characters.");
            return;
        }
        // Nur Buchstaben, Zahlen und _
        if (!/^[a-zA-Z0-9_]+$/.test(name)) {
            setError(
                "Only letters, numbers and underscores are allowed."
            );
            return;
        }
        setLoading(true);
        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();
            if (userError) {
                throw userError;
            }
            if (!user) {
                throw new Error("You are not signed in.");
            }
            /*
             * Username global prüfen.
             *
             * Wir suchen case-insensitiv:
             * "Max" und "max" sollen NICHT beide erlaubt sein.
             */
            const { data: existingProfile, error: checkError } =
                await supabase
                    .from("profiles")
                    .select("id, username")
                    .ilike("username", name)
                    .maybeSingle();
            if (checkError) {
                throw checkError;
            }
            if (existingProfile) {
                setError("This username is already taken.");
                setLoading(false);
                return;
            }
            // Profil in Supabase erstellen
            const { error: profileError } = await supabase
                .from("profiles")
                .insert({
                    id: user.id,
                    username: name,
                    rating: 1000,
                });
            if (profileError) {
                // Falls zwei Geräte gleichzeitig denselben Namen
                // versuchen, schützt trotzdem der UNIQUE Constraint.
                if (profileError.code === "23505") {
                    setError("This username is already taken.");
                    setLoading(false);
                    return;
                }
                throw profileError;
            }
            // Lokales Profil für die bestehende App speichern
            await saveAccount({
                username: name,
                guest: false,
                authId: user.id,
            });
            // Fertig mit dem Usernamen → jetzt noch Skill-Level
            // abfragen, bevor es auf die Startseite geht.
            // (rating:1000 oben ist nur der Platzhalter, bis
            // skillLevel.tsx ihn überschreibt.)
            router.replace("/auth/skillLevel");
        } catch (e: any) {
            console.error("ONBOARDING ERROR:", e);
            setError(
                e?.message ||
                "Something went wrong. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }
    if (checking) {
        return (
            <View style={styles.loadingScreen}>
                <ActivityIndicator size="small" color="#D4AF37" />
            </View>
        );
    }
    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={
                Platform.OS === "ios"
                    ? "padding"
                    : undefined
            }
        >
            <View style={styles.card}>
                <Text style={styles.logo}>
                    POV<Text style={styles.gold}>Check</Text>
                </Text>
                <Text style={styles.step}>
                    STEP 2 OF 3
                </Text>
                <Text style={styles.title}>
                    Choose your username
                </Text>
                <Text style={styles.subtitle}>
                    This is the name other players will see
                    across POVCheck.
                </Text>
                <TextInput
                    style={[
                        styles.input,
                        error && styles.inputError,
                    ]}
                    value={username}
                    onChangeText={(text) => {
                        setUsername(text);
                        setError("");
                    }}
                    placeholder="Username"
                    placeholderTextColor="#666"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={20}
                    editable={!loading}
                />
                <Text style={styles.counter}>
                    {username.length}/20
                </Text>
                {error ? (
                    <Text style={styles.error}>
                        {error}
                    </Text>
                ) : null}
                <Pressable
                    style={[
                        styles.button,
                        loading && styles.disabled,
                    ]}
                    onPress={handleContinue}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#111" />
                    ) : (
                        <Text style={styles.buttonText}>
                            Continue
                        </Text>
                    )}
                </Pressable>
                <Text style={styles.info}>
                    Your username must be unique.
                </Text>
            </View>
        </KeyboardAvoidingView>
    );
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#080808",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 20,
    },
    loadingScreen: {
        flex: 1,
        backgroundColor: "#080808",
        justifyContent: "center",
        alignItems: "center",
    },
    card: {
        width: "100%",
        maxWidth: 380,
        backgroundColor: "#111",
        borderRadius: 22,
        paddingHorizontal: 28,
        paddingVertical: 32,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
    },
    logo: {
        fontSize: 30,
        fontWeight: "900",
        color: "#fff",
        textAlign: "center",
        marginBottom: 24,
    },
    gold: {
        color: "#D4AF37",
    },
    step: {
        color: "#D4AF37",
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 1.5,
        textAlign: "center",
        marginBottom: 8,
    },
    title: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "800",
        textAlign: "center",
    },
    subtitle: {
        color: "#888",
        fontSize: 14,
        lineHeight: 20,
        textAlign: "center",
        marginTop: 8,
        marginBottom: 25,
    },
    input: {
        height: 54,
        backgroundColor: "#191919",
        borderRadius: 13,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        paddingHorizontal: 16,
        color: "#fff",
        fontSize: 15,
    },
    inputError: {
        borderColor: "#ff5b5b",
    },
    counter: {
        color: "#555",
        fontSize: 11,
        textAlign: "right",
        marginTop: 5,
    },
    error: {
        color: "#ff5b5b",
        fontSize: 12,
        textAlign: "center",
        marginTop: 10,
        lineHeight: 17,
    },
    button: {
        height: 54,
        backgroundColor: "#D4AF37",
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 18,
    },
    buttonText: {
        color: "#111",
        fontSize: 15,
        fontWeight: "800",
    },
    disabled: {
        opacity: 0.6,
    },
    info: {
        color: "#555",
        fontSize: 10,
        textAlign: "center",
        marginTop: 16,
    },
});