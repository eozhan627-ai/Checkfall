import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ajimdxmznvexvogzmxyc.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_F9r8itG0qJXtxrQ93nJBRg_1pmhMSns";

// true beim statischen Rendern in Node (kein window),
// false im echten Browser
const isServer = typeof window === "undefined";

// Platzhalter-Transport nur für den Server-Render, damit Node 20
// nicht wegen fehlendem WebSocket abbricht. Wird nie benutzt.
class NoopTransport {}

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            autoRefreshToken: !isServer,
            persistSession: !isServer,
            detectSessionInUrl: !isServer,
        },
        realtime: isServer
            ? { transport: NoopTransport as any }
            : undefined,
    }
);