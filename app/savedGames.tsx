import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text } from 'react-native';

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
        <ScrollView
            contentContainerStyle={{ padding: 16, }}>
            <Text
                style={{
                    color: "#000",
                    fontSize: 22,
                    fontWeight: "600",
                    marginBottom: 16,
                    alignSelf: 'flex-start',
                    marginTop: 15,
                }}
            >
                Gespeicherte Spiele
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
                    Keine gespeicherten Spiele
                </Text>
            ) : (
                games.map(game => (
                    <Pressable
                        key={game.key}
                        style={{
                            padding: 12,
                            marginBottom: 8,
                            backgroundColor: '#e5e7eb',
                            borderRadius: 8,
                        }}
                        onPress={() => {
                            if (game.mode === "bot") {
                                router.push({
                                    pathname: "/PlayBot",
                                    params: { key: game.key }, // nur key, nicht das ganze JSON
                                });
                            } else {
                                router.push({
                                    pathname: "/Board",
                                    params: { savedData: JSON.stringify(game) },
                                });
                            }
                        }}
                        onLongPress={() =>
                            Alert.alert(
                                "Spiel löschen?",
                                "",
                                [
                                    { text: "Abbrechen", style: "cancel" },
                                    {
                                        text: "Löschen",
                                        style: "destructive",
                                        onPress: () => deleteGame(game.key),
                                    },
                                ]
                            )
                        }
                    >
                        <Text>
                            {game.mode === "bot" ? "🤖 Bot-Spiel" : "👥 Lokal"} –{" "}
                            {new Date(game.timestamp).toLocaleString()}
                        </Text>
                    </Pressable>
                ))
            )}
        </ScrollView>
    );
}