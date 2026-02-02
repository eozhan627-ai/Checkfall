import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

// MUSS dieselbe Liste sein wie in ProfileAvatar
const figureAvatars: { key: string; image: any; color: 'white' | 'black' }[] = [
    { key: 'pawn_white', image: require('../assets/images/pawn_white.png'), color: 'white' },
    { key: 'rook_white', image: require('../assets/images/rook_white.png'), color: 'white' },
    { key: 'knight_white', image: require('../assets/images/knight_white.png'), color: 'white' },
    { key: 'bishop_white', image: require('../assets/images/bishop_white.png'), color: 'white' },
    { key: 'queen_white', image: require('../assets/images/queen_white.png'), color: 'white' },
    { key: 'king_white', image: require('../assets/images/king_white.png'), color: 'white' },

    { key: 'pawn_black', image: require('../assets/images/pawn_black.png'), color: 'black' },
    { key: 'rook_black', image: require('../assets/images/rook_black.png'), color: 'black' },
    { key: 'knight_black', image: require('../assets/images/knight_black.png'), color: 'black' },
    { key: 'bishop_black', image: require('../assets/images/bishop_black.png'), color: 'black' },
    { key: 'queen_black', image: require('../assets/images/queen_black.png'), color: 'black' },
];

type Props = {
    size?: number;
    onColorChange?: (color: 'white' | 'black') => void;
};


export default function UserAvatar({ size = 36, onColorChange }: Props) {
    const [avatar, setAvatar] = useState(figureAvatars[0]);


    useFocusEffect(
        useCallback(() => {
            const loadAvatar = async () => {
                const savedKey = await AsyncStorage.getItem('userAvatar');
                if (savedKey) {
                    const found = figureAvatars.find(a => a.key === savedKey);
                    if (found) {
                        setAvatar(found);
                    }
                }
            };

            loadAvatar();
        }, [])
    );


    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: avatar.color === 'black' ? '#fff' : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Image
                source={avatar.image}
                style={{
                    width: size * 0.8,
                    height: size * 0.8,
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    avatar: {
        borderWidth: 1,
        borderColor: '#333',
    },
});
