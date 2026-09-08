import { getCurrentAccount } from "./account";
import { supabase } from "./supabase";

export type FriendProfile = {
    id: string; // = Supabase authId
    username: string;
    avatar?: string | null;
    rating?: number;
};

export type FriendEntry = {
    friendshipId: string;
    profile: FriendProfile;
};

type FriendshipStatus = "none" | "pending_sent" | "pending_received" | "friends";

// =============================
// SUCHE
// =============================

export async function searchUsers(query: string): Promise<FriendProfile[]> {
    const me = await getCurrentAccount();
    const trimmed = query.trim();

    if (!me || !me.authId || trimmed.length < 2) {
        return [];
    }

    const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar, rating")
        .ilike("username", `%${trimmed}%`)
        .neq("id", me.authId)
        .limit(20);

    if (error) {
        console.log("SEARCH USERS ERROR:", error);
        return [];
    }

    return data || [];
}

// =============================
// ANFRAGE SENDEN
// =============================

export async function sendFriendRequest(targetAuthId: string): Promise<void> {
    const me = await getCurrentAccount();

    if (!me || !me.authId) {
        throw new Error("Nur mit Account möglich");
    }

    if (me.authId === targetAuthId) {
        throw new Error("Du kannst dich nicht selbst hinzufügen");
    }

    const { data: existing, error: lookupError } = await supabase
        .from("friendships")
        .select("id, status, requester_id")
        .or(
            `and(requester_id.eq.${me.authId},addressee_id.eq.${targetAuthId}),and(requester_id.eq.${targetAuthId},addressee_id.eq.${me.authId})`
        )
        .maybeSingle();

    if (lookupError) {
        throw lookupError;
    }

    if (existing) {
        throw new Error(
            existing.status === "accepted"
                ? "Ihr seid bereits befreundet"
                : "Es gibt bereits eine offene Anfrage"
        );
    }

    const { error } = await supabase.from("friendships").insert({
        requester_id: me.authId,
        addressee_id: targetAuthId,
        status: "pending",
    });

    if (error) {
        throw error;
    }
}

// =============================
// ANFRAGE ANNEHMEN / ABLEHNEN
// =============================

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
    const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", friendshipId);

    if (error) throw error;
}

export async function declineFriendRequest(friendshipId: string): Promise<void> {
    const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("id", friendshipId);

    if (error) throw error;
}

// =============================
// FREUND ENTFERNEN
// =============================

export async function removeFriend(friendshipId: string): Promise<void> {
    const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("id", friendshipId);

    if (error) throw error;
}

// =============================
// EINGEHENDE ANFRAGEN
// =============================

export async function getIncomingRequests(): Promise<FriendEntry[]> {
    const me = await getCurrentAccount();
    if (!me || !me.authId) return [];

    const { data, error } = await supabase
        .from("friendships")
        .select("id, requester:requester_id (id, username, avatar, rating)")
        .eq("addressee_id", me.authId)
        .eq("status", "pending");

    if (error) {
        console.log("GET REQUESTS ERROR:", error);
        return [];
    }

    return (data || [])
        .filter((row: any) => row.requester)
        .map((row: any) => ({
            friendshipId: row.id,
            profile: row.requester,
        }));
}

// =============================
// FREUNDESLISTE
// =============================

export async function getFriends(): Promise<FriendEntry[]> {
    const me = await getCurrentAccount();
    if (!me || !me.authId) return [];

    const { data, error } = await supabase
        .from("friendships")
        .select(
            "id, requester_id, addressee_id, requester:requester_id (id, username, avatar, rating), addressee:addressee_id (id, username, avatar, rating)"
        )
        .eq("status", "accepted")
        .or(`requester_id.eq.${me.authId},addressee_id.eq.${me.authId}`);

    if (error) {
        console.log("GET FRIENDS ERROR:", error);
        return [];
    }

    return (data || [])
        .map((row: any) => ({
            friendshipId: row.id,
            profile: row.requester_id === me.authId ? row.addressee : row.requester,
        }))
        .filter((entry) => entry.profile);
}

// =============================
// STATUS ZU EINEM EINZELNEN NUTZER
// (für den "Freund hinzufügen"-Button im Spiel)
// =============================

export async function getFriendshipStatusWith(
    targetAuthId: string
): Promise<FriendshipStatus> {
    const me = await getCurrentAccount();
    if (!me || !me.authId || !targetAuthId) return "none";
    if (me.authId === targetAuthId) return "none";

    const { data, error } = await supabase
        .from("friendships")
        .select("status, requester_id")
        .or(
            `and(requester_id.eq.${me.authId},addressee_id.eq.${targetAuthId}),and(requester_id.eq.${targetAuthId},addressee_id.eq.${me.authId})`
        )
        .maybeSingle();

    if (error || !data) return "none";
    if (data.status === "accepted") return "friends";

    return data.requester_id === me.authId ? "pending_sent" : "pending_received";
}