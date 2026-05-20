import { router } from 'expo-router';
import React from 'react';
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function MoreScreen() {
    const backgroundImage = require('../../assets/images/menubackground.png');
    return (
        <ImageBackground
            source={backgroundImage}
            style={styles.container}
            resizeMode="cover"
        >
            <View style={styles.lists}>
                <TouchableOpacity
                    style={styles.list}
                    onPress={() => router.push('/profile')}
                >
                    <Text style={styles.listTitle}>Profil</Text>

                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.list}
                    onPress={() => router.push('/settings/Hilfe')}
                >
                    <Text style={styles.listTitle}>Hilfe</Text>

                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.list}
                    onPress={() => router.push('/agbdatenschutz')}
                >
                    <Text style={styles.listTitle}>AGB und Datenschutzerklärung</Text>

                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.list}
                    onPress={() => router.push('/settings/Impressum')}
                >
                    <Text style={styles.listTitle}>Impressum</Text>

                </TouchableOpacity>



            </View>

        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,

    },


    lists: {
        paddingHorizontal: 16,
        marginTop: 45,
        gap: 12,

    },

    listTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    list: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: 18,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    title: {
        fontSize: 23,
        fontWeight: 'bold',

    },
}); 