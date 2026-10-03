import { io, Socket } from "socket.io-client";
import { SERVER_URL } from "./config";
import { log } from "./log";
import { supabase } from "./supabase";

let socket: Socket | null = null;

// The server refuses a connection whose access token is invalid or expired
// ("INVALID_TOKEN"). We then refresh the session once and try again.
let tokenRetryUsed = false;

export const getSocket = (): Socket => {
    if (!socket) {
        socket = io(SERVER_URL, {
            transports: ["websocket"],
            autoConnect: false,
        });

        // The server reads the user from the access token in socket.auth
        // (see connectAuthenticatedSocket). No user id is sent from here.
        socket.on("connect", () => {
            tokenRetryUsed = false;
            log("SOCKET CONNECTED", socket?.id);
        });

        socket.on("connect_error", async (error: Error) => {
            log("SOCKET CONNECT ERROR:", error?.message);

            if (error?.message !== "INVALID_TOKEN" || tokenRetryUsed) {
                return;
            }

            tokenRetryUsed = true;

            let accessToken: string | undefined;

            try {
                const { data } = await supabase.auth.refreshSession();
                accessToken = data?.session?.access_token;
            } catch (refreshError) {
                log("SOCKET TOKEN REFRESH ERROR:", refreshError);
            }

            if (!socket) return;

            socket.auth = accessToken ? { accessToken } : {};
            socket.connect();
        });

        socket.on("disconnect", (reason) => {
            log("SOCKET DISCONNECTED:", reason);
        });

        // =================================
        // SESSION KICK
        // =================================

        socket.on("session_kicked", async (data) => {
            log("SESSION KICKED:", data);

            try {
                await supabase.auth.signOut();
            } catch (error) {
                log("SESSION KICK SIGNOUT ERROR:", error);
            }

            if (socket?.connected) {
                socket.disconnect();
            }
        });
    }

    return socket;
};

async function applyCurrentToken(currentSocket: Socket): Promise<boolean> {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    currentSocket.auth = session?.access_token
        ? { accessToken: session.access_token }
        : {};

    return !!session?.access_token;
}

// =================================
// AUTHENTICATED SOCKET CONNECT
// =================================

export async function connectAuthenticatedSocket() {
    const currentSocket = getSocket();

    const signedIn = await applyCurrentToken(currentSocket);

    if (!signedIn) {
        log("SOCKET: no authenticated session");

        if (currentSocket.connected) {
            currentSocket.disconnect();
        }

        return;
    }

    if (!currentSocket.connected) {
        currentSocket.connect();
    }
}

// =================================
// CONNECT FOR GUESTS AND SIGNED-IN USERS
// =================================
// Used by screens that also work without an account (matchmaking, bot
// games). Signed-in users connect with their token, guests without one.

export async function ensureSocketConnected(): Promise<Socket> {
    const currentSocket = getSocket();

    if (!currentSocket.connected) {
        await applyCurrentToken(currentSocket);
        currentSocket.connect();
    }

    return currentSocket;
}

// =================================
// DISCONNECT
// =================================

export function disconnectSocket() {
    if (socket) {
        log("SOCKET: disconnecting...");

        // Drop the token so a later guest connection is not made with the
        // previous user's identity.
        socket.auth = {};
        socket.disconnect();
    }
}
