// Public profile of another player: statistics, clan and online status.

import { getCurrentAccount } from "./account";
import type { ClanRank, ClanType } from "./clans";
import { ensureSocketConnected } from "./socket";
import { emitWithAck } from "./socketAck";
import { supabase } from "./supabase";
import { tr } from "./i18n";

export type PlayerProfile = {
    id: string;
    username: string;
    avatar: string;
    rating: number;
    games_played: number;
    wins: number;
    puzzles_solved: number;
    vip_tier: "none" | "silver" | "gold" | "diamond";
    last_seen_at: string | null;
};

export type PlayerCard = {
    profile: PlayerProfile;
    clan: ClanType | null;
    clanRank: ClanRank | null;
    online: boolean;
    inGame: boolean;
};

/**
 * Loads a player's card from the game server. Falls back to the plain
 * profile from the database when the server cannot be reached (then without
 * clan and online status).
 */
export async function getPlayerCard(userId: string): Promise<PlayerCard | null> {
    try {
        const socket = await ensureSocketConnected();
        const card = await emitWithAck<PlayerCard>(socket, "get_player_profile", { userId }, 5000);
        if (card?.profile) return card;
    } catch {
        // Older server or no connection - use the database below.
    }

    const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar, rating, games_played, wins, puzzles_solved")
        .eq("id", userId)
        .maybeSingle();

    if (!data) return null;

    return {
        profile: {
            id: data.id,
            username: data.username ?? "Player",
            avatar: data.avatar ?? "",
            rating: data.rating ?? 1000,
            games_played: data.games_played ?? 0,
            wins: data.wins ?? 0,
            puzzles_solved: data.puzzles_solved ?? 0,
            vip_tier: "none",
            last_seen_at: null,
        },
        clan: null,
        clanRank: null,
        online: false,
        inGame: false,
    };
}

/** Card of the signed-in player (null for guests). */
export async function getOwnCard(): Promise<PlayerCard | null> {
    const account = await getCurrentAccount();
    if (!account?.authId || account.guest) return null;

    return getPlayerCard(account.authId);
}

/** "Online", "In a game" or "Last seen 3 h ago". */
export function presenceText(card: Pick<PlayerCard, "online" | "inGame"> & { lastSeenAt?: string | null }): string {
    if (card.inGame) return tr("In a game");
    if (card.online) return tr("Online");

    const time = card.lastSeenAt ? new Date(card.lastSeenAt).getTime() : NaN;
    if (!Number.isFinite(time)) return tr("Offline");

    const minutes = Math.max(1, Math.round((Date.now() - time) / 60000));
    if (minutes < 60) return tr("Last seen {0} min ago", minutes);

    const hours = Math.round(minutes / 60);
    if (hours < 24) return tr("Last seen {0} h ago", hours);

    const days = Math.round(hours / 24);
    return days === 1 ? tr("Last seen yesterday") : tr("Last seen {0} days ago", days);
}
