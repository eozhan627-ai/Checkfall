import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "solved_puzzles";

export async function getSolvedPuzzleIds(): Promise<string[]> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export async function getSolvedPuzzleCount(): Promise<number> {
    return (await getSolvedPuzzleIds()).length;
}

// Speichert die Puzzle-ID nur einmal, damit ein erneut gelöstes Puzzle nicht doppelt zählt.
export async function markPuzzleSolved(id: string): Promise<number> {
    const ids = await getSolvedPuzzleIds();
    if (ids.includes(id)) return ids.length;
    ids.push(id);
    try {
        await AsyncStorage.setItem(KEY, JSON.stringify(ids));
    } catch (error) {
        console.log("PUZZLE STATS ERROR:", error);
    }
    return ids.length;
}