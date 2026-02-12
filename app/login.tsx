import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getCurrentAccount, saveAccount } from "../lib/account";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const acc = await getCurrentAccount();
            if (acc) {
                router.replace("/"); // Account existiert → direkt Home
            } else {
                setLoading(false); // Login anzeigen
            }
        })();
    }, []);

    const handleCreateAccount = async () => {
        if (!username.trim()) {
            Alert.alert("Fehler", "Bitte gib einen Benutzernamen ein.");
            return;
        }
        await saveAccount({ username, guest: false });
        router.replace("/"); // Startseite
    };

    const handleGuest = async () => {
        await saveAccount({ username: "Gast", guest: true });
        router.replace("/"); // Startseite
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <Text>Lade...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Willkommen bei Checkfall</Text>

            <TextInput
                style={styles.input}
                placeholder="Benutzername"
                value={username}
                onChangeText={setUsername}
            />

            <Pressable style={styles.btn} onPress={handleCreateAccount}>
                <Text style={styles.btnText}>Account erstellen</Text>
            </Pressable>

            <Pressable style={[styles.btn, { backgroundColor: "#555" }]} onPress={handleGuest}>
                <Text style={styles.btnText}>Als Gast spielen</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "#f0f0f0" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    title: { fontSize: 24, fontWeight: "bold", marginBottom: 24, textAlign: "center" },
    input: { borderWidth: 1, borderColor: "#999", width: "100%", padding: 12, borderRadius: 8, marginBottom: 12 },
    btn: { backgroundColor: "#2d7ea4", padding: 12, width: "100%", borderRadius: 8, alignItems: "center", marginBottom: 8 },
    btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});