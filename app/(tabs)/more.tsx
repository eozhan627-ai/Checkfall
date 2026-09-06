import { router } from 'expo-router';
import React from 'react';
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function MoreScreen() {
    const backgroundImage = require('../../assets/images/loginbackground.png');

    return (
        <ImageBackground
            source={backgroundImage}
            style={styles.container}
            resizeMode="cover"
        >
            <View style={styles.overlay} />

            {/* HEADER */}
            <View style={styles.header}>
                <Text style={styles.title}>More</Text>
                <Text style={styles.subtitle}>Settings & Information</Text>
            </View>

            {/* CARDS */}
            <View style={styles.lists}>

                <TouchableOpacity
                    style={styles.card}
                    onPress={() => router.push('/profile')}
                >
                    <Text style={styles.cardTitle}>👤 Profile</Text>
                    <Text style={styles.cardSub}>Edit account & avatar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.card}
                    onPress={() => router.push('/settings/Help')}
                >
                    <Text style={styles.cardTitle}>❓ Help</Text>
                    <Text style={styles.cardSub}>FAQ & support</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.card}
                    onPress={() => router.push('/terms')}
                >
                    <Text style={styles.cardTitle}>📄 Legal</Text>
                    <Text style={styles.cardSub}>Terms of Use</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.card}
                    onPress={() => router.push('/privacypolicy')}
                >
                    <Text style={styles.cardTitle}>📄 Privacy Policy</Text>
                    <Text style={styles.cardSub}>Data protection information</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.card}
                    onPress={() => router.push('/settings/Impressum')}
                >
                    <Text style={styles.cardTitle}>About us </Text>
                    <Text style={styles.cardSub}>Imprint & company info</Text>
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
        paddingTop: 60,
        paddingHorizontal: 16,
        marginBottom: 20,
    },

    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#fff",
    },

    subtitle: {
        fontSize: 14,
        color: "#ccc",
        marginTop: 4,
    },

    lists: {
        paddingHorizontal: 16,
        gap: 12,
    },

    card: {
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
    },

    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },

    cardSub: {
        fontSize: 12,
        color: '#aaa',
        marginTop: 4,
    },
});