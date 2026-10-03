// Daily missions: three small goals per day that give XP and coins.
// Pure rules without storage, so they can be tested (tests/dailyTasks.test.mjs).
// Storage and XP are in lib/dailyTasks.ts.

/** Things the player does that can count towards a task. */
export type TaskEvent =
    | "game_played"
    | "game_won"
    | "puzzle_solved"
    | "daily_puzzle"
    | "lesson_done"
    | "game_reviewed";

export type TaskGroup = "play" | "train" | "learn";

export type TaskDefinition = {
    id: string;
    group: TaskGroup;
    event: TaskEvent;
    /** How often the event has to happen. */
    goal: number;
    xp: number;
    /** Needs an account (guests cannot do it). */
    accountOnly?: boolean;
};

// Every day has one task from each group. The goals fit into what a player
// without VIP can do in a day (4 puzzles plus the daily puzzle, 1 lesson,
// 1 analysis).
export const TASK_POOL: TaskDefinition[] = [
    { id: "play_1", group: "play", event: "game_played", goal: 1, xp: 60 },
    { id: "play_3", group: "play", event: "game_played", goal: 3, xp: 80 },
    { id: "win_1", group: "play", event: "game_won", goal: 1, xp: 70 },
    { id: "puzzles_5", group: "train", event: "puzzle_solved", goal: 5, xp: 70 },
    { id: "daily_puzzle", group: "train", event: "daily_puzzle", goal: 1, xp: 50 },
    { id: "lesson_1", group: "learn", event: "lesson_done", goal: 1, xp: 60 },
    { id: "review_1", group: "learn", event: "game_reviewed", goal: 1, xp: 50, accountOnly: true },
];

/** XP of a whole day: the three tasks plus the bonus for finishing all of them. */
export const DAILY_XP = 250;

/** Coins for the shop: per finished task, and extra for finishing all three. */
export const COINS_PER_TASK = 20;
export const ALL_DONE_BONUS_COINS = 40;

/** The bonus fills the day up to DAILY_XP, whichever three tasks it has. */
export function bonusXpFor(tasks: TaskDefinition[]): number {
    return Math.max(0, DAILY_XP - tasks.reduce((sum, task) => sum + task.xp, 0));
}

/** A game only counts when it was really played (half-moves). */
export const MIN_PLIES_FOR_GAME = 10;

const GROUPS: TaskGroup[] = ["play", "train", "learn"];

const pad = (n: number) => String(n).padStart(2, "0");

export function taskDayKey(now: Date = new Date()): string {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Small text hash: the same day always gives the same tasks, on every device.
function hash(text: string): number {
    let value = 2166136261;
    for (let i = 0; i < text.length; i++) {
        value ^= text.charCodeAt(i);
        value = Math.imul(value, 16777619);
    }
    // Mix once more, so neighbouring days do not give neighbouring results.
    value ^= value >>> 16;
    value = Math.imul(value, 0x85ebca6b);
    value ^= value >>> 13;
    value = Math.imul(value, 0xc2b2ae35);
    value ^= value >>> 16;
    return value >>> 0;
}

/** The three tasks of a day. */
export function tasksForDay(day: string, options: { guest?: boolean } = {}): TaskDefinition[] {
    return GROUPS.map((group) => {
        const choices = TASK_POOL.filter(
            (task) => task.group === group && !(options.guest && task.accountOnly)
        );
        return choices[hash(`${day}:${group}`) % choices.length];
    });
}

export type TaskState = {
    /** Local date, e.g. "2026-10-03". */
    date: string;
    /** How often each event happened today. */
    events: Partial<Record<TaskEvent, number>>;
    /** Tasks whose XP were already given today. */
    rewarded: string[];
    bonusRewarded: boolean;
};

/** The stored state, started fresh when a new day has begun. */
export function taskStateForToday(stored: unknown, today: string): TaskState {
    const value = (stored && typeof stored === "object" ? stored : {}) as Partial<TaskState>;

    if (value.date !== today) return { date: today, events: {}, rewarded: [], bonusRewarded: false };

    const events: Partial<Record<TaskEvent, number>> = {};
    const raw = value.events && typeof value.events === "object" ? value.events : {};

    for (const [key, count] of Object.entries(raw)) {
        if (typeof count === "number" && Number.isFinite(count) && count > 0) {
            events[key as TaskEvent] = Math.floor(count);
        }
    }

    return {
        date: today,
        events,
        rewarded: Array.isArray(value.rewarded) ? value.rewarded.filter((id) => typeof id === "string") : [],
        bonusRewarded: value.bonusRewarded === true,
    };
}

export type TaskView = TaskDefinition & {
    /** Progress towards the goal, never more than the goal. */
    progress: number;
    done: boolean;
};

export function viewTasks(state: TaskState, tasks: TaskDefinition[]): TaskView[] {
    return tasks.map((task) => {
        const progress = Math.min(task.goal, state.events[task.event] ?? 0);
        return { ...task, progress, done: progress >= task.goal };
    });
}

export type EventOutcome = {
    state: TaskState;
    /** XP earned by this event (tasks finished now, plus the bonus). */
    xpGain: number;
    /** Coins earned by this event. */
    coinGain: number;
    /** Ids of the tasks this event finished. */
    finished: string[];
    bonus: boolean;
};

/** Counts an event and works out which rewards are due. XP are given once. */
export function applyTaskEvent(
    state: TaskState,
    tasks: TaskDefinition[],
    event: TaskEvent,
    count = 1
): EventOutcome {
    const next: TaskState = {
        ...state,
        events: { ...state.events, [event]: (state.events[event] ?? 0) + Math.max(0, Math.floor(count)) },
        rewarded: [...state.rewarded],
    };

    let xpGain = 0;
    let coinGain = 0;
    const finished: string[] = [];

    for (const task of viewTasks(next, tasks)) {
        if (task.done && !next.rewarded.includes(task.id)) {
            next.rewarded.push(task.id);
            finished.push(task.id);
            xpGain += task.xp;
            coinGain += COINS_PER_TASK;
        }
    }

    const allDone = tasks.every((task) => next.rewarded.includes(task.id));
    const bonus = allDone && !next.bonusRewarded;

    if (bonus) {
        next.bonusRewarded = true;
        xpGain += bonusXpFor(tasks);
        coinGain += ALL_DONE_BONUS_COINS;
    }

    return { state: next, xpGain, coinGain, finished, bonus };
}

/** Number of half-moves in a PGN text (headers, comments and results ignored). */
export function countPlies(pgn: string | null | undefined): number {
    if (!pgn) return 0;

    return pgn
        .replace(/\[[^\]]*\]/g, " ")
        .replace(/\{[^}]*\}/g, " ")
        .split(/\s+/)
        .filter((token) => token && !/^\d+\.+$/.test(token) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token))
        .map((token) => token.replace(/^\d+\.+/, ""))
        .filter(Boolean).length;
}
