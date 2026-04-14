import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
    if (!socket) {
        socket = io("https://checkfall-server-clean-1.onrender.com", { transports: ["websocket"] });


        socket.on("connect", () => console.log("🟢 SOCKET CONNECTED", socket?.id));
        socket.on("disconnect", () => console.log("🔴 SOCKET DISCONNECTED"));
        socket.onAny((event, ...args) => console.log("📡 Event erhalten:", event, args));
    }
    return socket;
};