import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { AccountType, getCurrentAccount, updateAccount } from "../lib/account";

export default function Profile() {
    const [account, setAccount] = useState<AccountType | null>(null);
    const [username, setUsername] = useState("");
    const [editingName, setEditingName] = useState(false);
    const [loading, setLoading] = useState(true);

    const placeholder = require("../assets/images/knight_black.png");

    const params = useLocalSearchParams();
    const externalName = params.name as string | undefined;
    const externalAvatar = params.avatar as string | undefined;
    const externalUserId = params.userId as string | undefined;

    const isForeignProfile = !!externalUserId;

    useEffect(() => {
        if (isForeignProfile) {
            setLoading(false);
            return;
        }

        (async () => {
            const acc = await getCurrentAccount();
            if (acc) {
                setAccount(acc);
                setUsername(acc.username);
            }
            setLoading(false);
        })();
    }, [isForeignProfile]);

    // =============================
    // Avatar ändern (nur eigenes Profil)
    const changeAvatar = async () => {
        if (!account) return;

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Berechtigung benötigt", "Bitte erlaube den Zugriff auf die Galerie.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            const fileExt = uri.split(".").pop(); // png oder jpeg

            const formData = new FormData();
            formData.append("avatar", {
                uri,
                type: `image/${fileExt === "jpg" ? "jpeg" : fileExt}`,
                name: `avatar.${fileExt}`,
            } as any);
            formData.append("userId", account.id);

            try {
                const res = await fetch("http://192.168.178.26:3000/upload-avatar", {
                    method: "POST",
                    body: formData,
                    headers: { "Content-Type": "multipart/form-data" },
                });

                const data = await res.json();
                console.log("NEUER AVATAR:", data.url);
                const updated = await updateAccount(account.id, { avatar: data.url });
                if (updated) {
                    console.log("ACCOUNT nach updateAccount:", updated.avatar);
                    setAccount(updated);
                } else {
                    console.log("updateAccount hat null zurückgegeben!");
                }
                setAccount(updated);

            } catch (err) {
                console.log("Upload Fehler:", err);
            }
        }
    };

    // =============================
    // Username speichern
    const saveUsername = async () => {
        if (!username.trim() || !account) return;
        const updated = await updateAccount(account.id, { username });
        setAccount(updated);
        setEditingName(false);
        Alert.alert("Gespeichert");
    };

    if (loading) return <View style={styles.center}><Text>Lade Profil...</Text></View>;

    if (!isForeignProfile && !account)
        return <View style={styles.center}><Text>Kein Account gefunden</Text></View>;

    // =============================
    // Entscheide welches Avatar angezeigt wird
    const displayedAvatar = isForeignProfile
        ? externalAvatar
            ? `${externalAvatar}?t=${Date.now()}` // Cache umgehen
            : null
        : account?.avatar
            ? `${account.avatar}?t=${Date.now()}`
            : null;

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={!isForeignProfile ? changeAvatar : undefined}>
                <Image
                    source={displayedAvatar ? { uri: displayedAvatar } : placeholder}
                    style={styles.avatar}
                    resizeMode="contain"
                />
            </TouchableOpacity>

            <View style={styles.nameContainer}>
                {isForeignProfile ? (
                    <Text style={styles.username}>{externalName}</Text>
                ) : editingName ? (
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