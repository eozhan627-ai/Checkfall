import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const SUPABASE_URL = "https://ajimdxmznvexvogzmxyc.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_F9r8itG0qJXtxrQ93nJBRg_1pmhMSns";

// Web braucht einen eigenen Storage-Adapter, weil AsyncStorage's
// Web-Implementierung beim Modul-Load auf `window` zugreift, das
// während des Metro-Web-Bundlings noch nicht existiert.
const webStorage = {
    getItem: (key: string) => {
        if (typeof window === "undefined") return Promise.resolve(null);
        return Promise.resolve(window.localStorage.getItem(key));
    },
    setItem: (key: string, value: string) => {
        if (typeof window === "undefined") return Promise.resolve();
        window.localStorage.setItem(key, value);
        return Promise.resolve();
    },
    removeItem: (key: string) => {
        if (typeof window === "undefined") return Promise.resolve();
        window.localStorage.removeItem(key);
        return Promise.resolve();
    },
};

const authStorage = Platform.OS === "web" ? webStorage : AsyncStorage;

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            storage: authStorage,

            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
    }
);
