import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.myText}>Play </Text>


        </TouchableOpacity>
      </View>

    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',

    backgroundColor: '#f0f0f0',

  },
  title: {
    fontSize: 24,
    marginBottom: 20,
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
  buttonText: {
    color: '#000000ff',
    fontSize: 21,
    textAlign: 'center',
  },

  myText: {
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
});
