// src/components/ProfileAvatar.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Standard-Figuren
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

export default function ProfileAvatar() {
    const [avatar, setAvatar] = useState(figureAvatars[0]);
    const [modalVisible, setModalVisible] = useState(false);
    // Lade gespeicherten Avatar
    useEffect(() => {
        (async () => {
            try {
                const savedKey = await AsyncStorage.getItem('userAvatar');
                if (savedKey) {
                    const saved = figureAvatars.find(a => a.key === savedKey);
                    if (saved) setAvatar(saved);
                }
            } catch (e) {
                console.log('Fehler beim Laden des Avatars:', e);
            }
        })();
    }, []);
    // Speichern des Avatars
    const saveAvatar = async (item: { key: string; image: any; color: 'white' | 'black' }) => {
        try {
            await AsyncStorage.setItem('userAvatar', item.key);
            setAvatar(item);
        } catch (e) {
            console.log('Fehler beim Speichern des Avatars:', e);
        }
    };


    return (
        <View style={styles.container}>
            <View style={styles.container}>
                <Text style={styles.text}>Profil</Text>
            </View>


            <TouchableOpacity onPress={() => setModalVisible(true)}>
                <Image source={avatar.image} style={styles.avatarImage} />
            </TouchableOpacity>


            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.title}>Wähle dein Profilbild</Text>
                        <FlatList<{ key: string; image: any; color: 'white' | 'black' }>
                            data={figureAvatars}
                            keyExtractor={(item) => item.key}
                            numColumns={3}
                            renderItem={({ item }: { item: { key: string; image: any; color: 'white' | 'black' } }) => (
                                <TouchableOpacity
                                    style={styles.figureButton}
                                    onPress={() => {
                                        saveAvatar(item);   // wir speichern jetzt das ganze Objekt
                                        setModalVisible(false);
                                    }}
                                >
                                    <Image source={item.image} style={styles.figureImage} />
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity
                            onPress={() => setModalVisible(false)}
                            style={styles.closeButton}
                        >
                            <Text style={styles.closeText}>Abbrechen </Text>
                        </TouchableOpacity>

                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginLeft: 25,
        textAlign: 'center',
    },
    avatarImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        backgroundColor: '#fff',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: '#000000aa',
    },
    modalContent: {
        margin: 20,
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        marginBottom: 10,
        fontWeight: '600',
    },
    figureButton: {
        margin: 10,
    },
    figureImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#fff',
    },
    closeButton: {
        marginTop: 15,
        paddingVertical: 8,
        paddingHorizontal: 20,
        backgroundColor: '#ddd',
        borderRadius: 8,
    },
    closeText: {
        fontSize: 16,
        color: '#333',
    },
    text: {
        fontSize: 25,
        fontWeight: 'bold',
        marginBottom: 5,
        marginTop: 20,
        alignItems: 'center',
    },
    saveButton: {
        marginTop: 15,
        paddingVertical: 8,
        paddingHorizontal: 20,
        backgroundColor: '#5d239b9b',
        borderRadius: 8,
    },
    saveText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
