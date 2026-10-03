import React from "react";
import { ImageBackground as NativeImageBackground, ImageBackgroundProps, StyleSheet } from "react-native";

// Background picture that always fills its whole area.
//
// On the web the plain ImageBackground keeps the picture at its own pixel
// size (e.g. 1024 x 1536). On screens wider than that - a laptop, an iPad
// in landscape - a dark strip stayed visible next to it. Stretching the
// picture to 100% fixes that; "cover" still keeps its proportions.
export default function ImageBackground({ imageStyle, resizeMode = "cover", ...props }: ImageBackgroundProps) {
    return <NativeImageBackground {...props} resizeMode={resizeMode} imageStyle={[styles.fill, imageStyle]} />;
}

const styles = StyleSheet.create({
    fill: { width: "100%", height: "100%" },
});
