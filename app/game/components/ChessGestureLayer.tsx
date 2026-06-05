import React from "react";
import { View } from "react-native";

export function ChessGestureLayer({
  children,
  onPressSquare,
  onReleaseSquare,
}: {
  children: React.ReactNode;
  onPressSquare: (square: string) => void;
  onReleaseSquare: (square: string) => void;
}) {
  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponder={() => true}
      onResponderGrant={(evt) => {
        const { locationX, locationY } = evt.nativeEvent;

        const square = getSquareFromCoords(locationX, locationY);
        onPressSquare(square);
      }}
      onResponderRelease={(evt) => {
        const { locationX, locationY } = evt.nativeEvent;

        const square = getSquareFromCoords(locationX, locationY);
        onReleaseSquare(square);
      }}
    >
      {children}
    </View>
  );
}

// später ersetzen durch echte Board-Mapping Logik
function getSquareFromCoords(x: number, y: number): string {
  // TODO: Board grid mapping
  return "e4";
}