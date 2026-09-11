import { Chess } from "chess.js";

// Klont ein Chess-Objekt UNTER BEIBEHALTUNG der vollständigen Zughistorie.
// new Chess(fen) allein reicht nicht - das kennt nur die aktuelle Stellung,
// nicht die Züge davor, wodurch pgn() später nur den letzten Zug zeigen würde.
export function cloneWithHistory(g: Chess): Chess {
    const clone = new Chess();
    g.history({ verbose: true }).forEach((m: any) => {
        clone.move({ from: m.from, to: m.to, promotion: m.promotion });
    });
    return clone;
}