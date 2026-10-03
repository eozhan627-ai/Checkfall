import React from "react";
import { StyleSheet, Text, View } from "react-native";

/** The coin of the shop, drawn without an image file. */
export default function Coin({ size = 16 }: { size?: number }) {
    return (
        <View style={[styles.coin, { width: size, height: size, borderRadius: size / 2 }]}>
            <View
                style={[
                    styles.inner,
                    { width: size * 0.62, height: size * 0.62, borderRadius: size * 0.31, borderWidth: Math.max(1, size * 0.08) },
                ]}
            />
        </View>
    );
}

/** Coin with an amount next to it. */
export function CoinAmount({ amount, size = 14, color = "#F1D98A" }: { amount: number | string; size?: number; color?: string }) {
    return (
        <View style={styles.amount}>
            <Coin size={size} />
            <Text style={[styles.amountText, { color, fontSize: size * 0.95 }]}>{amount}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    coin: {
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#D4AF37",
        borderWidth: 1,
        borderColor: "#8C6F1A",
    },
    inner: { borderColor: "rgba(255, 244, 200, 0.75)" },
    amount: { flexDirection: "row", alignItems: "center", gap: 5 },
    amountText: { fontWeight: "700" },
});
