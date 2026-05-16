import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";

export function AnimatedBackground() {
    const x = useSharedValue(0);

    useEffect(() => {
        x.value = withRepeat(withTiming(1, { duration: 12000 }), -1, true);
    }, []);

    const style = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateX: x.value * 50,
                },
                {
                    translateY: x.value * 30,
                },
            ],
        };
    });

    return (
        <Animated.View style={[StyleSheet.absoluteFill, style]}>
            <LinearGradient
                colors={["#0f0f1a", "#1a0f2e", "#0b0b10"]}
                style={{ flex: 1 }}
            />
        </Animated.View>
    );
}