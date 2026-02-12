import AsyncStorage from "@react-native-async-storage/async-storage";
import 'react-native-get-random-values';
import { v4 as uuidv4 } from "uuid";

export type AccountType = {
    id: string;
    username: string;
    guest: boolean;
    avatar?: string,
};

const ACCOUNTS_KEY = "@accounts";
const CURRENT_KEY = "@current_account";

export async function saveAccount(data: { username: string; guest: boolean }): Promise<AccountType> {
    const id = uuidv4();
    const newAccount: AccountType = { id, ...data };

    const stored = await AsyncStorage.getItem(ACCOUNTS_KEY);
    const accounts: AccountType[] = stored ? JSON.parse(stored) : [];
    accounts.push(newAccount);
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));

    // direkt als aktueller Account setzen
    await AsyncStorage.setItem(CURRENT_KEY, newAccount.id);

    return newAccount;
}

export async function getAccounts(): Promise<AccountType[]> {
    const stored = await AsyncStorage.getItem(ACCOUNTS_KEY);
    return stored ? JSON.parse(stored) : [];
}

export async function getAccountById(id: string): Promise<AccountType | null> {
    const accounts = await getAccounts();
    return accounts.find(a => a.id === id) || null;
}

export async function getCurrentAccount(): Promise<AccountType | null> {
    const currentId = await AsyncStorage.getItem(CURRENT_KEY);
    if (!currentId) return null;
    return getAccountById(currentId);
}

export async function updateAccount(id: string, data: Partial<{ username: string,  avatar?:string }>) {
    const accounts = await getAccounts();
    const idx = accounts.findIndex(a => a.id === id);
    if (idx === -1) return null;

    accounts[idx] = { ...accounts[idx], ...data };
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    return accounts[idx];
}