// Daily missions: storage on the device and the XP and coins they give.
// The rules are in lib/dailyTaskRules.ts.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCurrentAccount } from "./account";
import {
    ALL_DONE_BONUS_COINS,
    COINS_PER_TASK,
    TaskEvent,
    TaskView,
    applyTaskEvent,
    bonusXpFor,
    taskDayKey,
    taskStateForToday,
    tasksForDay,
    viewTasks,
} from "./dailyTaskRules";
import { log } from "./log";
import { addXp } from "./puzzleRewards";
import { addCoins } from "./shop";

export type { TaskEvent, TaskView } from "./dailyTaskRules";

const STORAGE_KEY = "daily_tasks_v1";

export type DailyTasks = {
    tasks: TaskView[];
    doneCount: number;
    bonusXp: number;
    bonusCoins: number;
    coinsPerTask: number;
    bonusRewarded: boolean;
};

async function readState(today: string) {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        return taskStateForToday(raw ? JSON.parse(raw) : null, today);
    } catch {
        return taskStateForToday(null, today);
    }
}

async function isGuest(): Promise<boolean> {
    try {
        const account = await getCurrentAccount();
        return !account || !!account.guest;
    } catch {
        return true;
    }
}

export async function getDailyTasks(): Promise<DailyTasks> {
    const today = taskDayKey();
    const [state, guest] = await Promise.all([readState(today), isGuest()]);
    const definitions = tasksForDay(today, { guest });
    const tasks = viewTasks(state, definitions);

    return {
        tasks,
        doneCount: tasks.filter((task) => task.done).length,
        bonusXp: bonusXpFor(definitions),
        bonusCoins: ALL_DONE_BONUS_COINS,
        coinsPerTask: COINS_PER_TASK,
        bonusRewarded: state.bonusRewarded,
    };
}

// One event after the other, so two events at the same moment (the daily
// puzzle also counts as a puzzle) do not overwrite each other.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Tells the daily tasks that something happened. Returns the XP earned by it
 * (0 when no task was finished). Never throws - tasks are a bonus.
 */
export function reportTaskEvent(event: TaskEvent, count = 1): Promise<number> {
    const run = async () => {
        try {
            const today = taskDayKey();
            const [state, guest] = await Promise.all([readState(today), isGuest()]);
            const outcome = applyTaskEvent(state, tasksForDay(today, { guest }), event, count);

            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(outcome.state));

            if (outcome.xpGain > 0) {
                await addXp(outcome.xpGain);
                await addCoins(outcome.coinGain);
                log("DAILY TASK DONE:", outcome.finished, "+", outcome.xpGain, "XP", "+", outcome.coinGain, "coins");
            }

            return outcome.xpGain;
        } catch (error) {
            log("DAILY TASK ERROR:", error);
            return 0;
        }
    };

    const result = queue.then(run, run);
    queue = result;
    return result;
}
