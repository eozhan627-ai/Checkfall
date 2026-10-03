// The ad package has no web version: on the web the app always shows its own
// VIP screen with a countdown instead (see components/LimitGate.tsx).

export type AdResult = "rewarded" | "dismissed" | "unavailable";

export function adsSupported(): boolean {
    return false;
}

export function preloadRewardedAd() {}

export async function showRewardedAd(): Promise<AdResult> {
    return "unavailable";
}
