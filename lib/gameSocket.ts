import { getSocket } from "./socket";

// =============================
// Aktionen
// =============================
export const resignGame = (roomId: string, myName: string, myAvatar: string) => {
  const socket = getSocket();
  console.log("➡️ resign sent", roomId);
  socket.emit("resign", { roomId });
};

export const offerDraw = (roomId: string, myName: string, myAvatar: string) => {
  const socket = getSocket();
  socket.emit("offer_draw", { roomId });
};

export const answerDraw = (roomId: string, accept: boolean, myName: string, myAvatar: string) => {
  const socket = getSocket();
  socket.emit("answer_draw", { roomId, accept });
};

// =============================
// Listener
// =============================
export const onDrawOffer = (cb: () => void, myName: string, myAvatar: string): (() => void) => {
  const socket = getSocket();
  socket.on("draw_offer", cb);

  return () => {
    socket.off("draw_offer", cb);
  };
};

export type GameOverData = { type: "resign" | "draw"; winner?: string };

export const onGameOver = (cb: (data: GameOverData) => void, myName: string, myAvatar: string): (() => void) => {
  const socket = getSocket();
  socket.on("game_over", cb);

  return () => {
    socket.off("game_over", cb);
  };
};