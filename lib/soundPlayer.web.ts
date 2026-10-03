// Plays the sound files in the browser. No extra package needed.

import { Asset } from "expo-asset";
import type { SoundName } from "./soundRules";

/* eslint-disable @typescript-eslint/no-require-imports */
// Several versions of a sound: one is picked at random each time, so two
// moves in a row never sound exactly the same.
const FILES: Record<SoundName, number[]> = {
    move: [
        require("../assets/sounds/move-1.wav"),
        require("../assets/sounds/move-2.wav"),
        require("../assets/sounds/move-3.wav"),
        require("../assets/sounds/move-4.wav"),
    ],
    capture: [
        require("../assets/sounds/capture-1.wav"),
        require("../assets/sounds/capture-2.wav"),
        require("../assets/sounds/capture-3.wav"),
    ],
    castle: [require("../assets/sounds/castle-1.wav"), require("../assets/sounds/castle-2.wav")],
    check: [require("../assets/sounds/check.wav")],
    checkmate: [require("../assets/sounds/checkmate.wav")],
    promotion: [require("../assets/sounds/promotion.wav")],
    premove: [require("../assets/sounds/premove.wav")],
    gameStart: [require("../assets/sounds/game-start.wav")],
    gameEnd: [require("../assets/sounds/game-end.wav")],
};
/* eslint-enable @typescript-eslint/no-require-imports */

const lastVersion = new Map<SoundName, number>();

// A random version of the sound, never the one played last.
function pickVersion(name: SoundName): number {
    const count = FILES[name].length;
    if (count === 1) return 0;

    let index = Math.floor(Math.random() * count);
    if (index === lastVersion.get(name)) index = (index + 1) % count;

    lastVersion.set(name, index);
    return index;
}

const elements = new Map<string, HTMLAudioElement>();

function elementFor(name: SoundName, version: number): HTMLAudioElement | null {
    if (typeof Audio === "undefined") return null;

    const key = `${name}:${version}`;
    let element = elements.get(key);

    if (!element) {
        element = new Audio(Asset.fromModule(FILES[name][version]).uri);
        element.preload = "auto";
        elements.set(key, element);
    }

    return element;
}

export function soundsAvailable(): boolean {
    return typeof Audio !== "undefined";
}

export function preloadSounds() {
    try {
        for (const name of Object.keys(FILES) as SoundName[]) {
            FILES[name].forEach((_, version) => elementFor(name, version));
        }
    } catch {
        // Sounds are optional.
    }
}

export function playFile(name: SoundName) {
    try {
        const element = elementFor(name, pickVersion(name));
        if (!element) return;

        element.currentTime = 0;
        // Browsers refuse sound before the first tap on the page - ignore that.
        element.play()?.catch(() => undefined);
    } catch {
        // Sounds are optional.
    }
}
