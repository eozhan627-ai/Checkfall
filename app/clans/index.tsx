import React, { useState } from "react";
import {
    ScrollView,
    StyleSheet,
    ImageBackground,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type Clan = {
    id: string;
    name: string;
    members: number;
};

export default function ClansScreen() {
    const [clanName, setClanName] = useState("");
    const backgroundImage = require("../../assets/images/clanbackground.png"); // Hintergrundbild

    // 🔥 MOCK DATA
    const [clans] = useState<Clan[]>([
        {
            id: "1",
            name: "Checkfall Elite",
            members: 12,
        },
        {
            id: "2",
            name: "Knight Legends",
            members: 34,
        },
    ]);

    function createClan() {
        if (!clanName.trim()) return;

        console.log("Clan erstellen:", clanName);

        // später socket/API
        setClanName("");
    }

    return (
            <ImageBackground source={backgroundImage} style={{ flex: 1 }}>
        <ScrollView
            style={styles.container}
            contentContainerStyle={{ padding: 16 }}
        >
            <Text style={styles.title}>Clans</Text>

            <Text style={styles.subtitle}>
                Erstelle einen Clan oder tritt einem bei
            </Text>

            {/* CREATE */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Clan erstellen</Text>

                <TextInput
                    value={clanName}
                    onChangeText={setClanName}
                    placeholder="Clan Name"
                    placeholderTextColor="#888"
                    style={styles.input}
                />

                <TouchableOpacity
                    style={styles.button}
                    onPress={createClan}
                >
                    <Text style={styles.buttonText}>
                        Clan erstellen
                    </Text>
                </TouchableOpacity>
            </View>

            {/* CLAN LIST */}
            <Text style={styles.sectionTitle}>
                Öffentliche Clans
            </Text>

            {clans.map(clan => (
                <View key={clan.id} style={styles.clanCard}>
                    <View>
                        <Text style={styles.clanName}>
                            🏰 {clan.name}
                        </Text>

                        <Text style={styles.memberText}>
                            {clan.members}/50 Mitglieder
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.joinBtn}>
                        <Text style={styles.joinText}>
                            Beitreten
                        </Text>
                    </TouchableOpacity>
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
        fontSize: 28,
        fontWeight: "700",
        color: "#fff",
        marginBottom: 6,
        marginTop: 20,
    },

    subtitle: {
        color: "#aaa",
        fontSize: 14,
        marginBottom: 20,
    },

    sectionTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 12,
    },

    card: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
    },

    input: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: 12,
        color: "#fff",
        marginTop: 8,
    },

    button: {
        marginTop: 14,
        backgroundColor: "#1f2937",
        borderRadius: 12,
        padding: 14,
        alignItems: "center",
    },

    buttonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 15,
    },

    clanCard: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 16,

        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",

        marginBottom: 12,
    },

    clanName: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "600",
    },

    memberText: {
        color: "#aaa",
        marginTop: 4,
    },

    joinBtn: {
        backgroundColor: "#2d3748",
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
    },

    joinText: {
        color: "#fff",
        fontWeight: "600",
    },
});