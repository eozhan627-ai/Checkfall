import React from "react";
import { Image, View } from "react-native";
import { DiamondSparkles } from "./DiamondSparkles"; // NEU: aus der Datei, die du mir geschickt hast

const frames = {
    silver: require("../assets/images/silver_edge.png"),
    gold: require("../assets/images/gold_edge.png"),
    diamond: require("../assets/images/diamond_edge.png"), // NEU
};

function ProfileAvatar({
    uri,
    frame = "silver",
    size = 140,
}: {
    uri: string;
    frame?: keyof typeof frames;
    size?: number;
}) {
    return (
        <View
            style={{
                width: size,
                height: size,
                position: "relative",
            }}
        >
            {/* AVATAR (innen) */}
            <View
                style={{
                    position: "absolute",
                    top: size * 0.12,
                    left: size * 0.12,
                    width: size * 0.76,
                    height: size * 0.76,
                    overflow: "hidden",
                    borderRadius: 20,
                    backgroundColor: !uri ? "#fff" : "transparent",
                }}
            >
                <Image
                    source={uri ? { uri } : require("../assets/images/knight_black.png")}
                    style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: 20,
                    }}
                    resizeMode="cover"
                />
            </View>

            {/* SPARKLES (nur Diamant, zwischen Avatar und Rahmen) */}
            {frame === "diamond" && <DiamondSparkles size={size} />}

            {/* FRAME (oben drüber) */}
            <Image
                source={frames[frame]}
                style={{
                    width: size * 1.65,
                    height: size * 1.65,
                    position: "absolute",
                    top: -size * 0.32,
                    left: -size * 0.32,
                }}
                resizeMode="stretch"
            />
        </View>
    );
}

export default React.memo(ProfileAvatar);