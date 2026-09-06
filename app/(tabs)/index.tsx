import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AccountType, getCurrentAccount } from "../../lib/account";

/**
 * Schlichte Outline-Icons (kein Fill), gebaut aus reinen View-Rahmen/Linien —
 * keine zusätzliche Dependency (kein react-native-svg) nötig.
 */
type IconName = "pawn" | "rook" | "bot" | "bookmark" | "clock" | "chevron";

function Icon({
  name,
  size = 18,
  color = "#EDF0F3",
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const s = size;

  switch (name) {
    case "pawn":
      return (
        <View
          style={{
            width: s,
            height: s,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: s * 0.34,
              height: s * 0.34,
              borderRadius: (s * 0.34) / 2,
              borderWidth: 1.5,
              borderColor: color,
              marginBottom: 1,
            }}
          />
          <View
            style={{
              width: s * 0.5,
              height: s * 0.3,
              borderWidth: 1.5,
              borderColor: color,
              borderRadius: 3,
            }}
          />
          <View
            style={{
              width: s * 0.75,
              height: 1.5,
              backgroundColor: color,
              marginTop: 2,
            }}
          />
        </View>
      );

    case "rook":
      return (
        <View
          style={{
            width: s,
            height: s,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              width: s * 0.6,
              marginBottom: 1,
            }}
          >
            <View
              style={{
                width: 1.5,
                height: s * 0.16,
                backgroundColor: color,
              }}
            />
            <View
              style={{
                width: 1.5,
                height: s * 0.16,
                backgroundColor: color,
              }}
            />
            <View
              style={{
                width: 1.5,
                height: s * 0.16,
                backgroundColor: color,
              }}
            />
          </View>

          <View
            style={{
              width: s * 0.6,
              height: s * 0.4,
              borderWidth: 1.5,
              borderColor: color,
              borderRadius: 2,
            }}
          />

          <View
            style={{
              width: s * 0.75,
              height: 1.5,
              backgroundColor: color,
              marginTop: 2,
            }}
          />
        </View>
      );

    case "bot":
      return (
        <View
          style={{
            width: s,
            height: s,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 1.5,
              height: s * 0.14,
              backgroundColor: color,
              marginBottom: 1,
            }}
          />

          <View
            style={{
              width: s * 0.7,
              height: s * 0.5,
              borderWidth: 1.5,
              borderColor: color,
              borderRadius: 6,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: s * 0.18,
            }}
          >
            <View
              style={{
                width: 3,
                height: 3,
                borderRadius: 1.5,
                backgroundColor: color,
              }}
            />

            <View
              style={{
                width: 3,
                height: 3,
                borderRadius: 1.5,
                backgroundColor: color,
              }}
            />
          </View>
        </View>
      );

    case "bookmark":
      return (
        <View
          style={{
            width: s,
            height: s,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: s * 0.5,
              height: s * 0.5,
              borderWidth: 1.5,
              borderColor: color,
              borderBottomWidth: 0,
            }}
          />

          <View style={{ flexDirection: "row" }}>
            <View
              style={{
                width: s * 0.28,
                height: 1.5,
                backgroundColor: color,
                transform: [{ rotate: "35deg" }],
              }}
            />

            <View
              style={{
                width: s * 0.28,
                height: 1.5,
                backgroundColor: color,
                transform: [{ rotate: "-35deg" }],
              }}
            />
          </View>
        </View>
      );

    case "clock":
      return (
        <View
          style={{
            width: s * 0.85,
            height: s * 0.85,
            borderRadius: (s * 0.85) / 2,
            borderWidth: 1.5,
            borderColor: color,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              position: "absolute",
              width: 1.5,
              height: s * 0.28,
              backgroundColor: color,
              bottom: "50%",
            }}
          />

          <View
            style={{
              position: "absolute",
              width: 1.5,
              height: s * 0.2,
              backgroundColor: color,
              bottom: "50%",
              transform: [{ rotate: "70deg" }],
            }}
          />
        </View>
      );

    case "chevron":
      return (
        <View
          style={{
            width: s,
            height: s,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: s * 0.38,
              height: s * 0.38,
              borderTopWidth: 1.5,
              borderRightWidth: 1.5,
              borderColor: color,
              transform: [{ rotate: "45deg" }],
              marginLeft: -(s * 0.06),
            }}
          />
        </View>
      );
  }
}

export default function HomeScreen() {
  const router = useRouter();

  const [account, setAccount] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(true);

  const placeholder = require("../../assets/images/knight_black.png");
  const backgroundImage = require("../../assets/images/loginbackground.png");

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const loadAccount = async () => {
        try {
          const currentAccount = await getCurrentAccount();

          if (!mounted) return;

          if (!currentAccount) {
            router.replace("/auth/login");
            return;
          }

          setAccount(currentAccount);
        } catch (error) {
          console.error("Failed to load account:", error);

          if (mounted) {
            router.replace("/auth/login");
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

      loadAccount();

      return () => {
        mounted = false;
      };
    }, [router])
  );

  if (loading) {
    return (
      <ImageBackground
        source={backgroundImage}
        style={styles.container}
        resizeMode="cover"
      >
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>POVCheck</Text>
        </View>
      </ImageBackground>
    );
  }

  const username = account?.username || "Player";

  const avatarSource =
    account?.avatar && account.avatar.trim().length > 0
      ? { uri: account.avatar }
      : placeholder;

  // ================================
  // ONLINE MATCHMAKING
  // ================================

  const goToOnlineGame = () => {
    const rating = Number(account?.rating ?? 1000);

    console.log("🎯 HOME → MATCHMAKING");
    console.log("NAME:", username);
    console.log("AVATAR:", account?.avatar ?? "");
    console.log("RATING:", rating);

    router.push({
      pathname: "/game/waiting",
      params: {
        name: username,
        avatar:
          account?.avatar && account.avatar.trim().length > 0
            ? account.avatar
            : "",
        rating: String(rating),
      },
    });
  };

  return (
    <ImageBackground
      source={backgroundImage}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.scrim} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.logo}>POVCHECK</Text>

            <Text style={styles.greeting}>Welcome back,</Text>

            <Text style={styles.username}>{username}</Text>
          </View>

          <Pressable
            onPress={() => router.push("/profile")}
            hitSlop={8}
            style={({ pressed }) => [
              styles.avatarFrame,
              pressed && styles.pressed,
            ]}
          >
            <Image source={avatarSource} style={styles.profileImage} />
          </Pressable>
        </View>

        {/* ONLINE */}
        <Pressable
          onPress={goToOnlineGame}
          style={({ pressed }) => [
            styles.onlineCard,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.onlineContent}>
            <View style={styles.onlineTop}>
              <View style={styles.statusDot} />

              <Text style={styles.statusText}>
                Player is currently online
              </Text>
            </View>

            <Text style={styles.onlineTitle}>
              Find an Opponent
            </Text>

            <Text style={styles.onlineSubtitle}>
              Rated game against a real player
            </Text>
          </View>

          <View style={styles.onlineArrow}>
            <Icon
              name="chevron"
              size={16}
              color="#5B8DB8"
            />
          </View>
        </Pressable>

        {/* QUICK PLAY */}
        <Text style={styles.sectionTitle}>
          Quick Play
        </Text>

        <View style={styles.quickGrid}>
          <Pressable
            onPress={() =>
              router.push("/puzzle/dailyPuzzle")
            }
            style={({ pressed }) => [
              styles.smallCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.iconBadge}>
              <Icon
                name="pawn"
                size={17}
                color="#EDF0F3"
              />
            </View>

            <Text style={styles.smallCardTitle}>
              Daily Puzzle
            </Text>

            <Text style={styles.smallCardSubtitle}>
              Sharpen your skills
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              router.push("/game/bot-game")
            }
            style={({ pressed }) => [
              styles.smallCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.iconBadge}>
              <Icon
                name="bot"
                size={17}
                color="#EDF0F3"
              />
            </View>

            <Text style={styles.smallCardTitle}>
              Play against Bot
            </Text>

            <Text style={styles.smallCardSubtitle}>
              Challenge the computer
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              router.push("/game/board")
            }
            style={({ pressed }) => [
              styles.smallCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.iconBadge}>
              <Icon
                name="rook"
                size={17}
                color="#EDF0F3"
              />
            </View>

            <Text style={styles.smallCardTitle}>
              Local Game
            </Text>

            <Text style={styles.smallCardSubtitle}>
              Play with a friend
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              router.push("/savedGames")
            }
            style={({ pressed }) => [
              styles.smallCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.iconBadge}>
              <Icon
                name="bookmark"
                size={17}
                color="#EDF0F3"
              />
            </View>

            <Text style={styles.smallCardTitle}>
              Saved Games
            </Text>

            <Text style={styles.smallCardSubtitle}>
              Continue a game
            </Text>
          </Pressable>
        </View>

        {/* HISTORY */}
        <Pressable
          onPress={() =>
            router.push("/Spielverlauf")
          }
          style={({ pressed }) => [
            styles.historyCard,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.historyLeft}>
            <View style={styles.iconBadge}>
              <Icon
                name="clock"
                size={16}
                color="#EDF0F3"
              />
            </View>

            <View>
              <Text style={styles.historyTitle}>
                Your Recent Games
              </Text>

              <Text style={styles.historySubtitle}>
                View your previous games
              </Text>
            </View>
          </View>

          <Icon
            name="chevron"
            size={15}
            color="rgba(237,240,243,0.4)"
          />
        </Pressable>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#12151B",
  },

  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 12, 16, 0.55)",
  },

  scrollView: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(18, 21, 27, 0.5)",
  },

  loadingText: {
    color: "#EDF0F3",
    fontSize: 19,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 30,
  },

  headerText: {
    flex: 1,
    paddingRight: 18,
  },

  logo: {
    color: "#5B8DB8",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginBottom: 20,
  },

  greeting: {
    color: "rgba(237, 240, 243, 0.5)",
    fontSize: 14,
    marginBottom: 2,
  },

  username: {
    color: "#F5F7F9",
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.8,
  },

  avatarFrame: {
    width: 56,
    height: 56,
    borderRadius: 28,
    padding: 2,
    borderWidth: 1.5,
    borderColor: "rgba(91, 141, 184, 0.55)",
    backgroundColor: "transparent",
  },

  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
  },

  onlineCard: {
    minHeight: 132,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1B2027",
    borderWidth: 1,
    borderColor: "rgba(91, 141, 184, 0.22)",
    marginBottom: 28,
  },

  onlineContent: {
    flex: 1,
  },

  onlineTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 10,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#6F9E8C",
  },

  statusText: {
    color: "rgba(237, 240, 243, 0.55)",
    fontSize: 12.5,
  },

  onlineTitle: {
    color: "#F5F7F9",
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: -0.4,
    marginBottom: 5,
  },

  onlineSubtitle: {
    color: "rgba(237, 240, 243, 0.5)",
    fontSize: 13,
    lineHeight: 18,
  },

  onlineArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    backgroundColor: "rgba(91, 141, 184, 0.14)",
  },

  sectionTitle: {
    color: "rgba(237, 240, 243, 0.8)",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 14,
    paddingLeft: 2,
  },

  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  smallCard: {
    width: "48.2%",
    minHeight: 128,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: "#1B2027",
    borderWidth: 1,
    borderColor: "rgba(237, 240, 243, 0.08)",
    marginBottom: 12,
  },

  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    backgroundColor: "rgba(237, 240, 243, 0.06)",
  },

  smallCardTitle: {
    color: "#F2F4F6",
    fontSize: 16.5,
    fontWeight: "600",
    letterSpacing: -0.2,
    marginBottom: 5,
  },

  smallCardSubtitle: {
    color: "rgba(237, 240, 243, 0.5)",
    fontSize: 12.5,
    lineHeight: 17,
  },

  historyCard: {
    minHeight: 76,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(27, 32, 39, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(237, 240, 243, 0.08)",
    marginTop: 4,
  },

  historyLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  historyTitle: {
    color: "#F2F4F6",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 3,
  },

  historySubtitle: {
    color: "rgba(237, 240, 243, 0.5)",
    fontSize: 12.5,
  },

  pressed: {
    opacity: 0.72,
  },

  bottomSpace: {
    height: 18,
  },
});