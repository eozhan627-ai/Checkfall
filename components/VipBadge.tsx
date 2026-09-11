import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Tier = "silver" | "gold" | "diamond";

type TierStyle = { bg: string; border: string; text: string; label: string };

const TIER_STYLES: Record<Tier, TierStyle> = {
    silver: {
        bg: "rgba(192, 197, 206, 0.12)",
        border: "rgba(192, 197, 206, 0.45)",
        text: "#C0C5CE",
        label: "SILVER",
    },
    gold: {
        bg: "rgba(212, 175, 55, 0.14)",
        border: "rgba(212, 175, 55, 0.5)",
        text: "#D4AF37",
        label: "GOLD",
    },
    diamond: {
        bg: "rgba(168, 224, 236, 0.14)",
        border: "rgba(168, 224, 236, 0.5)",
        text: "#A8E0EC",
        label: "DIAMOND",
    },
};

export default function VipBadge({
    tier = "gold",
    size = "medium",
}: {
    tier?: Tier;
    size?: "small" | "medium";
}) {
    const isSmall = size === "small";
    const palette = TIER_STYLES[tier];

    return (
        <View
            style={[
                styles.badge,
                isSmall && styles.badgeSmall,
                { backgroundColor: palette.bg, borderColor: palette.border },
            ]}
        >
            <Text
                style={[
                    styles.text,
                    isSmall && styles.textSmall,
                    { color: palette.text },
                ]}
            >
                {palette.label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
        alignSelf: "flex-start",
    },
    badgeSmall: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    text: {
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.6,
    },
    textSmall: {
        fontSize: 9,
    },
});