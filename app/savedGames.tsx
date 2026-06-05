import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ImageBackground, Pressable, ScrollView, Text, View } from 'react-native';

type SavedGame = {
    key: string;
    fen: string;
    history: any[];
    bottomColor: 'w' | 'd';
    mode: 'local' | 'bot';
    timestamp: number;
};

export default function SavedGames() {
    const [games, setGames] = useState<SavedGame[]>([]);
    const router = useRouter();
    const backgroundImage = require("../assets/images/background.png"); // Hintergrundbild
    const loadGames = async () => {
        const keys = await AsyncStorage.getAllKeys();
        const savedKeys = keys.filter(k => k.startsWith('@saved_game_'));
        const entries = await AsyncStorage.multiGet(savedKeys);

        const list: SavedGame[] = [];

        for (const [key, value] of entries) {
            if (!value) continue;
            const parsed = JSON.parse(value);

            list.push({
                key,
                fen: parsed.fen,
                history: parsed.history,
                bottomColor: parsed.bottomColor,
                mode: parsed.mode,
                timestamp: parsed.timestamp,
            });
        }

        list.sort((a, b) => b.timestamp - a.timestamp);
        setGames(list);
    };

    useEffect(() => {
        loadGames();
    }, []);

    const deleteGame = async (key: string) => {
        await AsyncStorage.removeItem(key);
        loadGames();
    };

    return (
        <ImageBackground source={backgroundImage} style={{ flex: 1 }}>
            <ScrollView
                contentContainerStyle={{ padding: 16, }}>
                <Text
                    style={{
                        color: "#fff",
                        fontSize: 22,
                        fontWeight: "600",
                        marginBottom: 16,
                        alignSelf: 'flex-start',
                        marginTop: 15,
                    }}
                >
                    Saved games
                </Text>
                {games.length === 0 ? (
                    <Text
                        style={{
                            color: "#9ca3af",
                            textAlign: "center",
                            marginTop: 40,
                            fontSize: 14,
                        }}
                    >
                        No saved games yet.
                    </Text>
                ) : (
                    games.map(game => (
                        <View
                            key={game.key}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",

                                backgroundColor: "rgba(255,255,255,0.08)",

                                borderRadius: 14,
                                padding: 16,
                                marginBottom: 12,
                            }}
                        >
                            {/* LINKER BEREICH */}
                            <Pressable
                                style={{ flex: 1 }}
                                onPress={() => {
                                    if (game.mode === "bot") {
                                        router.push({
                                            pathname: "./bot-game",
                                            params: { key: game.key },
                                        });
                                    } else {
                                        router.push({
                                            pathname: "./Board",
                                            params: {
                                                savedData: JSON.stringify(game),
                                            },
                                        });
                                    }
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 18,
                                        fontWeight: "600",
                                        color: "#fff",
                                    }}
                                >
                                    {game.mode === "bot"
                                        ? "🤖 bot-game"
                                        : "👥 Local-game"}
                                </Text>

                                <Text
                                    style={{
                                        fontSize: 14,
                                        color: "#d4d4d4",
                                        marginTop: 4,
                                    }}
                                >
                                    {new Date(game.timestamp).toLocaleString()}
                                </Text>
                            </Pressable>

                            {/* PAPIERKORB */}
                            <Pressable
                                onPress={() =>
                                    Alert.alert(
                                        "Delete Game?",
                                        "This action cannot be undone.",
                                        [
                                            {
                                                text: "Cancel",
                                                style: "cancel",
                                            },
                                            {
                                                text: "Delete",
                                                style: "destructive",
                                                onPress: () => deleteGame(game.key),
                                            },
                                        ]
                                    )
                                }
                                style={{
                                    marginLeft: 12,
                                    padding: 8,
                                }}
                            >
                                <Text style={{ fontSize: 22 }}>
                                    🗑️
                                </Text>
                            </Pressable>
                        </View>
                    ))
                )}
            </ScrollView>
        </ImageBackground>
    );
}