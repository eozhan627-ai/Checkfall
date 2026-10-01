import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import React from 'react';
import {
    ImageBackground,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Item = {
    title: string;
    subtitle: string;
    href: Href;
};

type Section = {
    label: string;
    items: Item[];
};

const SECTIONS: Section[] = [
    {
        label: 'Account',
        items: [
            { title: 'Profile', subtitle: 'Edit account and avatar', href: '/profile' },
            { title: 'Help', subtitle: 'FAQ and support', href: '/settings/Help' },
        ],
    },
    {
        label: 'Information',
        items: [
            { title: 'Terms of Use', subtitle: 'Legal', href: '/terms' },
            { title: 'Privacy Policy', subtitle: 'Data protection information', href: '/privacypolicy' },
            { title: 'Imprint', subtitle: 'Company information', href: '/settings/Impressum' },
        ],
    },
];

const backgroundImage = require('../../assets/images/loginbackground.png');

export default function MoreScreen() {
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
                <Text style={styles.title}>More</Text>

                {SECTIONS.map((section) => (
                    <View key={section.label} style={styles.section}>
                        <Text style={styles.sectionLabel}>{section.label}</Text>

                        <View style={styles.group}>
                            {section.items.map((item, index) => (
                                <Pressable
                                    key={item.title}
                                    accessibilityRole="button"
                                    accessibilityLabel={item.title}
                                    onPress={() => router.push(item.href)}
                                    style={({ pressed }) => [
                                        styles.row,
                                        index > 0 && styles.rowDivider,
                                        pressed && styles.rowPressed,
                                    ]}
                                >
                                    <View style={styles.rowText}>
                                        <Text style={styles.rowTitle}>{item.title}</Text>
                                        <Text style={styles.rowSub}>{item.subtitle}</Text>
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={18}
                                        color="rgba(255,255,255,0.4)"
                                    />
                                </Pressable>
                            ))}
                        </View>
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
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    title: {
        fontSize: 30,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 24,
    },
    section: {
        marginBottom: 24,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 8,
        marginLeft: 4,
    },
    group: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    rowDivider: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.15)',
    },
    rowPressed: {
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    rowText: {
        flex: 1,
    },
    rowTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    rowSub: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.55)',
        marginTop: 2,
    },
});