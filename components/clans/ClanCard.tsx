import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ClanType } from "../../lib/clans";
import { T } from "../ui/theme";
import ClanBadge, { LeaguePill } from "./ClanBadge";
import { tr } from "../../lib/i18n";

const SHORT_JOIN_LABEL = { get open() { return tr("Open"); }, get request() { return tr("On request"); }, get closed() { return tr("Invite only"); } } as const;

type Props = {
    clan: ClanType;
    onPress: () => void;
    /** Position in the ranking, shown in front of the card. */
    rank?: number;
};

// One clan in a list: emblem, name, league, members and how to get in.
export default function ClanCard({ clan, onPress, rank }: Props) {
    const full = clan.member_count >= clan.max_members;

    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
            {rank !== undefined && (
                <Text style={[styles.rank, rank <= 3 && { color: T.gold }]} allowFontScaling={false}>
                    {rank}
                </Text>
            )}

            <ClanBadge badge={clan.badge} color={clan.badge_color} size={46} />

            <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                        {clan.name}
                    </Text>
                    {clan.tag ? <Text style={styles.tag}>[{clan.tag}]</Text> : null}
                </View>

                <View style={styles.metaRow}>
                    <LeaguePill league={clan.league} small />
                    <Text style={styles.meta}>
                        {clan.member_count}/{clan.max_members}
                    </Text>
                    <Text style={styles.meta}>·</Text>
                    <Text style={styles.meta} numberOfLines={1}>{full ? tr("Full") : SHORT_JOIN_LABEL[clan.join_type]}</Text>
                </View>
            </View>

            <View style={styles.ratingWrap}>
                <Text style={styles.rating}>{clan.clan_rating}</Text>
                <Text style={styles.ratingLabel}>{tr("CLAN ELO")}</Text>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: T.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: T.border,
        padding: 12,
        marginBottom: 10,
    },
    rank: { width: 22, textAlign: "center", color: T.textFaint, fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] },
    nameRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
    name: { color: T.text, fontSize: 15.5, fontWeight: "800", flexShrink: 1 },
    tag: { color: T.textFaint, fontSize: 12, fontWeight: "700" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
    meta: { color: T.textDim, fontSize: 12, fontWeight: "600" },
    ratingWrap: { alignItems: "flex-end" },
    rating: { color: T.text, fontSize: 17, fontWeight: "800", fontVariant: ["tabular-nums"] },
    ratingLabel: { color: T.textFaint, fontSize: 8.5, fontWeight: "800", letterSpacing: 0.6, marginTop: 1 },
});
