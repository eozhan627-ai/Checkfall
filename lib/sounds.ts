// Game sounds: one place for "play this sound" and the on/off setting.
// The files are made by scripts/make-sounds.py.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Chess } from "chess.js";
import { useEffect, useRef } from "react";
import { playFile, preloadSounds } from "./soundPlayer";
import { SoundName, soundForPositionChange, soundForSan } from "./soundRules";

const STORAGE_KEY = "settings:sounds";

let enabled = true;

export function isSoundEnabled(): boolean {
    return enabled;
}

// Called once when the app starts.
export async function loadSoundSetting(): Promise<boolean> {
    try {
        enabled = (await AsyncStorage.getItem(STORAGE_KEY)) !== "off";
    } catch {
        enabled = true;
    }

    if (enabled) preloadSounds();

    return enabled;
}

export async function setSoundEnabled(value: boolean) {
    enabled = value;

    if (value) preloadSounds();

    try {
        await AsyncStorage.setItem(STORAGE_KEY, value ? "on" : "off");
    } catch {
        // The setting then only lasts until the app is closed.
    }
}

export function playSound(name: SoundName) {
    if (!enabled) return;
    playFile(name);
}

/**
 * For game screens that keep the list of moves ("e4", "Nxe5+", ...):
 * plays the sound of every move that is added - the player's own, the
 * opponent's and premoves alike. Loading a whole game at once stays silent.
 */
export function useMoveSound(moves: string[]) {
    const previousCount = useRef(moves.length);

    useEffect(() => {
        if (moves.length === previousCount.current + 1) {
            playSound(soundForSan(moves[moves.length - 1]));
        }

        previousCount.current = moves.length;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [moves.length]);
}

/**
 * For boards that only hold a position (puzzles, lessons, openings):
 * plays a sound whenever the position changes by a move.
 */
export function usePositionSound(game: Chess | null | undefined) {
    const fen = game ? game.fen() : null;
    const previousFen = useRef(fen);

    useEffect(() => {
        const sound = soundForPositionChange(previousFen.current, fen, {
            check: game ? game.inCheck() : false,
            mate: game ? game.isCheckmate() : false,
        });

        previousFen.current = fen;

        if (sound) playSound(sound);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fen]);
}
