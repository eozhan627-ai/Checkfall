import { Stack, usePathname } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import {
  connectAuthenticatedSocket,
  disconnectSocket,
  getSocket,
} from "../lib/socket";
import ChallengeHost from "../components/ChallengeHost";
import { syncProgress } from "../lib/progressSync";
import { supabase } from "../lib/supabase";
import { log } from "../lib/log";
import { loadLanguage, tr, useLanguage } from "../lib/i18n";
import { loadSoundSetting } from "../lib/sounds";
import { installErrorReporting, setErrorScreen } from "../lib/feedback";
import { loadShop } from "../lib/shop";

export default function Layout() {
  const [sessionKicked, setSessionKicked] = useState(false);
  const sessionKickedRef = useRef(false);

  // Language: the stored choice is read once; changing it in the settings
  // rebuilds the screens (the "key" below) so every text is shown again in
  // the new language.
  const language = useLanguage();
  const [languageReady, setLanguageReady] = useState(false);

  useEffect(() => {
    loadLanguage().finally(() => setLanguageReady(true));
    loadSoundSetting();
    loadShop();
    installErrorReporting();
  }, []);

  // Error reports say on which screen the error happened.
  const pathname = usePathname();
  useEffect(() => {
    setErrorScreen(pathname);
  }, [pathname]);

  // =============================
  // WEB: HINTERGRUNDBILD-FIX
  // =============================
  // GEÄNDERT: "html, body, #root, #root > div { height: 100% }" hat nicht
  // zuverlässig funktioniert, weil React Navigation/Expo Router auf Web oft
  // noch weitere, ungestylte <div>-Wrapper zwischen #root und dem
  // eigentlichen Screen-Container einfügt - die Prozent-Höhe wird dort
  // unterbrochen, wenn irgendein Zwischen-Div keine eigene Höhe bekommt.
  // Robuster: #root per position:fixed direkt auf die volle Viewport-Fläche
  // pinnen, unabhängig davon, wie tief darunter verschachtelt wird -
  // flex:1 (das unser eigener Root-View schon mitbringt) füllt das dann
  // zuverlässig aus.
  useEffect(() => {
    if (Platform.OS === "web") {
      const styleId = "povcheck-web-height-fix";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
          html, body {
            height: 100%;
            margin: 0;
          }
          #root {
            position: fixed;
            inset: 0;
            display: flex;
          }
          #root > div {
            flex: 1;
            display: flex;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const socket = getSocket();
    // =============================
    // SESSION KICK
    // =============================
    const handleSessionKicked = () => {
      if (!mounted) return;
      log(
        "⚠️ SESSION KICKED: another device logged in"
      );
      sessionKickedRef.current = true;
      disconnectSocket();
      setSessionKicked(true);
    };
    socket.on(
      "session_kicked",
      handleSessionKicked
    );
    // =============================
    // SUPABASE AUTH
    // =============================
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        log(
          "AUTH EVENT:",
          event
        );
        if (!mounted) return;
        if (sessionKickedRef.current) {
          log(
            "SOCKET: blocked because this device was kicked"
          );
          return;
        }
        if (
          event === "SIGNED_IN" &&
          session?.access_token
        ) {
          setTimeout(() => {
            if (
              mounted &&
              !sessionKickedRef.current
            ) {
              connectAuthenticatedSocket();
              // XP, streak and lesson progress follow the account.
              syncProgress();
            }
          }, 100);
        }
        if (event === "SIGNED_OUT") {
          disconnectSocket();
        }
        if (
          event === "TOKEN_REFRESHED" &&
          session?.access_token &&
          !sessionKickedRef.current
        ) {
          const currentSocket = getSocket();
          currentSocket.auth = {
            accessToken: session.access_token,
          };
          if (!currentSocket.connected) {
            currentSocket.connect();
          }
        }
      }
    );
    // =============================
    // INITIAL SESSION
    // =============================
    connectAuthenticatedSocket();
    syncProgress();
    // =============================
    // CLEANUP
    // =============================
    return () => {
      mounted = false;
      socket.off(
        "session_kicked",
        handleSessionKicked
      );
      subscription.unsubscribe();
    };
  }, []);
  return (
    <View style={styles.container}>
      {languageReady && (
      <Stack
        key={`screens-${language}`}
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: "#080808",
          },
          animation: "none",
        }}
      />
      )}
      {/* Challenges and short notices, on top of every screen */}
      {!sessionKicked && languageReady && <ChallengeHost key={`host-${language}`} />}
      {sessionKicked && (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Text style={styles.icon}>!</Text>
            </View>
            <Text style={styles.title}>
              {tr("Account active on another device")}
            </Text>
            <Text style={styles.message}>
              {tr("This account is currently being used on another device.")}
            </Text>
            <Text style={styles.message}>
              {tr("An account cannot be used on several devices at the same time.")}
            </Text>
            <Text style={styles.instruction}>
              {tr("Close the app completely on the other device. After that you can use this account here again.")}
            </Text>
            <View style={styles.status}>
              <ActivityIndicator size="small" />
              <Text style={styles.statusText}>
                {tr("This session is locked")}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080808",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#080808",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#111111",
    borderRadius: 24,
    paddingHorizontal: 26,
    paddingVertical: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#242424",
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#1d1d1d",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  icon: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
  },
  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 16,
  },
  message: {
    color: "#b5b5b5",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 10,
  },
  instruction: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 26,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#242424",
    width: "100%",
  },
  statusText: {
    color: "#777777",
    fontSize: 13,
    marginLeft: 9,
  },
});