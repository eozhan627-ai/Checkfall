// lib/gameSocket.ts
import { getSocket } from "./socket";

// =============================
// Aktionen, die du auslöst
// =============================

/**
 * Aufgeben
 */
export const resignGame = (roomId: string) => {
  const socket = getSocket();
  console.log("➡️ resign sent", roomId);
  socket.emit("resign", { roomId });
};

/**
 * Remis anbieten
 */
export const offerDraw = (roomId: string) => {
  const socket = getSocket();
  socket.emit("offer_draw", { roomId });
};

/**
 * Remis beantworten
 */
export const answerDraw = (roomId: string, accept: boolean) => {
  const socket = getSocket();
  socket.emit("answer_draw", { roomId, accept });
};

// =============================
// Listener
// =============================

/**
 * Callback für Remisangebote
 * @param cb Funktion, die ausgeführt wird, wenn ein Gegner Remis anbietet
 * @returns Cleanup-Funktion zum Entfernen des Listeners
 */
export const onDrawOffer = (cb: () => void): (() => void) => {

  const socket = getSocket();
  socket.on("draw_offer", cb);

  // Cleanup-Funktion
  const cleanup = (): void => {
    socket.off("draw_offer", cb);
  };

  return cleanup;
};

/**
 * Typ für GameOver-Event
 */
export type GameOverData = { type: "resign" | "draw"; winner?: string };

/**
 * Callback für Spielende
 * @param cb Funktion, die ausgeführt wird, wenn das Spiel vorbei ist
 * @returns Cleanup-Funktion zum Entfernen des Listeners
 */
export const onGameOver = (cb: (data: GameOverData) => void): (() => void) => {
  const socket = getSocket();
  socket.on("game_over", cb);

  // Cleanup-Funktion
  const cleanup = (): void => {
    socket.off("game_over", cb);
  };

  return cleanup;
};