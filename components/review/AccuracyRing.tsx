import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { T } from "../ui/theme";
import { tr } from "../../lib/i18n";

type Props = {
    /** 0-100, or null when unknown. */
    value: number | null;
    size?: number;
    color?: string;
};

export function accuracyColor(value: number | null): string {
    if (value === null) return T.textFaint;
    if (value >= 90) return "#26C2A3";
    if (value >= 80) return "#8DBB5A";
    if (value >= 65) return "#E8B93E";
    if (value >= 50) return "#EE8D3F";
    return "#D9453D";
}

// Circular gauge with the accuracy in the middle.
export default function AccuracyRing({ value, size = 84, color }: Props) {
    const stroke = Math.max(5, Math.round(size * 0.085));
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const share = value === null ? 0 : Math.max(0, Math.min(100, value)) / 100;
    const ringColor = color ?? accuracyColor(value);

    return (
        <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
            <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="rgba(237,240,243,0.09)"
                    strokeWidth={stroke}
                    fill="none"
                />
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={ringColor}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${circumference * share} ${circumference}`}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </Svg>

            <Text style={[styles.value, { fontSize: size * 0.27 }]} allowFontScaling={false}>
                {value === null ? "–" : value.toFixed(1)}
            </Text>
            <Text style={[styles.caption, { fontSize: Math.max(8.5, size * 0.105) }]} allowFontScaling={false}>
                {tr("ACCURACY")}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    value: { color: T.text, fontWeight: "800", fontVariant: ["tabular-nums"] },
    caption: { color: T.textFaint, fontWeight: "700", letterSpacing: 0.6, marginTop: -1 },
});
