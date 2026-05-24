import React, { useState } from "react";
import {
    ImageBackground,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";

type Friend = {
    id: string;
    name: string;
    online: boolean;
};

type Request = {
    id: string;
    name: string;
};

export default function FriendsScreen() {
    const [search, setSearch] = useState("");
    const backgroundImage = require("../../assets/images/socialbackground.png"); // Hintergrundbild

    // 🔥 MOCK DATA (später ersetzt durch Server)
    const [friends, setFriends] = useState<Friend[]>([
        { id: "1", name: "€liT€_Suchti", online: true },
        { id: "2", name: "Asyl", online: false },
    ]);

    const [requests, setRequests] = useState<Request[]>([
        { id: "10", name: "SchachKing99" },
    ]);

    function acceptRequest(id: string) {
        const req = requests.find(r => r.id === id);
        if (!req) return;

        setFriends(prev => [
            ...prev,
            { id: req.id, name: req.name, online: false },
        ]);

        setRequests(prev => prev.filter(r => r.id !== id));
    }

    function declineRequest(id: string) {
        setRequests(prev => prev.filter(r => r.id !== id));
    }

    function addFriend() {
        if (!search.trim()) return;

        // fake add (später API call)
        setRequests(prev => [
            ...prev,
            { id: Date.now().toString(), name: search },
        ]);

        setSearch("");
    }

    return (
        <ImageBackground source={backgroundImage} style={{ flex: 1 }}>
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>

            {/* TITLE */}
            <Text style={styles.title}>Freunde</Text>

            {/* SEARCH */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Freund hinzufügen</Text>

                <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Username"
                    placeholderTextColor="#aaa"
                    style={styles.input}
                />

                <Pressable style={styles.button} onPress={addFriend}>
                    <Text style={styles.buttonText}>Anfrage senden</Text>
                </Pressable>
            </View>

            {/* REQUESTS */}
            <Text style={styles.sectionTitle}>Anfragen</Text>

            {requests.map(r => (
                <View key={r.id} style={styles.cardRow}>
                    <Text style={styles.name}>{r.name}</Text>

                    <View style={{ flexDirection: "row", gap: 10 }}>
                        <Pressable onPress={() => acceptRequest(r.id)}>
                            <Text style={styles.accept}>✔</Text>
                        </Pressable>

                        <Pressable onPress={() => declineRequest(r.id)}>
                            <Text style={styles.decline}>✖</Text>
                        </Pressable>
                    </View>
                </View>
            ))}

            {/* FRIENDS */}
            <Text style={styles.sectionTitle}>Freunde</Text>

            {friends.map(f => (
                <View key={f.id} style={styles.cardRow}>
                    <View>
                        <Text style={styles.name}>{f.name}</Text>
                        <Text style={styles.status}>
                            {f.online ? "🟢 Online " : "⚪ Offline "}
                        </Text>
                    </View>

                    <Text style={{ fontSize: 20 }}>💬</Text>
                </View>
            ))}
        </ScrollView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,

    },

    title: {
        fontSize: 26,
        fontWeight: "700",
        color: "#fff",
        marginBottom: 20,
        marginTop: 20,
    },

    sectionTitle: {
        fontSize: 16,
        color: "#d4d4d4",
        marginTop: 20,
        marginBottom: 10,
    },

    card: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 16,
    },

    cardRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",

        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 16,
        marginBottom: 10,
    },

    name: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },

    status: {
        color: "#d4d4d4",
        marginTop: 4,
    },

    input: {
        backgroundColor: "rgba(255,255,255,0.12)",
        borderRadius: 10,
        padding: 10,
        color: "#fff",
        marginTop: 10,
    },

    button: {
        marginTop: 10,
        backgroundColor: "#1f2937",
        padding: 12,
        borderRadius: 10,
        alignItems: "center",
    },

    buttonText: {
        color: "#fff",
        fontWeight: "600",
    },

    accept: {
        fontSize: 22,
        color: "#22c55e",
    },

    decline: {
        fontSize: 22,
        color: "#ef4444",
    },
});