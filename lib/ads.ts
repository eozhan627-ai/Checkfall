// Rewarded ads (AdMob, package "react-native-google-mobile-ads").
//
// The package contains native code, so it only works in a build of the app
// that includes it - not in Expo Go and not on the web. Where it is missing,
// every function here reports "unavailable" and the app shows its own VIP
// screen with a countdown instead (see components/LimitGate.tsx).

import { Platform, TurboModuleRegistry } from "react-native";
import { ADMOB_REWARDED_UNIT } from "./config";
import { log } from "./log";

/**
 * rewarded     the ad was watched to the end
 * dismissed    the ad was closed early - no reward
 * unavailable  no ad could be shown (package missing, no ad, no network)
 */
export type AdResult = "rewarded" | "dismissed" | "unavailable";

type AdsModule = {
    default: () => { initialize: () => Promise<unknown> };
    RewardedAd: { createForAdRequest: (unitId: string, options?: Record<string, unknown>) => RewardedAdInstance };
    RewardedAdEventType: { LOADED: string; EARNED_REWARD: string };
    AdEventType: { CLOSED: string; ERROR: string };
};

type RewardedAdInstance = {
    addAdEventListener: (type: string, listener: (payload?: unknown) => void) => () => void;
    load: () => void;
    show: () => Promise<void>;
};

let cachedModule: AdsModule | null | undefined;
let initialized: Promise<unknown> | null = null;

function loadModule(): AdsModule | null {
    if (cachedModule !== undefined) return cachedModule;

    // The installed app was built before the ad package was added (or this is
    // Expo Go): the native part is missing. Loading the package would then
    // throw and show an error screen, so check first.
    if (!TurboModuleRegistry.get("RNGoogleMobileAdsModule")) {
        log("ADS: native module missing - build the app again to get real ads");
        cachedModule = null;
        return cachedModule;
    }

    try {
        // Optional: the bundler leaves this out when the package is not installed.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        cachedModule = require("react-native-google-mobile-ads") as AdsModule;
    } catch {
        cachedModule = null;
    }

    // Installed as a package, but this build has no native part (Expo Go).
    if (cachedModule && typeof cachedModule.RewardedAd?.createForAdRequest !== "function") {
        cachedModule = null;
    }

    return cachedModule;
}

function unitId(): string | null {
    if (Platform.OS === "android") return ADMOB_REWARDED_UNIT.android;
    if (Platform.OS === "ios") return ADMOB_REWARDED_UNIT.ios;
    return null;
}

/** True when this build of the app can show real ads. */
export function adsSupported(): boolean {
    return !!unitId() && !!loadModule();
}

function ensureInitialized(module: AdsModule) {
    if (!initialized) {
        initialized = module
            .default()
            .initialize()
            .catch((error: unknown) => log("ADS INIT ERROR:", error));
    }
    return initialized;
}

// One ad is loaded in the background so it can start without a delay.
type Loaded = { ad: RewardedAdInstance; ready: Promise<boolean> };
let preloaded: Loaded | null = null;

function startLoading(module: AdsModule, unit: string): Loaded {
    const ad = module.RewardedAd.createForAdRequest(unit);

    const ready = new Promise<boolean>((resolve) => {
        const offLoaded = ad.addAdEventListener(module.RewardedAdEventType.LOADED, () => {
            offLoaded();
            offError();
            resolve(true);
        });
        const offError = ad.addAdEventListener(module.AdEventType.ERROR, (error) => {
            log("AD LOAD ERROR:", error);
            offLoaded();
            offError();
            resolve(false);
        });
    });

    try {
        ad.load();
    } catch (error) {
        log("AD LOAD ERROR:", error);
        return { ad, ready: Promise.resolve(false) };
    }

    return { ad, ready };
}

/** Starts loading an ad. Call when it becomes likely that one is needed. */
export function preloadRewardedAd() {
    const module = loadModule();
    const unit = unitId();
    if (!module || !unit || preloaded) return;

    ensureInitialized(module);
    preloaded = startLoading(module, unit);
}

const LOAD_TIMEOUT_MS = 8000;

/** Shows a rewarded ad and reports how it ended. Never throws. */
export async function showRewardedAd(): Promise<AdResult> {
    const module = loadModule();
    const unit = unitId();
    if (!module || !unit) return "unavailable";

    try {
        await ensureInitialized(module);

        const current = preloaded ?? startLoading(module, unit);
        preloaded = null;

        const loaded = await Promise.race([
            current.ready,
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), LOAD_TIMEOUT_MS)),
        ]);

        if (!loaded) return "unavailable";

        return await new Promise<AdResult>((resolve) => {
            let earned = false;
            let settled = false;

            const finish = (result: AdResult) => {
                if (settled) return;
                settled = true;
                offEarned();
                offClosed();
                offError();
                resolve(result);
            };

            const offEarned = current.ad.addAdEventListener(module.RewardedAdEventType.EARNED_REWARD, () => {
                earned = true;
            });
            const offClosed = current.ad.addAdEventListener(module.AdEventType.CLOSED, () => {
                finish(earned ? "rewarded" : "dismissed");
            });
            const offError = current.ad.addAdEventListener(module.AdEventType.ERROR, (error) => {
                log("AD SHOW ERROR:", error);
                finish(earned ? "rewarded" : "unavailable");
            });

            current.ad.show().catch((error: unknown) => {
                log("AD SHOW ERROR:", error);
                finish("unavailable");
            });
        });
    } catch (error) {
        log("AD ERROR:", error);
        return "unavailable";
    }
}
