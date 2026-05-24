import { useRouter } from "expo-router";
import React from "react";
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

export default function SocialScreen() {
    const router = useRouter();
    const backgroundImage = require("../../../assets/images/clanbackground.png"); // Hintergrundbild

    return (
        <ImageBackground source={backgroundImage} style={styles.container}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>

                <Text style={styles.title}>Social</Text>
                <Text style={styles.subtitle}>
                    Freunde, Clans und soziale Features
                </Text>

                {/* FRIENDS */}
                <TouchableOpacity
                    style={styles.card}
                    onPress={() => router.push("/friends")}
                >
                    <Text style={styles.cardTitle}>👥 Freunde</Text>
                    <Text style={styles.cardSub}>Anfragen & Freundesliste</Text>
                </TouchableOpacity>

                {/* CLANS */}
                <TouchableOpacity
                    style={styles.card}
                    onPress={() => router.push("/clans")}
                >
                    <Text style={styles.cardTitle}>🏰 Clans</Text>
                    <Text style={styles.cardSub}>Tritt einem Clan bei oder erstelle einen</Text>
                </TouchableOpacity>

                {/* FUTURE FEATURE */}
                <TouchableOpacity
                    style={styles.card}
                    onPress={() => console.log("later")}
                >
                    <Text style={styles.cardTitle}>💬 Nachrichten</Text>
                    <Text style={styles.cardSub}>Coming soon</Text>
                </TouchableOpacity>

            </ScrollView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0d0d0d",
    },

    title: {
        fontSize: 26,
        fontWeight: "700",
        color: "#fff",
        marginBottom: 6,
        marginTop: 20,
    },

    subtitle: {
        fontSize: 14,
        color: "#aaa",
        marginBottom: 20,
    },

    card: {
        backgroundColor: "rgba(255,255,255,0.08)",
        padding: 16,
        borderRadius: 14,
        marginBottom: 12,
    },

    cardTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#fff",
    },

    cardSub: {
        fontSize: 13,
        color: "#aaa",
        marginTop: 4,
    },
});