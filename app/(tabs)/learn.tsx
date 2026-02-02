import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function LearnScreen() {
    return (
        <View style={styles.container}>
            <View style={styles.lists}>

                <TouchableOpacity
                    style={styles.list}
                    onPress={() => router.push('/learn/Tutorials')}
                >
                    <Text style={styles.listTitle}>Tutorials</Text>

                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.list}
                    onPress={() => router.push('/learn/Puzzles')}
                >
                    <Text style={styles.listTitle}>Puzzles</Text>

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
    lists: {
        paddingHorizontal: 16,
        marginTop: 20,
        gap: 8,
    },
    listSmall: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        paddingTop: 15,
        marginBottom: 12,
        marginTop: 15,
    },
    listMedium: {
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingTop: 15,
        padding: 18,
        marginBottom: 12,
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
}); 