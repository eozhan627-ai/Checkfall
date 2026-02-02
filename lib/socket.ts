import { io } from "socket.io-client";

export const socket = io("https://checkfall-server.onrender.com", {
    transports: ["websocket"],
    forceNew: true,
});

socket.on("connect", () => console.log("🟢 SOCKET CONNECTED", socket.id));
socket.on('disconnect', () => console.log('Socket DISCONNECTED'));