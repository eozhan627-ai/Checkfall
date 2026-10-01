import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import React from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Item = {
    title: string;
    subtitle: string;
    href: Href;
    accent?: boolean;
};

const ITEMS: Item[] = [
    { title: 'Tutorials', subtitle: 'Fundamentals and strategies', href: '/learn/tutorials' },
    { title: 'Puzzles', subtitle: 'Train tactics and calculation', href: '/learn/puzzles' },
    { title: 'Your Coach', subtitle: 'Personal lessons based on your games', href: '/learn/coach', accent: true },
];

const backgroundImage = require('../../assets/images/loginbackground.png');

export default function LearnScreen() {
    const insets = useSafeAreaInsets();

    return (
        <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
            <View style={styles.overlay} />

            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 24,
                    paddingBottom: insets.bottom + 32,
                    paddingHorizontal: 16,
                }}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>Learn</Text>
                <Text style={styles.subtitle}>Improve step by step</Text>

                <View style={styles.list}>
                    {ITEMS.map((item) => (
                        <Pressable
                            key={item.title}
                            accessibilityRole="button"
                            accessibilityLabel={item.title}
                            onPress={() => router.push(item.href)}
                            style={({ pressed }) => [
                                styles.card,
                                item.accent && styles.cardAccent,
                                pressed && styles.cardPressed,
                            ]}
                        >
                            <View style={styles.cardText}>
                                <Text style={styles.cardTitle}>{item.title}</Text>
                                <Text style={styles.cardSub}>{item.subtitle}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#6B7580" />
                        </Pressable>
                    ))}
                </View>
            </ScrollView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.65)',
    },
    title: {
        fontSize: 30,
        fontWeight: '700',
        color: '#fff',
    },
    subtitle: {
        fontSize: 14,
        color: '#9AA3AD',
        marginTop: 4,
    },
    list: {
        marginTop: 28,
        gap: 10,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1B2027',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#2A313A',
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    cardAccent: {
        borderLeftWidth: 3,
        borderLeftColor: '#7C9473', // Salbeigrün
    },
    cardPressed: {
        backgroundColor: '#232A33',
    },
    cardText: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#F2F4F6',
    },
    cardSub: {
        fontSize: 13,
        color: '#9AA3AD',
        marginTop: 3,
    },
});