import { router } from 'expo-router';
import React from 'react';
import {
    ImageBackground,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function LearnScreen() {

    const backgroundImage = require('../../assets/images/lektionbackground.png');

    return (
        <ImageBackground
            source={backgroundImage}
            style={styles.container}
            resizeMode="cover"
        >
            <View style={styles.lists}>

                <TouchableOpacity
                    style={styles.list}
                    onPress={() => router.push('./learn/Tutorials')}
                >
                    <Text style={styles.listTitle}>Tutorials</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.list}
                    onPress={() => router.push('./learn/Puzzles')}
                >
                    <Text style={styles.listTitle}>Puzzles</Text>
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
        marginTop: 20,
        gap: 8,
    },

    list: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: 18,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },

    listTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
});