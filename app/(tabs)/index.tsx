import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AccountType, getCurrentAccount } from '../../lib/account';
import { getSocket } from '../../lib/socket';

export default function HomeScreen() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(true);
  const placeholder = require("../../assets/images/knight_black.png"); // Platzhalter-Avatar

  useFocusEffect(
    React.useCallback(() => {
      let active = true;

      (async () => {
        const acc = await getCurrentAccount();

        if (!acc) {
          router.replace('/login');
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

  useEffect(() => {
    // Nur ausführen, wenn Account geladen wurde
    if (loading) return;

    const socket = getSocket();

    // Cleanup beim Unmount
    return () => {
      socket.off('game_start');
    };
  }, [loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Lade... </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.side} />

        <View style={styles.centerTitle}>
          <Text style={styles.title}>Checkfall</Text>
          <Text style={styles.subtitle}>Play.Learn.Improve </Text>
        </View>

        <TouchableOpacity
          style={styles.profileBox}
          onPress={() => router.push('/profile')}
        >
          <Image
            source={account?.avatar ? { uri: account.avatar + '?t=' + Date.now() } : placeholder}
            style={styles.avatar}
          />
        </TouchableOpacity>
      </View>

      {/* LEISTEN */}
      <View style={styles.lists}>
        <TouchableOpacity style={styles.listSmall} onPress={() => router.push('/ComingSoon')}>
          <Text style={styles.listTitle}>Daily Puzzle</Text>
          <Text style={styles.listSub}>Löse ein Puzzle</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.listMedium} onPress={() => router.push('/PlayBot')}>
          <Text style={styles.listTitle}>Spiele gegen einen Bot</Text>
          <Text style={styles.listSub}>Computergesteuerter Gegner</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.listMiddle} onPress={() => router.push('/indexLG')}>
          <Text style={styles.listTitle}>Spiele lokal</Text>
          <Text style={styles.listSub}>Auf diesem Gerät spielen</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.listMedium} onPress={() => router.push('/savedGames')}>
          <Text style={styles.listTitle}>Gespeicherte Spiele</Text>
          <Text style={styles.listSub}>Aufrufen</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.listMedium} onPress={() => router.push('/Spielverlauf')}>
          <Text style={styles.listTitle}>Spielverlauf</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.listBig}
        onPress={() => {

          router.push({
            pathname: "/waiting",
            params: {
              name: account?.username,
              avatar: account?.avatar
            }
          });

        }}
      >
        <Text style={styles.listBigTitle}>Spiele online</Text>
        <Text style={styles.listBigSub}>Finde einen echten Gegner </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 30 },
  side: { width: 36 },
  centerTitle: { flex: 1, alignItems: 'center' },
  title: { fontSize: 23, fontWeight: 'bold' },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 20 },
  profileBox: { width: 36, height: 36, borderRadius: 6, overflow: 'hidden', backgroundColor: '#ffffff', borderColor: '#000000', borderWidth: 1 },
  avatar: { width: 36, height: 36, borderRadius: 6 },
  lists: { paddingHorizontal: 16, marginTop: 20, gap: 8 },
  listSmall: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  listMedium: { backgroundColor: '#fff', borderRadius: 14, paddingTop: 15, padding: 18, marginBottom: 12 },
  listMiddle: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 },
  listBig: { backgroundColor: '#222', borderRadius: 16, padding: 22, marginHorizontal: 16, marginTop: 'auto', marginBottom: 12 },
  listTitle: { fontSize: 18, fontWeight: '600', color: '#111' },
  listSub: { fontSize: 14, color: '#666', marginTop: 4 },
  listBigTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  listBigSub: { fontSize: 15, color: '#ccc', marginTop: 6 },
});