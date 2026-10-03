// Keeps XP, streak, solved puzzles and lesson stars in the signed-in user's
// profile ("profiles.progress"), so they survive a reinstall or a new phone.
// Guests keep everything on the device only.
//
// Everything here is best effort: if the network or the database column is
// not available, the app simply keeps working with the local values.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { log } from "./log";
import {
    EMPTY_PROGRESS,
    mergeProgress,
    normalizeProgress,
    progressEquals,
    ProgressSnapshot,
} from "./progressMerge";
import { supabase } from "./supabase";

// Same keys as in puzzleRewards.ts / puzzleStats.ts / lessonProgress.ts.
export const REWARDS_KEY = "puzzle_rewards_v1";
export const SOLVED_PUZZLES_KEY = "solved_puzzles";
export const LESSON_PROGRESS_KEY = "lessonProgress:v1";
export const SHOP_KEY = "shop_v1";

// lib/shop.ts keeps the shop state in memory; it is told when the stored
// copy was replaced by a sync.
let shopWritten: (() => void) | null = null;

export function onShopWritten(listener: () => void) {
    shopWritten = listener;
}

// Which account the progress on this device belongs to. Prevents one
// person's progress from being merged into another account that signs in on
// the same phone.
const OWNER_KEY = "progress_owner_v1";

async function readJson(key: string): Promise<unknown> {
    try {
        const raw = await AsyncStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

async function readLocal(): Promise<ProgressSnapshot> {
    const [rewards, solvedPuzzles, lessons, shop] = await Promise.all([
        readJson(REWARDS_KEY),
        readJson(SOLVED_PUZZLES_KEY),
        readJson(LESSON_PROGRESS_KEY),
        readJson(SHOP_KEY),
    ]);

    return normalizeProgress({ rewards, solvedPuzzles, lessons, shop });
}

async function writeLocal(snapshot: ProgressSnapshot) {
    await AsyncStorage.multiSet([
        [REWARDS_KEY, JSON.stringify(snapshot.rewards)],
        [SOLVED_PUZZLES_KEY, JSON.stringify(snapshot.solvedPuzzles)],
        [LESSON_PROGRESS_KEY, JSON.stringify(snapshot.lessons)],
        [SHOP_KEY, JSON.stringify(snapshot.shop)],
    ]);

    shopWritten?.();
}

async function getSignedInUserId(): Promise<string | null> {
    try {
        const {
            data: { session },
        } = await supabase.auth.getSession();

        return session?.user?.id ?? null;
    } catch {
        return null;
    }
}

async function writeRemote(userId: string, snapshot: ProgressSnapshot) {
    const { error } = await supabase
        .from("profiles")
        .update({
            progress: snapshot,
            puzzles_solved: snapshot.solvedPuzzles.length,
        })
        .eq("id", userId);

    if (error) throw error;
}

let syncRunning: Promise<void> | null = null;

// Call after sign-in and on app start: loads the stored progress, combines
// it with what is on the device and saves the result on both sides.
export function syncProgress(): Promise<void> {
    if (syncRunning) return syncRunning;

    syncRunning = (async () => {
        try {
            const userId = await getSignedInUserId();
            if (!userId) return;

            const { data, error } = await supabase
                .from("profiles")
                .select("progress")
                .eq("id", userId)
                .maybeSingle();

            if (error) throw error;
            if (!data) return; // no profile yet (still in onboarding)

            const remote = normalizeProgress(data.progress);
            const owner = await AsyncStorage.getItem(OWNER_KEY);

            // Progress on the device belongs to another account: do not mix
            // it in, show this account's own progress instead.
            const local =
                owner && owner !== userId ? EMPTY_PROGRESS : await readLocal();

            const merged = mergeProgress(local, remote);

            await writeLocal(merged);
            await AsyncStorage.setItem(OWNER_KEY, userId);

            if (!progressEquals(merged, remote)) {
                await writeRemote(userId, merged);
            }
        } catch (error) {
            log("PROGRESS SYNC ERROR:", error);
        } finally {
            syncRunning = null;
        }
    })();

    return syncRunning;
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

// Call after progress changed on the device. Several changes in a row are
// combined into one upload.
export function schedulePushProgress() {
    if (pushTimer) clearTimeout(pushTimer);

    pushTimer = setTimeout(async () => {
        pushTimer = null;

        try {
            const userId = await getSignedInUserId();
            if (!userId) return;

            const owner = await AsyncStorage.getItem(OWNER_KEY);

            if (owner !== userId) {
                // Not merged for this account yet - do the full sync instead
                // of overwriting what is stored for it.
                await syncProgress();
                return;
            }

            await writeRemote(userId, await readLocal());
        } catch (error) {
            log("PROGRESS PUSH ERROR:", error);
        }
    }, 1500);
}
