import React, { useRef } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import { T } from "../ui/theme";

type Props = {
    value: number;
    onValueChange: (value: number) => void;
    minimumValue: number;
    maximumValue: number;
    step: number;
    color?: string;
};

const THUMB = 28;

// Slider without a native module (works in Expo Go and on the web).
//
// The position is always calculated from the finger's position on the
// SCREEN and the measured position of the track. (The position relative to
// the touched view must not be used: it belongs to whatever child is under
// the finger - the thumb, the filled part - and makes the value jump.)
export default function Slider({
    value,
    onValueChange,
    minimumValue,
    maximumValue,
    step,
    color = T.accent,
}: Props) {
    const trackRef = useRef<View>(null);
    const track = useRef({ left: 0, width: 0 });

    // The responder is created once, so it reads the current props from a ref.
    const props = useRef({ onValueChange, minimumValue, maximumValue, step, value });
    props.current = { onValueChange, minimumValue, maximumValue, step, value };

    const setFromPageX = (pageX: number) => {
        const { left, width } = track.current;
        if (width <= 0) return;

        const { minimumValue: min, maximumValue: max, step: stepSize } = props.current;

        const ratio = Math.min(1, Math.max(0, (pageX - left) / width));
        const stepped = Math.round((ratio * (max - min)) / stepSize) * stepSize + min;
        const next = Math.min(max, Math.max(min, stepped));

        if (next !== props.current.value) props.current.onValueChange(next);
    };

    const responder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onStartShouldSetPanResponderCapture: () => true,
            onMoveShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponderCapture: () => true,
            // Keep the gesture even when the finger leaves the slider or a
            // scroll view would like to take over.
            onPanResponderTerminationRequest: () => false,
            onShouldBlockNativeResponder: () => true,

            onPanResponderGrant: (event) => {
                const pageX = event.nativeEvent.pageX;

                // Measure at the start of every gesture: the slider may have
                // moved since the last one (scrolling, rotation).
                trackRef.current?.measureInWindow((x, _y, width) => {
                    track.current = { left: x, width };
                    setFromPageX(pageX);
                });
            },
            onPanResponderMove: (_event, gesture) => setFromPageX(gesture.moveX),
            // Letting go keeps the value exactly where it is.
        })
    ).current;

    const ratio = Math.min(1, Math.max(0, (value - minimumValue) / (maximumValue - minimumValue)));

    return (
        <View style={styles.touch} {...responder.panHandlers}>
            <View ref={trackRef} style={styles.track} pointerEvents="none" collapsable={false}>
                <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
                <View style={[styles.thumb, { left: `${ratio * 100}%`, borderColor: color }]} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    // Tall touch area, and room at the sides so the thumb is never cut off.
    touch: { height: 48, justifyContent: "center", paddingHorizontal: THUMB / 2 },
    track: { height: 6, borderRadius: 3, backgroundColor: "rgba(237,240,243,0.14)" },
    fill: { height: 6, borderRadius: 3 },
    thumb: {
        position: "absolute",
        top: 3 - THUMB / 2,
        marginLeft: -THUMB / 2,
        width: THUMB,
        height: THUMB,
        borderRadius: THUMB / 2,
        backgroundColor: "#F5F7F9",
        borderWidth: 3,
    },
});
