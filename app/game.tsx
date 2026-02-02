import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { socket } from '../lib/socket';

const initialBoard = [
    ["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"],
    ["bP", "bP", "bP", "bP", "bP", "bP", "bP", "bP"],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["wP", "wP", "wP", "wP", "wP", "wP", "wP", "wP"],
    ["wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"],
];

const pieceImages = {
    wP: require('../assets/images/pawn_white.png'),
    wR: require('../assets/images/rook_white.png'),
    wN: require('../assets/images/knight_white.png'),
    wB: require('../assets/images/bishop_white.png'),
    wQ: require('../assets/images/pawn_black.png'),
    bR: require('../assets/images/rook_black.png'),
    bN: require('../assets/images/queen_white.png'),
    wK: require('../assets/images/king_white.png'),
    bP: require('../assets/images/knight_black.png'),
    bB: require('../assets/images/bishop_black.png'),
    bQ: require('../assets/images/queen_black.png'),
    bK: require('../assets/images/king_black.png'),
};

export default function GameScreen() {
    const { roomId, white, black } = useLocalSearchParams();

    const [board, setBoard] = useState(initialBoard);
    const [myId, setMyId] = useState<string | null>(null);

    // 🔥 WICHTIG: socket.id sicher holen
    useEffect(() => {
        if (socket.id) {
            setMyId(socket.id);
        } else {
            socket.on('connect', () => {
                if (socket.id)
                    setMyId(socket.id);
            });
        }

        return () => {
            socket.off('connect');
        };
    }, []);

    // ⛔ Noch nicht ready → nichts rendern
    if (!myId) {
        return null;
    }

    const myColor = myId === white ? 'white' : 'black';

    // (nur Debug)
    console.log('MY ID:', myId);
    console.log('I AM:', myColor);
    console.log('ROOM:', roomId);

    return (
        <View style={styles.container}>
            {board.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.row}>
                    {row.map((cell, colIndex) => {
                        const isDark = (rowIndex + colIndex) % 2 === 1;

                        return (
                            <View
                                key={colIndex}
                                style={[
                                    styles.cell,
                                    { backgroundColor: isDark ? '#769656' : '#eeeed2' },
                                ]}
                            >
                                {cell !== '' && (
                                    <Image
                                        source={pieceImages[cell as keyof typeof pieceImages]}
                                        style={styles.piece}
                                    />
                                )}
                            </View>
                        );
                    })}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 10,
    },
    row: {
        flexDirection: 'row',
    },
    cell: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    piece: {
        width: 36,
        height: 36,
        resizeMode: 'contain',
    },
});