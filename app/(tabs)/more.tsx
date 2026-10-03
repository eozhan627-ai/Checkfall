import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import React, { useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import ImageBackground from '../../components/ui/ImageBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LANGUAGES, setLanguage, tr, useLanguage } from "../../lib/i18n";
import { isSoundEnabled, playSound, setSoundEnabled } from "../../lib/sounds";

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
        get label() { return tr("Account"); },
        items: [
            { get title() { return tr("Profile"); }, get subtitle() { return tr("Edit account and avatar"); }, href: '/profile' },
            { get title() { return tr("Shop"); }, get subtitle() { return tr("Board designs for your coins"); }, href: '/shop' as Href },
            { get title() { return tr("Help"); }, get subtitle() { return tr("Questions and answers"); }, href: '/settings/Help' },
            { get title() { return tr("Support"); }, get subtitle() { return tr("Report a problem or ask a question"); }, href: '/support' as Href },
        ],
    },
    {
        get label() { return tr("Information"); },
        items: [
            { get title() { return tr("Terms of Use"); }, get subtitle() { return tr("Legal"); }, href: '/terms' },
            { get title() { return tr("Privacy Policy"); }, get subtitle() { return tr("Data protection information"); }, href: '/privacypolicy' },
            { get title() { return tr("Imprint"); }, get subtitle() { return tr("Company information"); }, href: '/settings/Impressum' },
        ],
    },
];

const backgroundImage = require('../../assets/images/loginbackground.jpg');

export default function MoreScreen() {
    const insets = useSafeAreaInsets();
    const language = useLanguage();
    const [sounds, setSounds] = useState(isSoundEnabled());

    const chooseSounds = (value: boolean) => {
        setSounds(value);
        setSoundEnabled(value).then(() => {
            // Lets the player hear what they just switched on.
            if (value) playSound("move");
        });
    };

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
                <Text style={styles.title}>{tr("More")}</Text>

                {/* LANGUAGE */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>{tr("Language")}</Text>

                    <View style={styles.languageRow}>
                        {LANGUAGES.map((entry) => {
                            const active = entry.code === language;

                            return (
                                <Pressable
                                    key={entry.code}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: active }}
                                    onPress={() => setLanguage(entry.code)}
                                    style={({ pressed }) => [
                                        styles.languageOption,
                                        active && styles.languageActive,
                                        pressed && styles.rowPressed,
                                    ]}
                                >
                                    <Text style={[styles.languageText, active && styles.languageTextActive]}>
                                        {entry.name}
                                    </Text>
                                    {active && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {/* SOUNDS */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>{tr("Sounds")}</Text>

                    <View style={styles.languageRow}>
                        {[true, false].map((value) => {
                            const active = value === sounds;

                            return (
                                <Pressable
                                    key={String(value)}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: active }}
                                    onPress={() => chooseSounds(value)}
                                    style={({ pressed }) => [
                                        styles.languageOption,
                                        active && styles.languageActive,
                                        pressed && styles.rowPressed,
                                    ]}
                                >
                                    <Ionicons
                                        name={value ? "volume-high-outline" : "volume-mute-outline"}
                                        size={16}
                                        color={active ? "#FFFFFF" : "rgba(255,255,255,0.7)"}
                                    />
                                    <Text style={[styles.languageText, active && styles.languageTextActive]}>
                                        {value ? tr("On") : tr("Off")}
                                    </Text>
                                    {active && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

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
    languageRow: { flexDirection: 'row', gap: 10 },
    languageOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    languageActive: { backgroundColor: 'rgba(91,141,184,0.22)', borderColor: '#5B8DB8' },
    languageText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600' },
    languageTextActive: { color: '#fff' },
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