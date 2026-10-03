import { SERVER_URL } from "./config";
import { supabase } from "./supabase";

// HTTP calls to the game server that require a signed-in user. The server
// identifies the user from the access token, never from a user id sent by
// the app.

export class NotSignedInError extends Error {
    constructor() {
        super("NOT_SIGNED_IN");
        this.name = "NotSignedInError";
    }
}

async function getAccessToken(): Promise<string> {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new NotSignedInError();
    }

    return session.access_token;
}

async function authorizedFetch(path: string, init: RequestInit = {}) {
    const token = await getAccessToken();

    const res = await fetch(`${SERVER_URL}${path}`, {
        ...init,
        headers: {
            ...(init.headers as Record<string, string> | undefined),
            Authorization: `Bearer ${token}`,
        },
    });

    let data: any = null;
    try {
        data = await res.json();
    } catch {
        data = null;
    }

    if (!res.ok) {
        throw new Error(data?.error || `Request failed: ${res.status}`);
    }

    return data;
}

export async function uploadAvatar(formData: FormData): Promise<string> {
    // No Content-Type header on purpose: fetch sets the multipart boundary.
    const data = await authorizedFetch("/upload-avatar", {
        method: "POST",
        body: formData,
    });

    if (!data?.url) {
        throw new Error("Server returned no avatar URL");
    }

    return data.url as string;
}

export async function setInitialRating(rating: number): Promise<number> {
    const data = await authorizedFetch("/set-initial-rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
    });

    return typeof data?.rating === "number" ? data.rating : rating;
}

/**
 * Asks the game server to check the player's subscription with the store
 * and returns the plan that is active now.
 */
export async function syncVip(): Promise<"none" | "silver" | "gold" | "diamond"> {
    const data = await authorizedFetch("/vip/sync", { method: "POST" });
    return data?.tier ?? "none";
}
