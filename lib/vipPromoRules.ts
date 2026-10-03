// When the app's own VIP pop-up may appear on the home screen.
// Pure rules without storage (tested in tests/vipPromo.test.mjs).

export type PromoState = {
    /** Local date of the first visit of the home screen, e.g. "2026-10-03". */
    firstSeen: string | null;
    /** Local date the pop-up was last shown. */
    lastShown: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(from: string, to: string): number {
    const a = Date.parse(`${from}T00:00:00Z`);
    const b = Date.parse(`${to}T00:00:00Z`);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return Infinity;

    return Math.round((b - a) / DAY_MS);
}

export function normalizePromoState(stored: unknown): PromoState {
    const value = (stored && typeof stored === "object" ? stored : {}) as Partial<PromoState>;
    const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

    return { firstSeen: date(value.firstSeen), lastShown: date(value.lastShown) };
}

/**
 * - never on the very first visit (a new player should see the app first)
 * - at most once every `everyDays` days
 * - never for players who have VIP
 */
export function shouldShowPromo(state: PromoState, today: string, everyDays: number, hasVip: boolean): boolean {
    if (hasVip) return false;
    if (!state.firstSeen) return false;
    if (!state.lastShown) return true;

    return daysBetween(state.lastShown, today) >= Math.max(1, everyDays);
}
