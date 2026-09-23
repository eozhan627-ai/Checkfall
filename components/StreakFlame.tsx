import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, {
    Defs,
    LinearGradient,
    Stop,
    Path,
} from "react-native-svg";
type Props = {
    size?: number;
    outerColor?: string;
    midColor?: string;
    innerColor?: string;
};
/*
 * Natürlichere Flammenform:
 * - mehrere Flammenzungen
 * - unterschiedlich hohe Spitzen
 * - konkave Einbuchtungen
 * - asymmetrische Silhouette
 */
const OUTER_FLAME = `
M12.1 23
C7.1 23 3.2 19.45 3.2 14.55
C3.2 11.15 4.9 8.15 7.55 5.15
C7.35 7.45 8.05 9.05 9.4 10.05
C9.15 6.55 10.55 3.15 14.7 0.65
C14.3 4.35 16.25 6.35 17.55 8.2
C18.35 7.25 18.75 6.2 18.7 4.95
C20.45 7.15 21.1 10.05 21.1 13.15
C21.1 18.75 17.35 23 12.1 23Z
`;
const MID_FLAME = `
M12.1 21
C8.35 21 5.7 18.3 5.7 14.75
C5.7 12.35 6.8 10.25 8.55 8.15
C8.45 10.15 9.05 11.45 10.25 12.2
C10.05 9.45 11.15 7.15 13.8 5.05
C13.6 8.05 15.1 9.55 16.15 11.05
C16.8 10.25 17.05 9.35 17 8.4
C18.1 10.15 18.55 12.15 18.55 14.1
C18.55 18.05 15.8 21 12.1 21Z
`;
const INNER_FLAME = `
M12.05 18.9
C10.05 18.9 8.65 17.4 8.65 15.45
C8.65 14.15 9.3 12.95 10.45 11.85
C10.4 13.35 10.9 14.15 11.7 14.65
C11.55 12.95 12.25 11.6 13.75 10.45
C13.65 12.55 14.8 13.4 15.35 14.8
C15.65 14.3 15.8 13.8 15.75 13.25
C16.35 14.15 16.65 15.05 16.65 15.85
C16.65 17.6 14.7 18.9 12.05 18.9Z
`;
export default function StreakFlame({
    size = 24,
    outerColor = "#E83B22",
    midColor = "#FF7A24",
    innerColor = "#FFD65A",
}: Props) {
    /*
     * Eine gemeinsame Animation für alle drei Schichten.
     *
     * Die Flamme bewegt sich nicht mehr seitlich.
     * Stattdessen flackert sie sanft nach oben/unten
     * und verändert minimal ihre Größe.
     */
    const flicker = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(flicker, {
                    toValue: 1,
                    duration: 500,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(flicker, {
                    toValue: 0,
                    duration: 500,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [flicker]);
    /*
     * Gemeinsame Bewegung:
     * Außen = 100 %
     * Mitte = 90 %
     * Kern = 80 %
     *
     * Dadurch bleiben alle synchron,
     * aber die inneren Schichten wirken etwas leichter.
     */
    const outerY = flicker.interpolate({
        inputRange: [0, 1],
        outputRange: [0.6, -1.1],
    });
    const outerScale = flicker.interpolate({
        inputRange: [0, 1],
        outputRange: [0.98, 1.03],
    });
    const midY = flicker.interpolate({
        inputRange: [0, 1],
        outputRange: [0.54, -0.99],
    });
    const midScale = flicker.interpolate({
        inputRange: [0, 1],
        outputRange: [0.982, 1.027],
    });
    const innerY = flicker.interpolate({
        inputRange: [0, 1],
        outputRange: [0.48, -0.88],
    });
    const innerScale = flicker.interpolate({
        inputRange: [0, 1],
        outputRange: [0.984, 1.024],
    });
    return (
        <View
            style={{
                width: size,
                height: size,
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            {/* Subtiler Glow */}
            <View
                pointerEvents="none"
                style={{
                    position: "absolute",
                    width: size * 0.82,
                    height: size * 0.82,
                    borderRadius: size,
                    backgroundColor: outerColor,
                    opacity: 0.12,
                }}
            />
            {/* =========================
                ÄUSSERE FLAMME
               ========================= */}
            <Animated.View
                style={{
                    position: "absolute",
                    width: size,
                    height: size,
                    transform: [
                        { translateY: outerY },
                        { scale: outerScale },
                    ],
                }}
            >
                <Svg
                    width={size}
                    height={size}
                    viewBox="0 0 24 24"
                >
                    <Defs>
                        <LinearGradient
                            id="outerGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <Stop
                                offset="0"
                                stopColor="#FF5A38"
                            />
                            <Stop
                                offset="0.55"
                                stopColor={outerColor}
                            />
                            <Stop
                                offset="1"
                                stopColor="#D92E19"
                            />
                        </LinearGradient>
                    </Defs>
                    <Path
                        d={OUTER_FLAME}
                        fill="url(#outerGradient)"
                    />
                </Svg>
            </Animated.View>
            {/* =========================
                MITTLERE ORANGE FLAMME
               ========================= */}
            <Animated.View
                style={{
                    position: "absolute",
                    width: size * 0.78,
                    height: size * 0.78,
                    top: size * 0.18,
                    transform: [
                        { translateY: midY },
                        { scale: midScale },
                    ],
                }}
            >
                <Svg
                    width={size * 0.78}
                    height={size * 0.78}
                    viewBox="0 0 24 24"
                >
                    <Defs>
                        <LinearGradient
                            id="midGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <Stop
                                offset="0"
                                stopColor="#FFB13B"
                            />
                            <Stop
                                offset="0.6"
                                stopColor={midColor}
                            />
                            <Stop
                                offset="1"
                                stopColor="#F05B20"
                            />
                        </LinearGradient>
                    </Defs>
                    <Path
                        d={MID_FLAME}
                        fill="url(#midGradient)"
                    />
                </Svg>
            </Animated.View>
            {/* =========================
                GELBER INNERER KERN
               ========================= */}
            <Animated.View
                style={{
                    position: "absolute",
                    width: size * 0.47,
                    height: size * 0.47,
                    top: size * 0.42,
                    transform: [
                        { translateY: innerY },
                        { scale: innerScale },
                    ],
                }}
            >
                <Svg
                    width={size * 0.47}
                    height={size * 0.47}
                    viewBox="0 0 24 24"
                >
                    <Defs>
                        <LinearGradient
                            id="innerGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <Stop
                                offset="0"
                                stopColor="#FFF8B5"
                            />
                            <Stop
                                offset="0.55"
                                stopColor="#FFE477"
                            />
                            <Stop
                                offset="1"
                                stopColor={innerColor}
                            />
                        </LinearGradient>
                    </Defs>
                    <Path
                        d={INNER_FLAME}
                        fill="url(#innerGradient)"
                    />
                </Svg>
            </Animated.View>
        </View>
    );
}