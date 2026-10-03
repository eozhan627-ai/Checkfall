import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { T } from "../ui/theme";

type Option<V extends string> = { value: V; label: string; hint?: string; disabled?: boolean };

type Props<V extends string> = {
    options: Option<V>[];
    value: V;
    onChange: (value: V) => void;
};

/** A row of options of which exactly one is selected. */
export default function Segmented<V extends string>({ options, value, onChange }: Props<V>) {
    return (
        <View style={styles.row}>
            {options.map((option) => {
                const active = option.value === value;

                return (
                    <Pressable
                        key={option.value}
                        disabled={option.disabled}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active, disabled: option.disabled }}
                        onPress={() => onChange(option.value)}
                        style={({ pressed }) => [
                            styles.item,
                            active && styles.itemActive,
                            option.disabled && styles.itemDisabled,
                            pressed && { opacity: 0.75 },
                        ]}
                    >
                        <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
                        {option.hint ? (
                            <Text style={[styles.hint, active && styles.hintActive]} numberOfLines={1}>
                                {option.hint}
                            </Text>
                        ) : null}
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: "row", gap: 8 },
    item: {
        flex: 1,
        paddingVertical: 11,
        paddingHorizontal: 8,
        borderRadius: 14,
        backgroundColor: "rgba(237,240,243,0.05)",
        borderWidth: 1,
        borderColor: T.border,
        alignItems: "center",
    },
    itemActive: { backgroundColor: T.accentSoft, borderColor: T.accent },
    itemDisabled: { opacity: 0.4 },
    label: { color: T.text, fontSize: 14.5, fontWeight: "700" },
    labelActive: { color: "#FFFFFF" },
    hint: { color: T.textFaint, fontSize: 11.5, marginTop: 2 },
    hintActive: { color: "#A9C6E0" },
});
