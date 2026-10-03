import type { Socket } from "socket.io-client";
import { emitWithAck } from "./socketAck";
import { tr } from "./i18n";

// =============================
// TYPES
// =============================

export type ClanRank = "leader" | "admin" | "member";

/** Who may join: anyone, after a request, or by invitation only. */
export type ClanJoinType = "open" | "request" | "closed";

export type ClanType = {
    id: string;
    name: string;
    tag?: string | null;
    description?: string | null;
    creator_id: string;
    created_at: string;
    join_type: ClanJoinType;
    /** Minimum rating needed to join (0 = none). */
    min_rating: number;
    badge: string;
    badge_color: string;
    member_count: number;
    max_members: number;
    /** Average rating of the clan's ten strongest members. */
    clan_rating: number;
    league: string;
    next_league: string | null;
    next_league_at: number | null;
    /** 0-1: progress towards the next league. */
    league_progress: number;
    /** Position in the clan ranking (only in lists). */
    rank?: number;
};

export type ClanMemberType = {
    user_id: string;
    rank: ClanRank;
    joined_at: string;
    online: boolean;
    inGame: boolean;
    profiles: {
        username: string;
        avatar?: string | null;
        rating?: number | null;
        last_seen_at?: string | null;
    };
};

export type ClanMessageType = {
    id: string;
    clan_id: string;
    sender_id: string | null;
    sender_username: string | null;
    type: "chat" | "system";
    message: string;
    created_at: string;
};

export type ClanInviteType = {
    id: string;
    clan_id: string;
    invited_user_id: string;
    invited_by: string;
    status: "pending" | "accepted" | "declined" | "cancelled";
    created_at: string;
    clans?: { name: string; tag?: string | null };
};

export type ClanJoinRequestType = {
    id: string;
    user_id: string;
    created_at: string;
    profile: { id: string; username: string; avatar?: string | null; rating?: number | null };
};

export type ClanSettings = {
    description?: string | null;
    tag?: string | null;
    joinType?: ClanJoinType;
    minRating?: number;
    badge?: string;
    badgeColor?: string;
};

// =============================
// LOOK
// =============================

export const CLAN_BADGES: Record<string, string> = {
    knight: "♞",
    rook: "♜",
    bishop: "♝",
    queen: "♛",
    king: "♚",
    pawn: "♟",
    crown: "♔",
    shield: "🛡",
    sword: "⚔",
    star: "★",
    flame: "🔥",
    bolt: "⚡",
};

export const CLAN_BADGE_COLORS = [
    "#5B8DB8",
    "#D4AF37",
    "#6FBF73",
    "#D9534F",
    "#9B7FD1",
    "#E8913A",
    "#3FB6C8",
    "#C0C5CE",
];

/** Leagues and the clan rating each one starts at (same as on the server). */
export const CLAN_LEAGUES: { name: string; min: number }[] = [
    { name: "Bronze", min: 0 },
    { name: "Silver", min: 1000 },
    { name: "Gold", min: 1200 },
    { name: "Platinum", min: 1400 },
    { name: "Diamond", min: 1600 },
    { name: "Master", min: 1800 },
];

export const LEAGUE_COLORS: Record<string, string> = {
    Bronze: "#B9834F",
    Silver: "#B8C0CC",
    Gold: "#D4AF37",
    Platinum: "#6FC7C0",
    Diamond: "#7CC4F0",
    Master: "#C08BEA",
};

export const JOIN_TYPE_LABEL: Record<ClanJoinType, string> = {
    get open() { return tr("Open"); },
    get request() { return tr("Request to join"); },
    get closed() { return tr("Invite only"); },
};

export const JOIN_TYPE_HINT: Record<ClanJoinType, string> = {
    get open() { return tr("Anyone who meets the rating can join right away."); },
    get request() { return tr("Players ask to join; the leader or an admin decides."); },
    get closed() { return tr("Nobody can join on their own - only by invitation."); },
};

/** Plain-language text for the error codes the server sends. */
export function clanErrorText(code: string): string {
    const map: Record<string, string> = {
        INVALID_NAME: "Please enter a valid clan name.",
        ALREADY_IN_CLAN: "You are already in a clan.",
        NAME_TAKEN: "This clan name is already taken.",
        CLAN_FULL: "This clan is already full.",
        CLAN_NOT_FOUND: "This clan no longer exists.",
        NOT_A_MEMBER: "You are not a member of this clan.",
        USER_NOT_FOUND: "This user was not found.",
        USER_ALREADY_IN_CLAN: "This user is already in a clan.",
        ALREADY_INVITED: "This user has already been invited.",
        ALREADY_REQUESTED: "You have already asked to join this clan.",
        INVITE_ONLY: "This clan can only be joined by invitation.",
        RATING_TOO_LOW: "Your rating is below this clan's minimum.",
        NOT_ALLOWED: "You do not have permission to do that.",
        CANNOT_KICK_LEADER: "The leader cannot be removed.",
        RATE_LIMITED: "Please do not send so many messages at once.",
        NOT_AUTHENTICATED: "Please sign in to use clans.",
        UPGRADE_REQUIRED: "This setting is not available on the server yet.",
        TIMEOUT: "The server did not answer. Please check your connection.",
    };

    return tr(map[code] || "Something went wrong. Please try again.");
}

// =============================
// DISCOVER
// =============================

export function listClans(socket: Socket, search = "") {
    return emitWithAck<{ clans: ClanType[] }>(socket, "list_clans", { search });
}

export function getSuggestedClans(socket: Socket) {
    return emitWithAck<{ clans: ClanType[] }>(socket, "get_suggested_clans");
}

// =============================
// CLAN VERWALTEN
// =============================

export function createClan(
    socket: Socket,
    data: { name: string } & ClanSettings
) {
    return emitWithAck<{ clan: ClanType }>(socket, "create_clan", data);
}

/** `requested` = the clan decides on requests; nothing was joined yet. */
export function joinClan(socket: Socket, clanId: string) {
    return emitWithAck<{ joined?: boolean; requested?: boolean }>(socket, "join_clan", { clanId });
}

export function leaveClan(socket: Socket, clanId: string) {
    return emitWithAck<{}>(socket, "leave_clan", { clanId });
}

export function getMyClan(socket: Socket) {
    return emitWithAck<{ clan: ClanType | null; myRank?: ClanRank }>(
        socket,
        "get_my_clan"
    );
}

export type ClanData = {
    clan: ClanType;
    members: ClanMemberType[];
    /** Empty for players who are not in the clan. */
    messages: ClanMessageType[];
    /** Open join requests - only for the leader and admins. */
    requests: ClanJoinRequestType[];
    myRank: ClanRank | null;
    myRequestPending: boolean;
};

export function getClanData(socket: Socket, clanId: string) {
    return emitWithAck<ClanData>(socket, "get_clan_data", { clanId });
}

export function getClanPresence(socket: Socket, clanId: string) {
    return emitWithAck<{ online: string[]; inGame: string[] }>(socket, "get_clan_presence", { clanId });
}

export function updateClanSettings(socket: Socket, clanId: string, settings: ClanSettings) {
    return emitWithAck<{ clan: ClanType }>(socket, "update_clan_settings", { clanId, ...settings });
}

export function joinClanRoom(socket: Socket, clanId: string) {
    return emitWithAck<{}>(socket, "join_clan_room", { clanId });
}

export function sendClanMessage(socket: Socket, clanId: string, message: string) {
    return emitWithAck<{}>(socket, "send_clan_message", { clanId, message });
}

// =============================
// EINLADUNGEN + BEITRITTSANFRAGEN
// =============================

export function inviteToClan(socket: Socket, clanId: string, username: string) {
    return emitWithAck<{ invite: ClanInviteType }>(socket, "invite_to_clan", {
        clanId,
        username,
    });
}

export function getMyInvites(socket: Socket) {
    return emitWithAck<{ invites: ClanInviteType[] }>(socket, "get_my_invites");
}

export function respondToInvite(socket: Socket, inviteId: string, accept: boolean) {
    return emitWithAck<{ clanId?: string }>(socket, "respond_clan_invite", {
        inviteId,
        accept,
    });
}

export function getMyJoinRequests(socket: Socket) {
    return emitWithAck<{ requests: { id: string; created_at: string; clan: ClanType }[] }>(
        socket,
        "get_my_join_requests"
    );
}

export function cancelJoinRequest(socket: Socket, clanId: string) {
    return emitWithAck<{}>(socket, "cancel_join_request", { clanId });
}

export function respondJoinRequest(socket: Socket, requestId: string, accept: boolean) {
    return emitWithAck<{}>(socket, "respond_join_request", { requestId, accept });
}

// =============================
// RÄNGE / ADMIN-VERWALTUNG
// =============================

export function promoteMember(socket: Socket, clanId: string, userId: string) {
    return emitWithAck<{}>(socket, "promote_member", { clanId, userId });
}

export function demoteAdmin(socket: Socket, clanId: string, userId: string) {
    return emitWithAck<{}>(socket, "demote_admin", { clanId, userId });
}

export function kickMember(socket: Socket, clanId: string, userId: string) {
    return emitWithAck<{}>(socket, "kick_member", { clanId, userId });
}

export function transferLeadership(socket: Socket, clanId: string, userId: string) {
    return emitWithAck<{}>(socket, "transfer_leadership", { clanId, userId });
}

// =============================
// REALTIME LISTENER
// =============================
// Jede on...-Funktion gibt eine Cleanup-Funktion zurück (für useEffect).

function listen<T>(event: string) {
    return (socket: Socket, cb: (data: T) => void) => {
        socket.on(event, cb as any);
        return () => {
            socket.off(event, cb as any);
        };
    };
}

export const onClanMessage = listen<ClanMessageType>("clan_message");
export const onClanMemberJoined = listen<{ userId: string; username: string }>("clan_member_joined");
export const onClanMemberLeft = listen<{ userId: string; username: string; kicked?: boolean }>("clan_member_left");
export const onClanMemberPromoted = listen<{ userId: string; username: string }>("clan_member_promoted");
export const onClanMemberDemoted = listen<{ userId: string; username: string }>("clan_member_demoted");
export const onClanInviteReceived = listen<{ invite: ClanInviteType; clanName?: string }>("clan_invite_received");
export const onKickedFromClan = listen<{ clanId: string }>("kicked_from_clan");
export const onClanPresence = listen<{ userId: string; online: boolean; inGame: boolean; lastSeenAt: string | null }>("clan_presence");
export const onClanUpdated = listen<{ clan: ClanType }>("clan_updated");
export const onClanLeaderChanged = listen<{ userId: string; previousLeaderId: string; username: string }>("clan_leader_changed");
export const onClanJoinRequestReceived = listen<{ clanId: string; request: ClanJoinRequestType }>("clan_join_request_received");
export const onClanJoinRequestAnswered = listen<{ clanId: string; clanName?: string; accepted: boolean }>("clan_join_request_answered");
