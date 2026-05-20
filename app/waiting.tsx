import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";

const BoardBackground = () => {
  const squares = [];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const isDark = (row + col) % 2 === 1;

      squares.push(
        <View
          key={`${row}-${col}`}
          style={{
            width: 40,
            height: 40,
            backgroundColor: isDark
              ? "rgba(255,255,255,0.05)"
              : "transparent",
            borderWidth: 0.3,
            borderColor: "rgba(255,255,255,0.04)",
          }}
        />
      );
    }
  }

  return (
    <View style={{
      position: "absolute",
      width: 320,
      height: 320,
      flexDirection: "row",
      flexWrap: "wrap",
      opacity: 0.5,
    }}>
      {squares}
    </View>
  );
}; export default function WaitingScreen() {
  const router = useRouter();

  const bounce = useRef(new Animated.Value(0)).current;
  const gridAnim = useRef(new Animated.Value(0)).current;

  const messages = [
    "Suche nach Gegner… ",
    "Vergleiche Elo-Niveau…  ",
    "Prüfe verfügbare Spieler…  ",
    "Erstelle fairen Match…  ",
    "Synchronisiere Schachserver…  ",
    "Bereite Partie vor…  ",
  ];

  const [status, setStatus] = useState(messages[0]);
  const lastIndex = useRef(-1);

  // message shuffle
  useEffect(() => {
    const interval = setInterval(() => {
      let index;
      do {
        index = Math.floor(Math.random() * messages.length);
      } while (index === lastIndex.current);

      lastIndex.current = index;
      setStatus(messages[index]);
    }, 2200);

    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // animation loop
  useEffect(() => {
    Animated.loop(
      Animated.timing(gridAnim, {
        toValue: 1,
        duration: 6000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  return (
    <View style={{
      flex: 1,
      backgroundColor: "#050816",
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden"
    }}>

      <Animated.View
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: 300,
          backgroundColor: "#3b82f6",
          opacity: 0.08,
          transform: [
            {
              translateY: bounce.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -8],
              }),
            },
          ],
        }}
      />

      {/* chess background */}
      <BoardBackground />

      {/* knight */}
      <Animated.Image
        source={require("../assets/images/knight_white.png")}
        style={{
          width: 90,
          height: 90,
          transform: [
            {
              translateY: gridAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-6, 6],
              }),
            },
            {
              rotate: gridAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["-5deg", "5deg"],
              }),
            },
          ],
        }}
      />

      <Text style={{ color: "white", fontSize: 18 }}>
        {status}
      </Text>

    </View>
  );
}