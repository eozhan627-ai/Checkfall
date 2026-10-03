// The shop on the device: coins, bought board designs and the design in use.
// The rules are in lib/boardThemes.ts. The state is part of the progress that
// is synced with the account (lib/progressSync.ts).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
    BoardTheme,
    BuyResult,
    EMPTY_SHOP,
    ShopState,
    addCoinsTo,
    boardThemeById,
    buyTheme as buyThemeRule,
    normalizeShop,
    selectTheme as selectThemeRule,
} from "./boardThemes";
import { log } from "./log";
import { SHOP_KEY, onShopWritten, schedulePushProgress } from "./progressSync";

let state: ShopState = EMPTY_SHOP;
let loaded: Promise<ShopState> | null = null;
const listeners = new Set<(state: ShopState) => void>();

function apply(next: ShopState) {
    state = next;
    listeners.forEach((listener) => listener(next));
}

async function read(): Promise<ShopState> {
    try {
        const raw = await AsyncStorage.getItem(SHOP_KEY);
        apply(normalizeShop(raw ? JSON.parse(raw) : null));
    } catch {
        apply(EMPTY_SHOP);
    }

    return state;
}

async function write(next: ShopState) {
    apply(next);

    try {
        await AsyncStorage.setItem(SHOP_KEY, JSON.stringify(next));
        schedulePushProgress();
    } catch (error) {
        log("SHOP SAVE ERROR:", error);
    }
}

/** Reads the stored state once; later calls return what is in memory. */
export function loadShop(): Promise<ShopState> {
    if (!loaded) loaded = read();
    return loaded;
}

// A sync with the account replaced the stored copy: read it again.
onShopWritten(() => {
    loaded = read();
});

export function getShop(): ShopState {
    return state;
}

export async function addCoins(amount: number): Promise<ShopState> {
    await loadShop();
    await write(addCoinsTo(state, amount));
    return state;
}

export async function buyTheme(id: string): Promise<BuyResult> {
    await loadShop();

    const result = buyThemeRule(state, id);
    if (result.ok) await write(result.state);

    return result;
}

export async function selectTheme(id: string): Promise<ShopState> {
    await loadShop();
    await write(selectThemeRule(state, id));
    return state;
}

/** Shop state; the component renders again when it changes. */
export function useShop(): ShopState {
    const [value, setValue] = useState<ShopState>(state);

    useEffect(() => {
        listeners.add(setValue);
        loadShop().then(setValue);

        return () => {
            listeners.delete(setValue);
        };
    }, []);

    return value;
}

/** Colours of the board design in use. */
export function useBoardTheme(): BoardTheme {
    return boardThemeById(useShop().boardTheme);
}
