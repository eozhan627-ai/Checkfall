import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View
} from "react-native";
import { getSocket } from "../../lib/socket";

const SIZE = 8;
const CELL = 42;

const BoardBackground = () => {
  const squares = [];

  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const dark = (row + col) % 2 === 1;

      squares.push(
        <View
          key={`${row}-${col}`}
          style={{
            width: CELL,
            height: CELL,
            backgroundColor: dark
              ? "rgba(255,255,255,0.04)"
              : "transparent",
          }}
        />
      );
    }
  }

  return (
    <View style={styles.boardBg}>
      {squares}
    </View>
  );
};

export default function WaitingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const pulse = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  const messages = [
    "Searching opponents… ",
    "Matching Elo… ",
    "Analyzing pool… ",
    "Building fair match… ",
    "Syncing server… ",
    "Preparing board… ",
  ];

  const [status, setStatus] = useState(messages[0]);
  const lastIndex = useRef(-1);

  // socket find match
  useEffect(() => {
    const socket = getSocket();

    const handleGameStart = (data: any) => {
      router.replace({
        pathname: "/game/online-game",
        params: data,
      });
    };

    socket.emit("find_match", {
      name: params.name,
      avatar: params.avatar,
    });

    socket.on("game_start", handleGameStart);

    return () => {
      socket.off("game_start", handleGameStart); // ✔ wichtig
    };
  }, []);
  // status rotation
  useEffect(() => {
    const interval = setInterval(() => {
      let i;
      do {
        i = Math.floor(Math.random() * messages.length);
      } while (i === lastIndex.current);

      lastIndex.current = i;
      setStatus(messages[i]);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // pulse animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // floating knight
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const glow = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0.25],
  });

  return (
    <View style={styles.container}>

      {/* BACKGROUND */}
      <View style={styles.bgGlow} />
      <BoardBackground />

      {/* CENTER CARD */}
      <View style={styles.card}>

        <Animated.Image
          source={require("../../assets/images/knight_black.png")}
          style={[
            styles.knight,
            {
              transform: [
                {
                  translateY: floatAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-6, 6],
                  }),
                },
                {
                  rotate: floatAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["-4deg", "4deg"],
                  }),
                },
              ],
            },
          ]}
        />

        <Text style={styles.title}>Finding Match</Text>

        <Text style={styles.subtitle}>{status}</Text>

        <Animated.View style={[styles.loadingBar, { opacity: glow }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050816",
    justifyContent: "center",
    alignItems: "center",
  },

  bgGlow: {
    position: "absolute",
    width: 600,
    height: 600,
    borderRadius: 400,
    backgroundColor: "#3b82f6",
    opacity: 0.08,
  },

  boardBg: {
    position: "absolute",
    width: 336,
    height: 336,
    flexDirection: "row",
    flexWrap: "wrap",
    opacity: 0.4,
  },

  card: {
    width: "78%",
    padding: 22,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  knight: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },

  title: {
    color: "white",
    fontSize: 20,
    fontWeight: "600",
  },

  subtitle: {
    color: "#cbd5e1",
    fontSize: 14,
    marginTop: 6,
    marginBottom: 14,
  },

  loadingBar: {
    width: "60%",
    height: 4,
    borderRadius: 10,
    backgroundColor: "#60a5fa",
  },
});