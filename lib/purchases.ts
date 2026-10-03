// Buying VIP: subscriptions through the store (Google Play / App Store),
// managed with RevenueCat (package "react-native-purchases").
//
// The package contains native code. Where it is missing (Expo Go, web, an
// app built before it was added) or no API key is configured, purchases are
// simply "not available" and the VIP page says so.

import { Linking, NativeModules, Platform } from "react-native";
import { REVENUECAT_API_KEY } from "./config";
import { log } from "./log";

export type PlanId = "silver" | "gold" | "diamond";

export type StorePlan = {
    id: PlanId;
    /** Price as the store shows it, e.g. "5,99 €". */
    price: string;
    /** Days of the free trial the store offers this user (0 = none). */
    trialDays: number;
    /** The store package, passed back to buyPlan(). */
    pkg: unknown;
};

export type PurchaseResult = "purchased" | "cancelled" | "failed";

const PLAN_IDS: PlanId[] = ["silver", "gold", "diamond"];

type PurchasesModule = {
    configure: (options: { apiKey: string; appUserID?: string }) => void;
    isConfigured: () => Promise<boolean>;
    logIn: (appUserID: string) => Promise<unknown>;
    getOfferings: () => Promise<{ current?: { availablePackages?: any[] } | null }>;
    purchasePackage: (pkg: any) => Promise<unknown>;
    restorePurchases: () => Promise<unknown>;
};

let cachedModule: PurchasesModule | null | undefined;
let configuredFor: string | null = null;

function apiKey(): string {
    if (Platform.OS === "android") return REVENUECAT_API_KEY.android;
    if (Platform.OS === "ios") return REVENUECAT_API_KEY.ios;
    return "";
}

function loadModule(): PurchasesModule | null {
    if (cachedModule !== undefined) return cachedModule;

    cachedModule = null;

    // Without the native part loading the package would throw.
    if (!apiKey() || !NativeModules.RNPurchases) return cachedModule;

    try {
        // Optional: the bundler leaves this out when the package is not installed.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const loaded = require("react-native-purchases");
        cachedModule = (loaded?.default ?? loaded) as PurchasesModule;
    } catch {
        cachedModule = null;
    }

    return cachedModule;
}

/** True when VIP can be bought in this build of the app. */
export function purchasesAvailable(): boolean {
    return !!loadModule();
}

/** Connects the store account with the signed-in player. */
async function ensureConfigured(authId: string): Promise<PurchasesModule | null> {
    const purchases = loadModule();
    if (!purchases) return null;

    if (configuredFor === authId) return purchases;

    if (configuredFor === null && !(await purchases.isConfigured().catch(() => false))) {
        purchases.configure({ apiKey: apiKey(), appUserID: authId });
    } else {
        await purchases.logIn(authId);
    }

    configuredFor = authId;
    return purchases;
}

/** Length of a free trial in days from what the store reports. */
export function trialDaysOf(product: any): number {
    const UNIT_DAYS: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };

    // Google Play: the free phase of the default offer.
    const free = product?.defaultOption?.freePhase?.billingPeriod;
    if (free && UNIT_DAYS[free.unit]) return Number(free.value) * UNIT_DAYS[free.unit];

    // App Store (and older Play data): an introductory price of zero.
    const intro = product?.introPrice;
    if (intro && Number(intro.price) === 0 && UNIT_DAYS[intro.periodUnit]) {
        return Number(intro.periodNumberOfUnits) * UNIT_DAYS[intro.periodUnit];
    }

    return 0;
}

/** The plans the store offers right now, with their real prices. */
export async function getStorePlans(authId: string): Promise<StorePlan[]> {
    try {
        const purchases = await ensureConfigured(authId);
        if (!purchases) return [];

        const offerings = await purchases.getOfferings();
        const packages = offerings.current?.availablePackages ?? [];

        const plans: StorePlan[] = [];

        for (const id of PLAN_IDS) {
            const pkg = packages.find((entry) => entry?.identifier === id);
            if (!pkg?.product) continue;

            plans.push({
                id,
                price: String(pkg.product.priceString ?? ""),
                trialDays: trialDaysOf(pkg.product),
                pkg,
            });
        }

        return plans;
    } catch (error) {
        log("STORE PLANS ERROR:", error);
        return [];
    }
}

/** Opens the store's purchase dialog for a plan. */
export async function buyPlan(authId: string, plan: StorePlan): Promise<PurchaseResult> {
    try {
        const purchases = await ensureConfigured(authId);
        if (!purchases) return "failed";

        await purchases.purchasePackage(plan.pkg);
        return "purchased";
    } catch (error: any) {
        if (error?.userCancelled) return "cancelled";

        log("PURCHASE ERROR:", error);
        return "failed";
    }
}

/** Finds purchases made earlier with the same store account. */
export async function restorePurchases(authId: string): Promise<boolean> {
    try {
        const purchases = await ensureConfigured(authId);
        if (!purchases) return false;

        await purchases.restorePurchases();
        return true;
    } catch (error) {
        log("RESTORE ERROR:", error);
        return false;
    }
}

/** Where a subscription is cancelled: the store's own subscription page. */
export function openSubscriptionSettings() {
    const url =
        Platform.OS === "ios"
            ? "https://apps.apple.com/account/subscriptions"
            : "https://play.google.com/store/account/subscriptions?package=com.povcheck.app";

    Linking.openURL(url).catch((error) => log("OPEN SUBSCRIPTIONS ERROR:", error));
}
