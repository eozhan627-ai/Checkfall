import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { AccountType, getCurrentAccount, updateAccount } from "../lib/account";

export default function Profile() {
    const [account, setAccount] = useState<AccountType | null>(null);
    const [username, setUsername] = useState("");
    const [editingName, setEditingName] = useState(false);
    const [loading, setLoading] = useState(true);
    const placeholder = require("../assets/images/knight_black.png"); // Dein Platzhalter-Avatar

    // Account laden
    useEffect(() => {
        (async () => {
            const acc = await getCurrentAccount();
            if (acc) {
                setAccount(acc);
                setUsername(acc.username);
            }
            setLoading(false);
        })();
    }, []);

    // Avatar ändern
    const changeAvatar = async () => {
        // Berechtigung prüfen
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Berechtigung benötigt", "Bitte erlaube den Zugriff auf die Galerie.");
            return;
        }

        // Bild auswählen
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,   // Zuschneiden erlauben
            aspect: [1, 1],        // quadratisch
            quality: 0.8,
        });

        if (!result.canceled && account) {
            const uri = result.assets[0].uri;
            // Account updaten
            const updated = await updateAccount(account.id, { avatar: uri });
            setAccount(updated);
        }
    };

    // Username speichern
    const saveUsername = async () => {
        if (!username.trim() || !account) return;
        const updated = await updateAccount(account.id, { username });
        setAccount(updated);
        setEditingName(false);
        Alert.alert("Gespeichert");
    };

    if (loading) return <View style={styles.center}><Text>Lade Profil...</Text></View>;
    if (!account) return <View style={styles.center}><Text>Kein Account gefunden</Text></View>;

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={changeAvatar}>
                <Image
                    source={account.avatar ? { uri: account.avatar } : placeholder}
                    style={styles.avatar}
                />
            </TouchableOpacity>

            <View style={styles.nameContainer}>
                {editingName ? (
                    <>
                        <TextInput
                            style={styles.input}
                            value={username}
                            onChangeText={setUsername}
                            autoFocus
                        />
                        <TouchableOpacity onPress={saveUsername} style={styles.saveBtn}>
                            <Text style={styles.saveText}>✔</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <TouchableOpacity onPress={() => setEditingName(true)}>
                        <Text style={styles.username}>{username} ✏️</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    avatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 20, backgroundColor: "#ddd" },
    nameContainer: { flexDirection: "row", alignItems: "center" },
    username: { fontSize: 22, fontWeight: "bold" },
    input: { borderBottomWidth: 1, borderColor: "#888", fontSize: 22, minWidth: 120 },
    saveBtn: { marginLeft: 10 },
    saveText: { fontSize: 22, color: "#2d7ea4" },
});