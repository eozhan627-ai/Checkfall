import { useFocusEffect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { AccountType, getCurrentAccount } from '../../lib/account';

export default function HomeScreen() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(true);

  const placeholder = require("../../assets/images/knight_black.png");
  const backgroundImage = require("../../assets/images/background.png");

  useFocusEffect(
    React.useCallback(() => {
      let active = true;

      (async () => {
        const acc = await getCurrentAccount();

        if (!acc) {
          router.replace('/auth/login');
        } else if (active) {
          setAccount(acc);
          setLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#fff" }}>Lade...</Text>
      </View>
    );
  }

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">

      {/* CENTER WRAPPER (IMPORTANT FOR DESKTOP) */}
      <View style={styles.centerWrapper}>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={{ width: 36 }} />

          <View style={styles.titleBox}>
            <Text style={styles.title}>Checkfall</Text>
            <Text style={styles.subtitle}>Play · Learn · Improve  </Text>
          </View>

          <TouchableOpacity
            style={styles.profileBox}
            onPress={() => router.push('/profile')}
          >
            <Image
              source={
                account?.avatar
                  ? { uri: account.avatar }
                  : placeholder
              }
              style={styles.avatar}
            />
          </TouchableOpacity>
        </View>

        {/* CONTENT */}
        <View style={styles.content}>

          <TouchableOpacity style={styles.tile} onPress={() => router.push('/puzzle/dailyPuzzle')}>
            <Text style={styles.titleText}>Daily Puzzle</Text>
            <Text style={styles.subText}>Solve a puzzle</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tile} onPress={() => router.push('/game/bot-game')}>
            <Text style={styles.titleText}>Play vs Bot</Text>
            <Text style={styles.subText}>AI opponent</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tile} onPress={() => router.push('./indexLG')}>
            <Text style={styles.titleText}>Local Game</Text>
            <Text style={styles.subText}>Same device</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tile} onPress={() => router.push('/savedGames')}>
            <Text style={styles.titleText}>Saved Games</Text>
            <Text style={styles.subText}>Review matches</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tile} onPress={() => router.push('/Spielverlauf')}>
            <Text style={styles.titleText}>History</Text>
            <Text style={styles.subText}>Match history</Text>
          </TouchableOpacity>

        </View>

        {/* FOOTER CTA */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.playOnline}
            onPress={() =>
              router.push({
                pathname: "/game/waiting",
                params: {
                  name: account?.username,
                  avatar: account?.avatar
                }
              })
            }
          >
            <Text style={styles.playOnlineTitle}>Play Online</Text>
            <Text style={styles.playOnlineSub}>Find real opponents</Text>
          </TouchableOpacity>
        </View>

      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },

  centerWrapper: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  header: {
    width: "100%",
    maxWidth: 520,
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 10,
  },

  titleBox: {
    flex: 1,
    alignItems: "center",
  },

  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff"
  },

  subtitle: {
    fontSize: 14,
    color: "#ccc",
    marginTop: 2,
  },

  profileBox: {
    width: 36,
    height: 36,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#fff",
  },

  avatar: {
    width: 36,
    height: 36,
  },

  content: {
    flex: 1,
    width: "100%",
    maxWidth: 520,
    justifyContent: "flex-start",
    gap: 12,
    marginTop: 10,
  },

  tile: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 16,
    width: "100%",
  },

  titleText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff"
  },

  subText: {
    fontSize: 13,
    color: "#ccc",
    marginTop: 4,
  },

  footer: {
    width: "100%",
    maxWidth: 520,
    paddingBottom: 12,
  },

  playOnline: {
    backgroundColor: "rgba(30,30,30,0.85)",
    borderRadius: 16,
    padding: 18,
  },

  playOnlineTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff"
  },

  playOnlineSub: {
    fontSize: 13,
    color: "#ccc",
    marginTop: 4,
  }
});