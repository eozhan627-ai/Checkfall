import { useRouter } from "expo-router";
import React from "react";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

/**
 * Gleiche Outline-Icon-Logik wie im HomeScreen (reine Views, kein SVG).
 * Empfehlung: diese Komponente in z.B. lib/icons.tsx auslagern, damit sie
 * nicht in jedem Screen dupliziert werden muss.
 */
type IconName = "person" | "rook" | "chat" | "trophy" | "chevron";

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
    case "person":
      return (
        <View style={{ width: s, height: s, alignItems: "center", justifyContent: "center" }}>
          <View
            style={{
              width: s * 0.36,
              height: s * 0.36,
              borderRadius: (s * 0.36) / 2,
              borderWidth: 1.5,
              borderColor: color,
              marginBottom: 2,
            }}
          />
          <View
            style={{
              width: s * 0.62,
              height: s * 0.32,
              borderWidth: 1.5,
              borderColor: color,
              borderTopLeftRadius: s * 0.3,
              borderTopRightRadius: s * 0.3,
              borderBottomWidth: 0,
            }}
          />
        </View>
      );

    case "rook":
      return (
        <View style={{ width: s, height: s, alignItems: "center", justifyContent: "center" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", width: s * 0.6, marginBottom: 1 }}>
            <View style={{ width: 1.5, height: s * 0.16, backgroundColor: color }} />
            <View style={{ width: 1.5, height: s * 0.16, backgroundColor: color }} />
            <View style={{ width: 1.5, height: s * 0.16, backgroundColor: color }} />
          </View>
          <View style={{ width: s * 0.6, height: s * 0.4, borderWidth: 1.5, borderColor: color, borderRadius: 2 }} />
          <View style={{ width: s * 0.75, height: 1.5, backgroundColor: color, marginTop: 2 }} />
        </View>
      );

    case "chat":
      return (
        <View style={{ width: s, height: s, alignItems: "center", justifyContent: "center" }}>
          <View
            style={{
              width: s * 0.78,
              height: s * 0.52,
              borderWidth: 1.5,
              borderColor: color,
              borderRadius: 6,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: s * 0.14,
            }}
          >
            <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color }} />
            <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color }} />
            <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color }} />
          </View>
          <View
            style={{
              width: s * 0.18,
              height: s * 0.18,
              borderLeftWidth: 1.5,
              borderBottomWidth: 1.5,
              borderColor: color,
              alignSelf: "flex-start",
              marginLeft: s * 0.2,
              marginTop: -1,
              transform: [{ rotate: "-45deg" }],
            }}
          />
        </View>
      );

    case "trophy":
      return (
        <View style={{ width: s, height: s, alignItems: "center", justifyContent: "center" }}>
          <View
            style={{
              width: s * 0.5,
              height: s * 0.4,
              borderWidth: 1.5,
              borderColor: color,
              borderBottomWidth: 0,
              borderTopLeftRadius: 3,
              borderTopRightRadius: 3,
            }}
          />
          <View style={{ width: s * 0.16, height: s * 0.22, borderWidth: 1.5, borderColor: color, borderTopWidth: 0 }} />
          <View style={{ width: s * 0.5, height: 1.5, backgroundColor: color, marginTop: 2 }} />
        </View>
      );

    case "chevron":
      return (
        <View style={{ width: s, height: s, alignItems: "center", justifyContent: "center" }}>
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

function Badge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
    </View>
  );
}

export default function SocialScreen() {
  const router = useRouter();
  const backgroundImage = require("../../assets/images/loginbackground.png");

  // TODO: durch echte Werte aus State/Backend ersetzen
  const friendsOnline = 4;
  const friendRequestCount = 3;
  const clanUnreadCount = 5;

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <View style={styles.scrim} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.logo}>SOCIAL</Text>
          <Text style={styles.title}>Freunde & Clans</Text>
          <Text style={styles.subtitleText}>Verbinde dich, vergleiche dich, spiele zusammen</Text>
        </View>

        {/* HIGHLIGHT: FRIENDS ONLINE */}
        <Pressable
          onPress={() => router.push("/friends")}
          style={({ pressed }) => [styles.onlineCard, pressed && styles.pressed]}
        >
          <View style={styles.onlineContent}>
            <View style={styles.onlineTop}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>
                {friendsOnline > 0 ? `${friendsOnline} Freunde sind online` : "Niemand online gerade"}
              </Text>
            </View>

            <Text style={styles.onlineTitle}>Fordere jemanden heraus</Text>
            <Text style={styles.onlineSubtitle}>Starte eine Partie mit einem Freund</Text>
          </View>

          <View style={styles.onlineArrow}>
            <Icon name="chevron" size={16} color="#5B8DB8" />
          </View>
        </Pressable>

        {/* QUICK GRID */}
        <Text style={styles.sectionTitle}>Übersicht</Text>

        <View style={styles.quickGrid}>
          <Pressable
            onPress={() => router.push("/friends")}
            style={({ pressed }) => [styles.smallCard, pressed && styles.pressed]}
          >
            <View style={styles.iconBadge}>
              <Icon name="person" size={17} color="#EDF0F3" />
              <Badge count={friendRequestCount} />
            </View>
            <Text style={styles.smallCardTitle}>Freunde</Text>
            <Text style={styles.smallCardSubtitle}>Anfragen & Liste</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/clans")}
            style={({ pressed }) => [styles.smallCard, pressed && styles.pressed]}
          >
            <View style={styles.iconBadge}>
              <Icon name="rook" size={17} color="#EDF0F3" />
              <Badge count={clanUnreadCount} />
            </View>
            <Text style={styles.smallCardTitle}>Clan</Text>
            <Text style={styles.smallCardSubtitle}>Beitreten oder gründen</Text>
          </Pressable>

          <Pressable
            disabled
            style={[styles.smallCard, styles.cardDisabled]}
          >
            <View style={styles.iconBadge}>
              <Icon name="chat" size={17} color="#EDF0F3" />
            </View>
            <Text style={styles.smallCardTitle}>Nachrichten</Text>
            <Text style={styles.smallCardSubtitle}>Bald verfügbar</Text>
          </Pressable>

          <Pressable
            disabled
            style={[styles.smallCard, styles.cardDisabled]}
          >
            <View style={styles.iconBadge}>
              <Icon name="trophy" size={17} color="#EDF0F3" />
            </View>
            <Text style={styles.smallCardTitle}>Rangliste</Text>
            <Text style={styles.smallCardSubtitle}>Vergleich mit Freunden</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#12151B" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10, 12, 16, 0.55)" },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 40 },

  header: { marginBottom: 26 },
  logo: { color: "#5B8DB8", fontSize: 13, fontWeight: "700", letterSpacing: 1.4, marginBottom: 10 },
  title: { color: "#F5F7F9", fontSize: 28, fontWeight: "700", letterSpacing: -0.6, marginBottom: 6 },
  subtitleText: { color: "rgba(237, 240, 243, 0.5)", fontSize: 13.5 },

  onlineCard: {
    minHeight: 120,
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
  onlineContent: { flex: 1 },
  onlineTop: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#6F9E8C" },
  statusText: { color: "rgba(237, 240, 243, 0.55)", fontSize: 12.5 },
  onlineTitle: { color: "#F5F7F9", fontSize: 20, fontWeight: "700", letterSpacing: -0.4, marginBottom: 5 },
  onlineSubtitle: { color: "rgba(237, 240, 243, 0.5)", fontSize: 13, lineHeight: 18 },
  onlineArrow: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center", marginLeft: 8,
    backgroundColor: "rgba(91, 141, 184, 0.14)",
  },

  sectionTitle: { color: "rgba(237, 240, 243, 0.8)", fontSize: 16, fontWeight: "600", marginBottom: 14, paddingLeft: 2 },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  smallCard: {
    width: "48.2%", minHeight: 118, borderRadius: 18,
    paddingHorizontal: 18, paddingVertical: 18,
    backgroundColor: "#1B2027", borderWidth: 1,
    borderColor: "rgba(237, 240, 243, 0.08)", marginBottom: 12,
  },
  cardDisabled: { opacity: 0.45 },

  iconBadge: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
    backgroundColor: "rgba(237, 240, 243, 0.06)",
  },

  smallCardTitle: { color: "#F2F4F6", fontSize: 16.5, fontWeight: "600", letterSpacing: -0.2, marginBottom: 5 },
  smallCardSubtitle: { color: "rgba(237, 240, 243, 0.5)", fontSize: 12.5, lineHeight: 17 },

  pressed: { opacity: 0.72 },

  badge: {
    position: "absolute", top: -5, right: -5,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: "#C25450",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: "#1B2027",
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
});