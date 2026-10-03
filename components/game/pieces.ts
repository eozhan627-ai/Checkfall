import { Dimensions } from "react-native";

// Shared by the local, bot and online game screens (was copied into each).

// Board width: 90% of the window, capped so it does not get huge on
// tablets / web.
export const BOARD_SIZE = Math.min(Dimensions.get("window").width * 0.9, 520);

// How many moves can be queued up as premoves.
export const MAX_PREMOVES = 8;

export const pieces: Record<string, any> = {
    wp: require("../../assets/images/pawn_white.png"),
    wr: require("../../assets/images/rook_white.png"),
    wn: require("../../assets/images/knight_white.png"),
    wb: require("../../assets/images/bishop_white.png"),
    wq: require("../../assets/images/queen_white.png"),
    wk: require("../../assets/images/king_white.png"),
    bp: require("../../assets/images/pawn_black.png"),
    br: require("../../assets/images/rook_black.png"),
    bn: require("../../assets/images/knight_black.png"),
    bb: require("../../assets/images/bishop_black.png"),
    bq: require("../../assets/images/queen_black.png"),
    bk: require("../../assets/images/king_black.png"),
};

// chess.js piece ({ color: "w", type: "p" }) -> key in `pieces` ("wp").
export const pieceToKey = (piece: any): string | null =>
    piece ? `${piece.color}${piece.type}` : null;
