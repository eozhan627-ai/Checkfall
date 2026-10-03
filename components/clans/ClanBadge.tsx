import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CLAN_BADGES, LEAGUE_COLORS } from "../../lib/clans";

type BadgeProps = { badge: string; color: string; size?: number };

// The clan's emblem: a symbol on a tinted, rounded tile.
export default function ClanBadge({ badge, color, size = 52 }: BadgeProps) {
    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size * 0.3,
                backgroundColor: `${color}2B`,
                borderWidth: 1.5,
                borderColor: `${color}B3`,
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Text style={{ fontSize: size * 0.54, lineHeight: size * 0.7, color }} allowFontScaling={false}>
                {CLAN_BADGES[badge] ?? CLAN_BADGES.knight}
            </Text>
        </View>
    );
}

export function LeaguePill({ league, small = false }: { league: string; small?: boolean }) {
    const color = LEAGUE_COLORS[league] ?? "#B8C0CC";

    return (
        <View style={[styles.pill, { backgroundColor: `${color}26`, borderColor: `${color}80` }, small && styles.pillSmall]}>
            <View style={[styles.pillDot, { backgroundColor: color }]} />
            <Text style={[styles.pillText, { color }, small && { fontSize: 10.5 }]} allowFontScaling={false}>
                {league}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1, alignSelf: "flex-start" },
    pillSmall: { paddingHorizontal: 7, paddingVertical: 2.5 },
    pillDot: { width: 6, height: 6, borderRadius: 3 },
    pillText: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.3 },
});
