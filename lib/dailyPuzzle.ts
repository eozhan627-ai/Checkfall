import puzzles from "../assets/puzzle.json";

function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function hashString(str: string) {
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }

    return Math.abs(hash);
}

export function getDailyPuzzle() {
    const index = hashString(getTodayKey()) % puzzles.length;
    return puzzles[index];
}