import http from "http";
import { Server } from "socket.io";

const server = http.createServer();
const io = new Server(server, {
    cors: { origin: "*" }
});

let waitingSocket = null;

io.on("connection", (socket) => {
    console.log("Spieler verbunden:", socket.id);

    socket.on("find_match", () => {
        console.log("find_match von", socket.id);

        if (!waitingSocket) {
            waitingSocket = socket;
            return;
        }

        const roomId = `${waitingSocket.id}_${socket.id}`;

        waitingSocket.join(roomId);
        socket.join(roomId);

        io.to(roomId).emit("game_start", {
            roomId,
            white: waitingSocket.id,
            black: socket.id
        });

        waitingSocket = null;
    });

    socket.on("disconnect", () => {
        if (waitingSocket?.id === socket.id) {
            waitingSocket = null;
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});