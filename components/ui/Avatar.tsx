import React from "react";
import { Image, Text, View } from "react-native";

const COLORS = ["#5B8DB8", "#6F9E8C", "#C9A24B", "#8B6FB8", "#C25450", "#3FB6C8"];

function colorFor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return COLORS[Math.abs(hash) % COLORS.length];
}

type Props = {
    name: string;
    uri?: string | null;
    size?: number;
    /** Small dot at the bottom right: green = online, amber = in a game. */
    status?: "online" | "ingame" | "offline" | null;
};

// Profile picture, or the first letter of the name on a coloured circle.
export default function Avatar({ name, uri, size = 44, status = null }: Props) {
    const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
    const color = colorFor(name || "?");
    const dot = Math.max(10, Math.round(size * 0.28));

    return (
        <View style={{ width: size, height: size }}>
            {uri ? (
                <Image
                    source={{ uri }}
                    style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#1B2027" }}
                />
            ) : (
                <View
                    style={{
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: `${color}33`,
                        borderWidth: 1.5,
                        borderColor: color,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Text style={{ color, fontWeight: "800", fontSize: size * 0.4 }} allowFontScaling={false}>
                        {initial}
                    </Text>
                </View>
            )}

            {status && status !== "offline" && (
                <View
                    style={{
                        position: "absolute",
                        right: -1,
                        bottom: -1,
                        width: dot,
                        height: dot,
                        borderRadius: dot / 2,
                        backgroundColor: status === "online" ? "#4ADE80" : "#F5B544",
                        borderWidth: 2,
                        borderColor: "#12151B",
                    }}
                />
            )}
        </View>
    );
}
