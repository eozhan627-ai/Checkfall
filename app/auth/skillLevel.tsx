import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getCurrentAccount, saveAccount } from "../../lib/account";
import { supabase } from "../../lib/supabase";

/**
 * Nach dem ersten Login (Google oder Gast) landet der Nutzer hier,
 * bevor es auf die Startseite geht. Die Auswahl setzt einen
 * plausiblen Start-Elo, damit das Matchmaking nicht bei 1000 rät.
 *
 * Einbindung in login.tsx: statt router.replace("/") beim allerersten
 * Login (Guest-Erstellung, neuer Google-Account, frisch restauriertes
 * Profil ohne gesetzten Skill) hierher routen:
 *   router.replace("/auth/skillLevel")
 */

type SkillLevel = {
  id: string;
  title: string;
  description: string;
  elo: number;
};

const LEVELS: SkillLevel[] = [
  {
    id: "beginner",
    title: "Absoluter Anfänger",
    description: "Ich kenne die Regeln gerade erst",
    elo: 400,
  },
  {
    id: "casual",
    title: "Gelegenheitsspieler",
    description: "Spiele ab und zu, kenne einfache Taktiken",
    elo: 700,
  },
  {
    id: "average",
    title: "Durchschnitt",
    description: "Spiele regelmäßig, kenne Eröffnungen",
    elo: 1000,
  },
  {
    id: "club",
    title: "Vereinsspieler",
    description: "Spiele im Verein oder bei Turnieren",
    elo: 1500,
  },
  {
    id: "strong",
    title: "Sehr stark",
    description: "Meisterniveau oder Titelträger",
    elo: 2000,
  },
];

export default function SkillLevelScreen() {
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backgroundImage = require("../../assets/images/loginbackground.png");

  async function handleConfirm() {
    if (!selectedId || saving) return;

    const level = LEVELS.find((l) => l.id === selectedId);
    if (!level) return;

    try {
      setSaving(true);
      setError(null);

      const account = await getCurrentAccount();
      if (!account) {
        throw new Error("No local account found.");
      }

      // Lokal speichern — gleiche Struktur wie in login.tsx bei saveAccount().
      await saveAccount({
        username: account.username,
        guest: account.guest,
        authId: account.authId,
        avatar: account.avatar,
        rating: level.elo,
        
      });

      // Nur eingeloggte (nicht-Gast) Accounts haben eine Zeile in
      // "profiles" — dort den Start-Elo mit hochschreiben.
      if (!account.guest && account.authId) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ rating: level.elo })
          .eq("id", account.authId);

        if (updateError) {
          throw updateError;
        }
      }

      router.replace("/");
    } catch (e: any) {
      console.error("SKILL LEVEL SAVE ERROR:", e);
      setError(e?.message || "Speichern fehlgeschlagen.");
      setSaving(false);
    }
  }

  return (
    <ImageBackground
      source={backgroundImage}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Wie gut spielst du?</Text>
        <Text style={styles.subtitle}>
          Das legt nur deinen Start-Elo fest — er passt sich beim Spielen
          schnell an.
        </Text>

        <View style={styles.list}>
          {LEVELS.map((level) => {
            const selected = level.id === selectedId;

            return (
              <Pressable
                key={level.id}
                onPress={() => setSelectedId(level.id)}
                style={({ pressed }) => [
                  styles.card,
                  selected && styles.cardSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{level.title}</Text>
                  <Text style={styles.cardDescription}>
                    {level.description}
                  </Text>
                </View>

                <View
                  style={[
                    styles.radio,
                    selected && styles.radioSelected,
                  ]}
                >
                  {selected && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={handleConfirm}
          disabled={!selectedId || saving}
          style={({ pressed }) => [
            styles.confirmButton,
            (!selectedId || saving) && styles.confirmButtonDisabled,
            pressed && !!selectedId && styles.pressed,
          ]}
        >
          <Text style={styles.confirmText}>
            {saving ? "Speichern..." : "Weiter"}
          </Text>
        </Pressable>
      </ScrollView>
    </ImageBackground>
  );
}

/**
 * Gleiche Palette wie der neue Homescreen (Slate Night):
 * bg #12151B · card #1B2027 · Akzent #5B8DB8
 */
const styles = StyleSheet.create({
  bg: {
    flex: 1,
    width: "100%",
    height: "100%",
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 12, 16, 0.68)",
  },

  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 60,
  },

  title: {
    color: "#F5F7F9",
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 8,
  },

  subtitle: {
    color: "rgba(237, 240, 243, 0.55)",
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 28,
    paddingHorizontal: 12,
  },

  list: {
    gap: 12,
    marginBottom: 20,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 16,

    backgroundColor: "#1B2027",

    borderWidth: 1,
    borderColor: "rgba(237, 240, 243, 0.08)",
  },

  cardSelected: {
    borderColor: "rgba(91, 141, 184, 0.55)",
    backgroundColor: "#20293380",
  },

  cardText: {
    flex: 1,
    paddingRight: 12,
  },

  cardTitle: {
    color: "#F2F4F6",
    fontSize: 15.5,
    fontWeight: "600",
    marginBottom: 3,
  },

  cardDescription: {
    color: "rgba(237, 240, 243, 0.5)",
    fontSize: 12.5,
    lineHeight: 17,
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "rgba(237, 240, 243, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },

  radioSelected: {
    borderColor: "#5B8DB8",
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#5B8DB8",
  },

  error: {
    color: "#E2726B",
    fontSize: 12.5,
    textAlign: "center",
    marginBottom: 14,
  },

  confirmButton: {
    height: 52,
    borderRadius: 15,
    backgroundColor: "#5B8DB8",
    alignItems: "center",
    justifyContent: "center",
  },

  confirmButtonDisabled: {
    opacity: 0.4,
  },

  confirmText: {
    color: "#0E1620",
    fontSize: 15,
    fontWeight: "700",
  },

  pressed: {
    opacity: 0.85,
  },
});
