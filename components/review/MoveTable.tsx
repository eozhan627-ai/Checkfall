import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CLASSIFICATION_META, HIGHLIGHTED, ReviewMove } from "../../lib/analysis";
import { T } from "../ui/theme";
import ClassificationBadge from "./ClassificationBadge";

type Props = {
    moves: ReviewMove[];
    /** 0 = start position, i = after move i. */
    currentIndex: number;
    onSelect: (index: number) => void;
};

// Score sheet: one row per move number, White's and Black's move side by side.
export default function MoveTable({ moves, currentIndex, onSelect }: Props) {
    const rows: { number: number; white?: ReviewMove; black?: ReviewMove }[] = [];

    for (const move of moves) {
        if (move.color === "w") rows.push({ number: move.moveNumber, white: move });
        else if (rows.length && !rows[rows.length - 1].black) rows[rows.length - 1].black = move;
        else rows.push({ number: move.moveNumber, black: move });
    }

    const cell = (move?: ReviewMove) => {
        if (!move) return <View style={styles.cell} />;

        const active = currentIndex === move.ply + 1;
        const meta = CLASSIFICATION_META[move.classification];
        const highlighted = HIGHLIGHTED.includes(move.classification);

        return (
            <Pressable
                onPress={() => onSelect(move.ply + 1)}
                style={[styles.cell, active && { backgroundColor: `${meta.color}2E`, borderColor: `${meta.color}99` }]}
            >
                <Text style={[styles.san, highlighted && { color: meta.color }, active && styles.sanActive]} numberOfLines={1}>
                    {move.san}
                </Text>
                {(highlighted || move.classification === "book") && (
                    <ClassificationBadge classification={move.classification} size={16} />
                )}
            </Pressable>
        );
    };

    return (
        <View>
            {rows.map((row, index) => (
                <View key={index} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
                    <Text style={styles.number}>{row.number}.</Text>
                    {cell(row.white)}
                    {cell(row.black)}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", paddingVertical: 3, paddingHorizontal: 6, borderRadius: 8, gap: 6 },
    rowAlt: { backgroundColor: "rgba(237,240,243,0.03)" },
    number: { width: 30, color: T.textFaint, fontSize: 12.5, fontVariant: ["tabular-nums"] },
    cell: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 9,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "transparent",
        minHeight: 32,
    },
    san: { color: T.text, fontSize: 14, fontWeight: "600" },
    sanActive: { fontWeight: "800" },
});
