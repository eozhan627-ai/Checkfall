import { router } from "expo-router";
import React from "react";
import {
    ImageBackground,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function LearnScreen() {
    const backgroundImage = require("../../assets/images/loginbackground.png");

    return (
        <ImageBackground
            source={backgroundImage}
            style={styles.container}
            resizeMode="cover"
        >
            <View style={styles.overlay} />

            <View style={styles.header}>
                <Text style={styles.title}>Learn</Text>
                <Text style={styles.subtitle}>
                    Improve step by step
                </Text>
            </View>

            <View style={styles.lists}>
                <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.card}
                    onPress={() => router.push("/learn/tutorials")}
                >
                    <Text style={styles.cardTitle}>Tutorials</Text>
                    <Text style={styles.cardSub}>
                        Learn fundamentals & strategies
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.card}
                    onPress={() => router.push("/learn/puzzles")}
                >
                    <Text style={styles.cardTitle}>Puzzles</Text>
                    <Text style={styles.cardSub}>
                        Train tactics & calculation
                    </Text>
                </TouchableOpacity>
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.55)",
    },

    header: {
        marginTop: 70,
        paddingHorizontal: 20,
    },

    title: {
        fontSize: 34,
        fontWeight: "800",
        color: "#fff",
    },

    subtitle: {
        fontSize: 14,
        color: "#ccc",
        marginTop: 6,
    },

    lists: {
        paddingHorizontal: 16,
        marginTop: 30,
    },

    card: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 18,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
    },

    cardTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#fff",
    },

    cardSub: {
        fontSize: 13,
        color: "#ccc",
        marginTop: 6,
    },
});