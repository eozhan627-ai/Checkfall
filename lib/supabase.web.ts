import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

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

// Während Expo Routers statischem Web-Rendering läuft dieser Code
// kurz in echtem Node.js (ohne globales WebSocket). Nur dann geben
// wir dem Realtime-Client explizit die "ws"-Implementierung mit;
// dieses require("ws") existiert nur in dieser .web.ts-Datei und
// wird deshalb nie ins Android/iOS-Bundle aufgenommen.
const realtimeOptions: { transport?: any } = {};
if (typeof WebSocket === "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ws = require("ws");
    realtimeOptions.transport = ws;
}

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            storage: webStorage,

            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
        realtime: realtimeOptions,
    }
);