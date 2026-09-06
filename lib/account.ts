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
};

const ACCOUNTS_KEY = "@accounts";
const CURRENT_KEY = "@current_account";

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

    return updated;
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