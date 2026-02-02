import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import UserAvatar from '../../app/UserAvatar';
import { socket } from '../../lib/socket';

export default function HomeScreen() {
  const router = useRouter();
  const [avatarColor, setAvatarColor] =
    useState<'white' | 'black'>('white');

  useEffect(() => {


    return () => {
      socket.off('start_game');
    };
  }, []);

  return (
    <View style={styles.container}>


      <View style={styles.header}>
        <View style={styles.side} />

        <View style={styles.centerTitle}>
          <Text style={styles.title}>Checkfall</Text>
          <Text style={styles.subtitle}>Play.Learn.Improve. </Text>
        </View>



        <TouchableOpacity
          style={[
            styles.profileBox,
            {
              borderColor: '#222',
              backgroundColor: '#fff'
            },
          ]}
          onPress={() => router.push('/profile')}
        >
          <View
            style={{
              width: 32,
              height: 32,
              overflow: 'hidden',       // wichtig, damit nichts überlappt
              backgroundColor: avatarColor === 'black' ? '#fff' : '#222',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <UserAvatar
              size={32}
              onColorChange={setAvatarColor}
            />
          </View>
        </TouchableOpacity>

      </View>



      {/* LEISTEN */}
      <View style={styles.lists}>

        {/* Daily Puzzle */}
        <TouchableOpacity style={styles.listSmall}
          onPress={() => router.push('/ComingSoon')}
        >
          <Text style={styles.listTitle}>Daily Puzzle</Text>
          <Text style={styles.listSub}>Löse ein Puzzle</Text>
        </TouchableOpacity>

        {/* Play vs Bot */}
        <TouchableOpacity style={styles.listMedium} onPress={() => router.push('/PlayBot')}>
          <Text style={styles.listTitle}>Spiele gegen einen Bot</Text>
          <Text style={styles.listSub}>Computergesteuerter Gegner</Text>
        </TouchableOpacity>




        {/* Play local*/}
        <TouchableOpacity style={styles.listMiddle}
          onPress={() => {
            router.push('/indexLG')
          }}
        >
          <Text style={styles.listTitle}>Spiele lokal</Text>
          <Text style={styles.listSub}>Auf diesem Gerät spielen</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.listMedium} onPress={() => router.push('/savedGames')}>
          <Text style={styles.listTitle}>Gespeicherte Spiele </Text>
          <Text style={styles.listSub}>Aufrufen</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.listMedium}
          onPress={() => router.push('/Spielverlauf')}>
          <Text style={styles.listTitle}>Spielverlauf </Text>
        </TouchableOpacity>


      </View>

      <TouchableOpacity
        style={styles.listBig}
        onPress={() => {
          router.push('/ComingSoon');
        }}
      >
        <Text style={styles.listBigTitle}>Spiele online</Text>
        <Text style={styles.listBigSub}>Finde einen echten Gegner</Text>
      </TouchableOpacity>
    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 30,
  },
  side: {
    width: 36,
  },
  lists: {
    paddingHorizontal: 16,
    marginTop: 20,
    gap: 8,
  },

  listSmall: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },

  listMedium: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingTop: 15,
    padding: 18,
    marginBottom: 12,
  },
  listMiddle: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  listBig: {
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 22,
    marginHorizontal: 16,
    marginTop: 'auto',
    marginBottom: 12,
  },

  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },

  listSub: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },

  listBigTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },

  listBigSub: {
    fontSize: 15,
    color: '#ccc',
    marginTop: 6,
  },
  centerTitle: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 23,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  profileBox: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',

  },
  profileInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    alignItems: 'center',
    justifyContent: 'center',
  },

  button: {
    backgroundColor: '#222',
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderRadius: 12,
    minWidth: '92%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,

  },
  myText: {
    color: '#000000ff',
    fontSize: 21,
    textAlign: 'center',
  },

  buttonText: {
    fontSize: 21,
    includeFontPadding: false,
    color: '#fff',
    textAlignVertical: 'center',
    paddingBottom: 2,
  },

  bottomBar: {
    marginTop: 'auto',
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#ddd'
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  listLarge: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },

}); 