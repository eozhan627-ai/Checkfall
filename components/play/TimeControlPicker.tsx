import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { TIME_CATEGORIES, TIME_CONTROLS } from "../../lib/timeControls";
import { T } from "../ui/theme";
import { tr } from "../../lib/i18n";

type Props = {
    value: string;
    onChange: (id: string) => void;
};

/** Time controls grouped as Bullet / Blitz / Rapid / Classical. */
export default function TimeControlPicker({ value, onChange }: Props) {
    return (
        <View style={styles.wrap}>
            {TIME_CATEGORIES.map((category) => (
                <View key={category} style={styles.group}>
                    <Text style={styles.category}>{category}</Text>

                    <View style={styles.row}>
                        {TIME_CONTROLS.filter((control) => control.category === category).map((control) => {
                            const active = control.id === value;

                            return (
                                <Pressable
                                    key={control.id}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: active }}
                                    onPress={() => onChange(control.id)}
                                    style={({ pressed }) => [
                                        styles.chip,
                                        active && styles.chipActive,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Text style={[styles.chipMain, active && styles.chipMainActive]}>
                                        {control.minutes}
                                        <Text style={styles.chipUnit}> {tr("min")}</Text>
                                    </Text>
                                    <Text style={[styles.chipSub, active && styles.chipSubActive]}>
                                        {control.increment > 0 ? `+${control.increment} s` : tr("no bonus")}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: 14 },
    group: { gap: 8 },
    category: { color: T.textFaint, fontSize: 11, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase" },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
        minWidth: 74,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: "rgba(237,240,243,0.05)",
        borderWidth: 1,
        borderColor: T.border,
        alignItems: "center",
    },
    chipActive: { backgroundColor: T.accentSoft, borderColor: T.accent },
    chipMain: { color: T.text, fontSize: 17, fontWeight: "700", fontVariant: ["tabular-nums"] },
    chipMainActive: { color: "#FFFFFF" },
    chipUnit: { fontSize: 12, fontWeight: "600" },
    chipSub: { color: T.textFaint, fontSize: 11.5, marginTop: 2 },
    chipSubActive: { color: "#A9C6E0" },
    pressed: { opacity: 0.75 },
});
