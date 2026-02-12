import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
    if (!socket) {
        socket = io("http://192.168.178.26:3000", {
            transports: ["websocket"],
        });

        // Verbindung hergestellt
        socket.on("connect", () => {
            console.log("🟢 SOCKET CONNECTED", socket?.id);
        });

        // Verbindung getrennt
        socket.on("disconnect", () => {
            console.log("🔴 SOCKET DISCONNECTED");
        });

        // Extra Debug: alle Events loggen
        socket.onAny((event, ...args) => {
            console.log("📡 Event erhalten:", event, args);
        });
    }
    return socket;
};