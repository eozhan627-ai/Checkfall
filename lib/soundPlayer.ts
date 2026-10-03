// Plays the sound files on Android and iOS (package "expo-audio").
//
// The package contains native code. Until it is installed and the app has
// been built again, nothing is played - the app works the same, just silent.
// The web version has its own file (soundPlayer.web.ts).

import { requireOptionalNativeModule } from "expo";
import { log } from "./log";
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

type Player = {
    play: () => void;
    seekTo: (seconds: number) => Promise<void> | void;
};

type AudioModule = {
    createAudioPlayer: (source: number) => Player;
    setAudioModeAsync?: (mode: Record<string, unknown>) => Promise<void>;
};

let cachedModule: AudioModule | null | undefined;
const players = new Map<string, Player>();

function loadModule(): AudioModule | null {
    if (cachedModule !== undefined) return cachedModule;

    // Built before the package was added (or Expo Go without it): loading it
    // would throw, so check for the native part first.
    if (!requireOptionalNativeModule("ExpoAudio")) {
        log("SOUND: expo-audio is not part of this build - no sounds");
        cachedModule = null;
        return cachedModule;
    }

    try {
        // Optional: the bundler leaves this out when the package is not installed.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        cachedModule = require("expo-audio") as AudioModule;
    } catch {
        cachedModule = null;
    }

    if (cachedModule && typeof cachedModule.createAudioPlayer !== "function") {
        cachedModule = null;
    }

    // Short effects: stay quiet when the phone is muted and do not stop the
    // player's own music.
    cachedModule
        ?.setAudioModeAsync?.({
            playsInSilentMode: false,
            interruptionMode: "mixWithOthers",
            interruptionModeAndroid: "duckOthers",
        })
        .catch(() => undefined);

    return cachedModule;
}

function playerFor(name: SoundName, version: number): { player: Player; fresh: boolean } | null {
    const audio = loadModule();
    if (!audio) return null;

    const key = `${name}:${version}`;
    const existing = players.get(key);
    if (existing) return { player: existing, fresh: false };

    const player = audio.createAudioPlayer(FILES[name][version]);
    players.set(key, player);
    return { player, fresh: true };
}

export function soundsAvailable(): boolean {
    return loadModule() !== null;
}

// Loads all files once, so the first move does not come late.
export function preloadSounds() {
    try {
        for (const name of Object.keys(FILES) as SoundName[]) {
            FILES[name].forEach((_, version) => playerFor(name, version));
        }
    } catch (error) {
        log("SOUND PRELOAD ERROR:", error);
    }
}

export function playFile(name: SoundName) {
    try {
        const entry = playerFor(name, pickVersion(name));
        if (!entry) return;

        if (entry.fresh) {
            entry.player.play();
            return;
        }

        // Played before: back to the start first.
        Promise.resolve(entry.player.seekTo(0))
            .catch(() => undefined)
            .then(() => entry.player.play());
    } catch (error) {
        log("SOUND ERROR:", name, error);
    }
}
