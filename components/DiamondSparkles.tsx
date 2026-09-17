import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";

type SparkParticleProps = { x: number; y: number; delay: number; size: number };

function SparkParticle({ x, y, delay, size }: SparkParticleProps) {
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(progress, {
                    toValue: 1,
                    duration: 2200,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);

    const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] });
    const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
    const scale = progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.4, 1, 0.6] });

    return (
        <Animated.Text
            style={{
                position: "absolute",
                left: x,
                top: y,
                fontSize: size,
                color: "#D9CBFF",
                opacity,
                transform: [{ translateY }, { scale }],
            }}
        >
            ✦
        </Animated.Text>
    );
}

const PARTICLES = [
    { xFrac: -0.03, yFrac: 0.02, delay: 0, size: 11 },
    { xFrac: 0.86, yFrac: 0.1, delay: 700, size: 8 },
    { xFrac: 0.9, yFrac: 0.86, delay: 1400, size: 10 },
    { xFrac: 0.04, yFrac: 0.82, delay: 350, size: 9 },
    { xFrac: 0.5, yFrac: -0.08, delay: 1050, size: 7 },
];

export function DiamondSparkles({ size }: { size: number }) {
    return (
        <View pointerEvents="none" style={{ position: "absolute", width: size, height: size }}>
            {PARTICLES.map((p, i) => (
                <SparkParticle
                    key={i}
                    x={size * p.xFrac}
                    y={size * p.yFrac}
                    delay={p.delay}
                    size={p.size}
                />
            ))}
        </View>
    );
}