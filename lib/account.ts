import AsyncStorage from "@react-native-async-storage/async-storage";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { DEFAULT_RATING } from "./config";
import { log } from "./log";
import { supabase } from "./supabase";

export type AccountType = {
    id: string;
    username: string;
    guest: boolean;
    avatar?: string;
    rating?: number;
    authId?: string;
    clanId?: string;
    vipTier?: "none" | "silver" | "gold" | "diamond"; // GEÄNDERT (vorher isVip)
};

const ACCOUNTS_KEY = "@accounts";
const CURRENT_KEY = "@current_account";

// =============================
// SUPABASE PROFILE SYNC
// =============================
// Gäste haben keinen echten Supabase-Auth-User und werden NICHT
// synchronisiert (sie können deshalb auch nicht per Suche gefunden
// oder als Freund hinzugefügt werden). Aus demselben Grund können
// Gäste auch keinem Clan beitreten (siehe clans.ts / clanSocket.js).
//
// Only the username is written from the app. Rating, statistics, VIP tier
// and the avatar URL are owned by the game server - the app only reads them.

async function syncProfileToSupabase(account: AccountType) {
    if (account.guest || !account.authId) {
        return;
    }

    try {
        const { error } = await supabase
            .from("profiles")
            .update({
                username: account.username,
            })
            .eq("id", account.authId);

        if (error) {
            log("PROFILE SYNC ERROR:", error);
        }
    } catch (error) {
        log("PROFILE SYNC ERROR:", error);
    }
}

// =============================
// SERVER-OWNED PROFILE VALUES
// =============================
// Rating, VIP tier and avatar are decided by the server. The copy in
// AsyncStorage is only a cache for offline display.

type RemoteProfile = {
    vipTier: VipTier;
    rating: number | null;
    avatar: string | null;
};

async function fetchRemoteProfile(authId: string): Promise<RemoteProfile | null> {
    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("vip_tier, rating, avatar")
            .eq("id", authId)
            .maybeSingle();

        if (error || !data) {
            if (error) log("REMOTE PROFILE FETCH ERROR:", error);
            return null;
        }

        return {
            vipTier: (data.vip_tier as VipTier) ?? "none",
            rating: typeof data.rating === "number" ? data.rating : null,
            avatar: typeof data.avatar === "string" ? data.avatar : null,
        };
    } catch (error) {
        log("REMOTE PROFILE FETCH ERROR:", error);
        return null;
    }
}

// Writes values to the local cache only - nothing is sent to Supabase.
async function patchLocalAccount(
    id: string,
    patch: Partial<AccountType>
): Promise<AccountType | null> {
    const accounts = await getAccounts();
    const index = accounts.findIndex((account) => account.id === id);

    if (index === -1) return null;

    const updated: AccountType = { ...accounts[index], ...patch };
    accounts[index] = updated;

    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));

    return updated;
}

// Stores the rating the server sent after a game ("rating_update").
export async function setLocalRating(
    id: string,
    rating: number
): Promise<AccountType | null> {
    if (!Number.isFinite(rating)) return null;

    return patchLocalAccount(id, { rating: Math.round(rating) });
}

// =============================
// VIP TIER (live aus Supabase, nicht lokal cachen)
// =============================

export type VipTier = "none" | "silver" | "gold" | "diamond";

export async function fetchVipTier(authId: string): Promise<VipTier> {
    if (!authId) return "none";

    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("vip_tier")
            .eq("id", authId)
            .single();

        if (error) {
            log("VIP TIER FETCH ERROR:", error);
            return "none";
        }

        return (data?.vip_tier as VipTier) ?? "none";
    } catch (error) {
        log("VIP TIER FETCH ERROR:", error);
        return "none";
    }
}
// =============================
// RESET
// =============================

export async function resetStorage() {
    await AsyncStorage.clear();
}

// =============================
// SAVE ACCOUNT
// =============================

export async function saveAccount(data: {
    username: string;
    guest: boolean;
    authId?: string;
    avatar?: string;
    rating?: number;
    clanId?: string;
}): Promise<AccountType> {
    const id = data.authId || uuidv4();

    const stored = await AsyncStorage.getItem(ACCOUNTS_KEY);

    const accounts: AccountType[] = stored
        ? JSON.parse(stored)
        : [];

    // ---------------------------------
    // EXISTING ACCOUNT FINDEN
    // ---------------------------------

    const existingIndex = accounts.findIndex(
        (account) =>
            (!!data.authId &&
                account.authId === data.authId) ||
            account.id === id
    );

    // ---------------------------------
    // EXISTING ACCOUNT
    // ---------------------------------

    if (existingIndex !== -1) {
        const existing = accounts[existingIndex];

        const updated: AccountType = {
            ...existing,
            username:
                data.username || existing.username,
            guest: data.guest,
            authId:
                data.authId || existing.authId,
            avatar:
                data.avatar ?? existing.avatar,
            rating:
                data.rating ??
                existing.rating ??
                DEFAULT_RATING,
            clanId:
                data.clanId ?? existing.clanId,
        };

        accounts[existingIndex] = updated;

        await AsyncStorage.setItem(
            ACCOUNTS_KEY,
            JSON.stringify(accounts)
        );

        await AsyncStorage.setItem(
            CURRENT_KEY,
            updated.id
        );

        await syncProfileToSupabase(updated);

        return updated;
    }

    // ---------------------------------
    // NEW ACCOUNT
    // ---------------------------------

    const newAccount: AccountType = {
        id,
        username: data.username,
        guest: data.guest,
        authId: data.authId,
        avatar: data.avatar,
        rating: data.rating ?? DEFAULT_RATING,
        clanId: data.clanId,
    };

    accounts.push(newAccount);

    await AsyncStorage.setItem(
        ACCOUNTS_KEY,
        JSON.stringify(accounts)
    );

    await AsyncStorage.setItem(
        CURRENT_KEY,
        id
    );

    await syncProfileToSupabase(newAccount);

    return newAccount;
}

// =============================
// GET ALL ACCOUNTS
// =============================

export async function getAccounts(): Promise<AccountType[]> {
    try {
        const stored =
            await AsyncStorage.getItem(ACCOUNTS_KEY);

        if (!stored) {
            return [];
        }

        const accounts: AccountType[] =
            JSON.parse(stored);

        return accounts.map((account) => ({
            ...account,
            rating:
                typeof account.rating === "number"
                    ? account.rating
                    : DEFAULT_RATING,
        }));
    } catch (error) {
        log(
            "GET ACCOUNTS ERROR:",
            error
        );

        return [];
    }
}

// =============================
// GET ACCOUNT BY ID
// =============================

export async function getAccountById(
    id: string
): Promise<AccountType | null> {
    const accounts = await getAccounts();

    return (
        accounts.find(
            (account) => account.id === id
        ) || null
    );
}

// =============================
// GET ACCOUNT BY SUPABASE USER
// =============================

export async function getAccountByAuthId(
    authId: string
): Promise<AccountType | null> {
    if (!authId) {
        return null;
    }

    const accounts = await getAccounts();

    return (
        accounts.find(
            (account) =>
                account.authId === authId
        ) || null
    );
}

// =============================
// GET CURRENT ACCOUNT
// =============================

export async function getCurrentAccount(): Promise<AccountType | null> {
    try {
        // ---------------------------------
        // 1. SUPABASE SESSION PRÜFEN
        // ---------------------------------

        const {
            data: { session },
            error: sessionError,
        } = await supabase.auth.getSession();

        if (session?.user) {
            const authAccount =
                await getAccountByAuthId(
                    session.user.id
                );

            if (authAccount) {
                await AsyncStorage.setItem(
                    CURRENT_KEY,
                    authAccount.id
                );

                const remote = await fetchRemoteProfile(session.user.id);

                if (!remote) {
                    // Offline or profile not readable: fall back to the cache.
                    return { ...authAccount, vipTier: "none" };
                }

                const patch: Partial<AccountType> = {};

                if (remote.rating !== null && remote.rating !== authAccount.rating) {
                    patch.rating = remote.rating;
                }

                if (remote.avatar && remote.avatar !== authAccount.avatar) {
                    patch.avatar = remote.avatar;
                }

                const fresh =
                    Object.keys(patch).length > 0
                        ? (await patchLocalAccount(authAccount.id, patch)) ?? authAccount
                        : authAccount;

                return { ...fresh, vipTier: remote.vipTier };
            }

            return null;
        }

        // ---------------------------------
        // 2. KEINE SUPABASE SESSION
        // ---------------------------------

        const currentId =
            await AsyncStorage.getItem(
                CURRENT_KEY
            );

        if (!currentId) {
            return null;
        }

        const stored = await getAccountById(
            currentId
        );

        // An account that belongs to a login, but the login is gone (it
        // expired or was ended on another device): the user has to sign in
        // again. Without a session nothing can be saved for this account -
        // no games, no analysis, no friends.
        // (If the session could not be read at all, e.g. offline, the
        // account stays as it is.)
        if (stored && !stored.guest && stored.authId && !sessionError) {
            log("ACCOUNT: login expired, sign in again");

            await AsyncStorage.removeItem(
                CURRENT_KEY
            );

            return null;
        }

        return stored;
    } catch (error) {
        log(
            "ACCOUNT ERROR:",
            error
        );

        await AsyncStorage.removeItem(
            CURRENT_KEY
        );

        return null;
    }
}

// =============================
// UPDATE ACCOUNT
// =============================

export async function updateAccount(
    id: string,
    data: Partial<{
        username: string;
        avatar: string;
        rating: number;
        guest: boolean;
        authId: string;
        clanId: string;
    }>
): Promise<AccountType | null> {
    const accounts = await getAccounts();

    const index = accounts.findIndex(
        (account) => account.id === id
    );

    if (index === -1) {
        return null;
    }

    const updated: AccountType = {
        ...accounts[index],
        ...data,
    };

    accounts[index] = updated;

    await AsyncStorage.setItem(
        ACCOUNTS_KEY,
        JSON.stringify(accounts)
    );

    await AsyncStorage.setItem(
        CURRENT_KEY,
        updated.id
    );

    await syncProfileToSupabase(updated);

    return updated;
}

// =============================
// CLAN-ZUORDNUNG LOKAL SETZEN/LÖSCHEN
// =============================
// Wird von clans.ts nach erfolgreichem join/leave/kick aufgerufen,
// damit die App nicht bei jedem Start extra danach fragen muss.

export async function setLocalClanId(
    id: string,
    clanId: string | null
): Promise<AccountType | null> {
    return updateAccount(id, { clanId: clanId ?? undefined });
}

// =============================
// CREATE UNIQUE GUEST
// =============================

export async function createGuestAccount(): Promise<AccountType> {
    const accounts = await getAccounts();

    let number = 1;

    while (
        accounts.some(
            (account) =>
                account.username ===
                `Guest ${number}`
        )
    ) {
        number++;
    }

    return await saveAccount({
        username: `Guest ${number}`,
        guest: true,
    });
}

// =============================
// LOGOUT
// =============================

export async function logoutAccount() {
    try {
        log(
            "LOGOUT: signing out from Supabase..."
        );

        // Supabase Session beenden
        await supabase.auth.signOut();

        log(
            "LOGOUT: Supabase session removed"
        );
    } catch (error) {
        log(
            "LOGOUT SUPABASE ERROR:",
            error
        );
    }

    // Wichtig:
    // Der gespeicherte Account bleibt in @accounts!
    //
    // Dadurch können wir beim nächsten
    // Google Login anhand der authId
    // das alte Profil wiederfinden.

    await AsyncStorage.removeItem(
        CURRENT_KEY
    );

    log(
        "LOGOUT: current account removed"
    );
}