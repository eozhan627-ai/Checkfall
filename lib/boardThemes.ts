// Board designs and the coins that buy them.
// Pure rules without storage, so they can be tested (tests/shop.test.mjs).
// Storage is in lib/shop.ts.

export type BoardTheme = {
    id: string;
    /** English name; shown through tr(). */
    name: string;
    light: string;
    dark: string;
    /** Price in coins; 0 = everybody has it. */
    price: number;
};

export const BOARD_THEMES: BoardTheme[] = [
    { id: "classic", name: "Classic", light: "#e7d5b7", dark: "#b58863", price: 0 },
    { id: "forest", name: "Forest", light: "#e9edcc", dark: "#6f8f57", price: 200 },
    { id: "ocean", name: "Ocean", light: "#dee3e6", dark: "#5d86a8", price: 200 },
    { id: "walnut", name: "Walnut", light: "#dcc3a0", dark: "#7a4f32", price: 300 },
    { id: "rose", name: "Rose", light: "#f3dcd8", dark: "#b5727a", price: 300 },
    { id: "marble", name: "Marble", light: "#eceae5", dark: "#9c9b97", price: 400 },
    { id: "night", name: "Night", light: "#a9b0bb", dark: "#4a5262", price: 400 },
    { id: "ice", name: "Ice", light: "#e8f4fb", dark: "#8fb8d6", price: 500 },
    { id: "amethyst", name: "Amethyst", light: "#e5dcf0", dark: "#8467a8", price: 500 },
    { id: "gold", name: "Gold", light: "#f1e2a8", dark: "#b8943a", price: 800 },
];

export const DEFAULT_BOARD_THEME = BOARD_THEMES[0];

export function boardThemeById(id: string | null | undefined): BoardTheme {
    return BOARD_THEMES.find((theme) => theme.id === id) ?? DEFAULT_BOARD_THEME;
}

/**
 * What a player owns. Only two things are stored: all coins ever earned and
 * the list of bought designs. The balance follows from them - so combining
 * the data of two devices can never create coins.
 */
export type ShopState = {
    coinsEarned: number;
    owned: string[];
    /** The design in use. */
    boardTheme: string;
};

export const EMPTY_SHOP: ShopState = { coinsEarned: 0, owned: [], boardTheme: DEFAULT_BOARD_THEME.id };

const known = (id: unknown): id is string => typeof id === "string" && BOARD_THEMES.some((theme) => theme.id === id);

/** Accepts anything (stored JSON) and returns a valid state. */
export function normalizeShop(raw: unknown): ShopState {
    const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const earned = source.coinsEarned;
    const owned = Array.isArray(source.owned) ? Array.from(new Set(source.owned.filter(known))) : [];
    const state: ShopState = {
        coinsEarned: typeof earned === "number" && Number.isFinite(earned) && earned > 0 ? Math.floor(earned) : 0,
        owned: owned.filter((id) => boardThemeById(id).price > 0).sort(),
        boardTheme: DEFAULT_BOARD_THEME.id,
    };

    // A design that is not owned cannot be in use.
    if (known(source.boardTheme) && ownsTheme(state, source.boardTheme)) state.boardTheme = source.boardTheme;

    return state;
}

export function ownsTheme(state: ShopState, id: string): boolean {
    return boardThemeById(id).price === 0 || state.owned.includes(id);
}

export function coinsSpent(state: ShopState): number {
    return state.owned.reduce((sum, id) => sum + boardThemeById(id).price, 0);
}

export function coinBalance(state: ShopState): number {
    return Math.max(0, state.coinsEarned - coinsSpent(state));
}

export type BuyResult =
    | { ok: true; state: ShopState }
    | { ok: false; reason: "unknown" | "owned" | "coins"; missing?: number };

/** Buys a design and puts it on the board. */
export function buyTheme(state: ShopState, id: string): BuyResult {
    if (!known(id)) return { ok: false, reason: "unknown" };
    if (ownsTheme(state, id)) return { ok: false, reason: "owned" };

    const price = boardThemeById(id).price;
    const balance = coinBalance(state);

    if (balance < price) return { ok: false, reason: "coins", missing: price - balance };

    return { ok: true, state: { ...state, owned: [...state.owned, id].sort(), boardTheme: id } };
}

export function selectTheme(state: ShopState, id: string): ShopState {
    return known(id) && ownsTheme(state, id) ? { ...state, boardTheme: id } : state;
}

export function addCoinsTo(state: ShopState, amount: number): ShopState {
    if (!Number.isFinite(amount) || amount <= 0) return state;
    return { ...state, coinsEarned: state.coinsEarned + Math.floor(amount) };
}
