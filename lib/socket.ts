import { io, Socket } from "socket.io-client";
import { supabase } from "./supabase";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
    if (!socket) {
        socket = io(
            "https://checkfall-server-clean-1.onrender.com",
            {
                transports: ["websocket"],
                autoConnect: false,
            }
        );

        socket.on("connect", async () => {
            console.log(
                "🟢 SOCKET CONNECTED",
                socket?.id
            );

            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (session?.user?.id) {
                socket?.emit("authenticate_socket", {
                    authId: session.user.id,
                });

                console.log(
                    "🔐 SOCKET AUTH SENT:",
                    session.user.id
                );
            }
        });

        socket.on("disconnect", (reason) => {
            console.log(
                "🔴 SOCKET DISCONNECTED:",
                reason
            );
        });

        socket.onAny((event, ...args) => {
            console.log(
                "📡 Event erhalten:",
                event,
                args
            );
        });

        // =================================
        // SESSION KICK
        // =================================

        socket.on(
            "session_kicked",
            async (data) => {
                console.log(
                    "⚠️ SESSION KICKED:",
                    data
                );

                try {
                    await supabase.auth.signOut();
                } catch (error) {
                    console.log(
                        "SESSION KICK SIGNOUT ERROR:",
                        error
                    );
                }

                if (socket?.connected) {
                    socket.disconnect();
                }
            }
        );
    }

    return socket;
};

// =================================
// AUTHENTICATED SOCKET CONNECT
// =================================

export async function connectAuthenticatedSocket() {
    const currentSocket = getSocket();

    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
        console.log(
            "SOCKET: no authenticated session"
        );

        if (currentSocket.connected) {
            currentSocket.disconnect();
        }

        return;
    }

    console.log(
        "SOCKET: connecting authenticated user..."
    );

    currentSocket.auth = {
        accessToken: session.access_token,
    };

    if (!currentSocket.connected) {
        currentSocket.connect();
    }
}

// =================================
// DISCONNECT
// =================================

export function disconnectSocket() {
    if (socket) {
        console.log(
            "SOCKET: disconnecting..."
        );

        socket.disconnect();
    }
}