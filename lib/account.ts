import AsyncStorage from "@react-native-async-storage/async-storage";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "./supabase";

export type AccountType = {
    id: string;
    username: string;
    guest: boolean;
    avatar?: string;
    rating?: number;
    authId?: string;
    clanId?: string; // NEU: lokal gecachte Clan-Zugehörigkeit (Quelle der Wahrheit ist die DB, siehe clans.ts)
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

async function syncProfileToSupabase(account: AccountType) {
    if (account.guest || !account.authId) {
        return;
    }

    try {
        const { error } = await supabase.from("profiles").upsert({
            id: account.authId,
            username: account.username,
            avatar: account.avatar || null,
            rating: account.rating ?? 1000,
            updated_at: new Date().toISOString(),
        });

        if (error) {
            console.log("PROFILE SYNC ERROR:", error);
        }
    } catch (error) {
        console.log("PROFILE SYNC ERROR:", error);
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
                1000,
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
        rating: data.rating ?? 1000,
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
                    : 1000,
        }));
    } catch (error) {
        console.log(
            "GET ACCOUNTS ERROR:",
            error
        );

        return [];
    }
}

// =============================
// ELO
// =============================

export function calculateElo(
    playerRating: number,
    opponentRating: number,
    result: "win" | "loss" | "draw"
) {
    const K = 32;

    const expectedScore =
        1 /
        (1 +
            Math.pow(
                10,
                (opponentRating - playerRating) / 400
            ));

    const actualScore =
        result === "win"
            ? 1
            : result === "draw"
                ? 0.5
                : 0;

    const change = Math.round(
        K * (actualScore - expectedScore)
    );

    return playerRating + change;
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
        } = await supabase.auth.getSession();

        if (session?.user) {
            const authAccount =
                await getAccountByAuthId(
                    session.user.id
                );

            if (authAccount) {
                // Sicherstellen, dass dieser
                // Account auch der aktuelle ist.
                await AsyncStorage.setItem(
                    CURRENT_KEY,
                    authAccount.id
                );

                return authAccount;
            }

            // Supabase User existiert,
            // aber lokales Profil noch nicht.
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

        return await getAccountById(
            currentId
        );
    } catch (error) {
        console.log(
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
        console.log(
            "LOGOUT: signing out from Supabase..."
        );

        // Supabase Session beenden
        await supabase.auth.signOut();

        console.log(
            "LOGOUT: Supabase session removed"
        );
    } catch (error) {
        console.log(
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

    console.log(
        "LOGOUT: current account removed"
    );
}