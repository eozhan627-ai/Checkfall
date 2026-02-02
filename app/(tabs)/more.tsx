import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function MoreScreen() {
    return (
        <View style={styles.container}>
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

    lists: {
        paddingHorizontal: 16,
        marginTop: 20,
        gap: 12,
    },

    listTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111',
    },
    list: {
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingTop: 15,
        padding: 18,
        marginBottom: 12,
    },
    title: {
        fontSize: 23,
        fontWeight: 'bold',
    },
}); 