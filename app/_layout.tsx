import { Stack } from "expo-router";
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
import { supabase } from "../lib/supabase";

export default function Layout() {
  const [sessionKicked, setSessionKicked] = useState(false);
  const sessionKickedRef = useRef(false);

  // =============================
  // WEB: HINTERGRUNDBILD-FIX
  // =============================
  // React Native Web setzt flex:1 auf die Root-View, aber html/body im
  // Browser haben ohne explizite Höhe keine Referenzgröße – dadurch
  // rendert ImageBackground (z.B. auf iPad/Laptop) nur bis zur Höhe des
  // sichtbaren Inhalts statt über den ganzen Viewport. Einmaliger,
  // globaler CSS-Fix, betrifft nur Platform.OS === "web".
  useEffect(() => {
    if (Platform.OS === "web") {
      const styleId = "povcheck-web-height-fix";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
          html, body, #root, #root > div {
            height: 100%;
          }
          body {
            margin: 0;
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
      console.log(
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
        console.log(
          "AUTH EVENT:",
          event
        );
        if (!mounted) return;
        if (sessionKickedRef.current) {
          console.log(
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
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: "#080808",
          },
          animation: "none",
        }}
      />
      {sessionKicked && (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Text style={styles.icon}>!</Text>
            </View>
            <Text style={styles.title}>
              Account auf anderem Gerät aktiv
            </Text>
            <Text style={styles.message}>
              Dieser Account wird gerade auf
              einem anderen Gerät verwendet.
            </Text>
            <Text style={styles.message}>
              Ein Account kann nicht gleichzeitig
              auf mehreren Geräten verwendet werden.
            </Text>
            <Text style={styles.instruction}>
              Schließe die App auf dem anderen
              Gerät vollständig. Danach kannst du
              diesen Account hier wieder verwenden.
            </Text>
            <View style={styles.status}>
              <ActivityIndicator size="small" />
              <Text style={styles.statusText}>
                Diese Sitzung ist gesperrt
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