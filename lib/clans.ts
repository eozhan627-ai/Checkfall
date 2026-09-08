import type { Socket } from "socket.io-client";
import { supabase } from "./supabase";

// =============================
// TYPES
// =============================

export type ClanRank = "leader" | "admin" | "member";

export type ClanType = {
    id: string;
    name: string;
    tag?: string | null;
    description?: string | null;
    league: string;
    creator_id: string;
    created_at: string;
};

export type ClanPublicType = ClanType & {
    member_count: number;
};

export type ClanMemberType = {
    user_id: string;
    rank: ClanRank;
    joined_at: string;
    profiles: {
        username: string;
        avatar?: string | null;
        rating?: number | null;
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

type Ack<T> = { ok: true } & T | { ok: false; error: string };

function emitWithAck<T>(
    socket: Socket,
    event: string,
    payload: Record<string, unknown> = {}
): Promise<T> {
    return new Promise((resolve, reject) => {
        socket.emit(event, payload, (response: Ack<T>) => {
            if (response?.ok) {
                resolve(response as unknown as T);
            } else {
                reject(new Error(response?.error || "UNKNOWN_ERROR"));
            }
        });
    });
}

// =============================
// ÖFFENTLICHE CLAN-LISTE (direkt via Supabase, kein Socket nötig)
// =============================

export async function getPublicClans(): Promise<ClanPublicType[]> {
    const { data, error } = await supabase
        .from("clans_public")
        .select("*")
        .order("member_count", { ascending: false });

    if (error) {
        console.log("GET PUBLIC CLANS ERROR:", error);
        return [];
    }

    return data || [];
}

// =============================
// CLAN VERWALTEN
// =============================

export function createClan(
    socket: Socket,
    data: { name: string; tag?: string; description?: string }
) {
    return emitWithAck<{ clan: ClanType }>(socket, "create_clan", data);
}

export function joinClan(socket: Socket, clanId: string) {
    return emitWithAck<{}>(socket, "join_clan", { clanId });
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

export function getClanData(socket: Socket, clanId: string) {
    return emitWithAck<{
        clan: ClanType;
        members: ClanMemberType[];
        messages: ClanMessageType[];
    }>(socket, "get_clan_data", { clanId });
}

export function joinClanRoom(socket: Socket, clanId: string) {
    return emitWithAck<{}>(socket, "join_clan_room", { clanId });
}

export function sendClanMessage(socket: Socket, clanId: string, message: string) {
    return emitWithAck<{}>(socket, "send_clan_message", { clanId, message });
}

// =============================
// EINLADUNGEN
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

// =============================
// REALTIME LISTENER
// =============================
// Jede on...-Funktion gibt eine Cleanup-Funktion zurück (für useEffect).

export function onClanMessage(socket: Socket, cb: (msg: ClanMessageType) => void) {
    socket.on("clan_message", cb);
    return () => socket.off("clan_message", cb);
}

export function onClanMemberJoined(
    socket: Socket,
    cb: (data: { userId: string; username: string }) => void
) {
    socket.on("clan_member_joined", cb);
    return () => socket.off("clan_member_joined", cb);
}

export function onClanMemberLeft(
    socket: Socket,
    cb: (data: { userId: string; username: string; kicked?: boolean }) => void
) {
    socket.on("clan_member_left", cb);
    return () => socket.off("clan_member_left", cb);
}

export function onClanMemberPromoted(
    socket: Socket,
    cb: (data: { userId: string; username: string }) => void
) {
    socket.on("clan_member_promoted", cb);
    return () => socket.off("clan_member_promoted", cb);
}

export function onClanMemberDemoted(
    socket: Socket,
    cb: (data: { userId: string; username: string }) => void
) {
    socket.on("clan_member_demoted", cb);
    return () => socket.off("clan_member_demoted", cb);
}

export function onClanInviteReceived(
    socket: Socket,
    cb: (data: { invite: ClanInviteType; clanName?: string }) => void
) {
    socket.on("clan_invite_received", cb);
    return () => socket.off("clan_invite_received", cb);
}

export function onKickedFromClan(socket: Socket, cb: (data: { clanId: string }) => void) {
    socket.on("kicked_from_clan", cb);
    return () => socket.off("kicked_from_clan", cb);
}