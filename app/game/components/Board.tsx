import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Image,
    PanResponder,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

const toSquare = (r: number, c: number) => `${FILES[c]}${8 - r}`;

// Feld ("e4") -> Zeile/Spalte im angezeigten Brett (abhängig von der Brett-Orientierung)
const squareToRC = (square: string, myColor: string) => {
    const f = FILES.indexOf(square[0]);
    const rank = parseInt(square[1], 10);
    return myColor === "w"
        ? { r: 8 - rank, c: f }
        : { r: rank - 1, c: 7 - f };
};

// Deine Scale/Offset-Werte, nur ausgelagert, damit Brett und Drag-Figur gleich aussehen
const PIECE_SCALE: Record<string, number> = {
    wp: 1.35, wn: 1.55, wb: 1.7, wr: 1.65, wq: 1.55, wk: 1.3,
    bp: 1.3, bn: 1.2, bb: 1.3, br: 1.15, bq: 1.25, bk: 1.15,
};
const PIECE_OFFSET_Y: Record<string, number> = {
    wb: -1.1, wr: -2, wq: -2, wp: 1.2,
    bp: 2, bn: 2, br: 2, bq: 2, bb: 0.5,
};
const pieceTransform = (key: string) => [
    { scale: PIECE_SCALE[key] ?? 1 },
    { translateY: PIECE_OFFSET_Y[key] ?? 0 },
];

// =========================================================
// PREMOVE: Felder, die eine Figur "geometrisch" erreichen könnte
// (ohne Blocker und ohne Schach zu prüfen – die echte Legalitätsprüfung
// passiert erst, wenn du wirklich am Zug bist)
// Eigene Figuren auf dem Zielfeld sind absichtlich erlaubt: Der Gegner kann
// dort schlagen, und du willst danach zurückschlagen.
// =========================================================
const premoveTargets = (from: string, pieceKey: string): string[] => {
    const color = pieceKey[0];
    const type = pieceKey[1];
    const f = FILES.indexOf(from[0]);
    const r = parseInt(from[1], 10);
    const out: string[] = [];

    const add = (df: number, dr: number) => {
        const nf = f + df;
        const nr = r + dr;
        if (nf >= 0 && nf < 8 && nr >= 1 && nr <= 8) out.push(`${FILES[nf]}${nr}`);
    };
    const slide = (dirs: number[][]) =>
        dirs.forEach(([df, dr]) => {
            for (let i = 1; i < 8; i++) add(df * i, dr * i);
        });

    const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    const STRAIGHT = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    switch (type) {
        case "p": {
            const dir = color === "w" ? 1 : -1;
            add(0, dir);
            if ((color === "w" && r === 2) || (color === "b" && r === 7)) add(0, 2 * dir);
            add(-1, dir); // Schlagfelder (dürfen auch leer sein, Gegner kann noch ziehen)
            add(1, dir);
            break;
        }
        case "n":
            [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(
                ([df, dr]) => add(df, dr)
            );
            break;
        case "b":
            slide(DIAG);
            break;
        case "r":
            slide(STRAIGHT);
            break;
        case "q":
            slide(DIAG);
            slide(STRAIGHT);
            break;
        case "k":
            [...DIAG, ...STRAIGHT].forEach(([df, dr]) => add(df, dr));
            // Rochade
            if ((color === "w" && from === "e1") || (color === "b" && from === "e8")) {
                add(2, 0);
                add(-2, 0);
            }
            break;
    }
    return out;
};

// =========================================================
// VIRTUELLES BRETT: das echte Brett + alle vorgemerkten Züge angewandt.
// So kannst du eine Figur, die du schon vorgezogen hast, gleich nochmal
// vorziehen (Premove-Kette). Nur Darstellung - gespielt wird erst, wenn du dran bist.
// =========================================================
const buildVirtualBoard = (
    board: any[][],
    premoves: { from: string; to: string }[],
    myColor: string
) => {
    const vb = board.map((row) => [...row]);

    for (const pm of premoves) {
        const a = squareToRC(pm.from, myColor);
        const b = squareToRC(pm.to, myColor);
        const p = vb[a.r]?.[a.c];
        if (!p) continue;

        vb[a.r][a.c] = null;
        let placed = p;

        if (p.type === "p") {
            const lastRank = p.color === "w" ? "8" : "1";
            if (pm.to[1] === lastRank) {
                // Umwandlung -> Dame (wird beim echten Zug auch so gespielt)
                placed = { type: "q", color: p.color };
            } else if (pm.from[0] !== pm.to[0] && !vb[b.r][b.c]) {
                // möglicher en passant: nur wenn dahinter wirklich ein gegnerischer Bauer steht
                const cap = squareToRC(pm.to[0] + pm.from[1], myColor);
                const capPiece = vb[cap.r][cap.c];
                if (capPiece && capPiece.type === "p" && capPiece.color !== p.color) {
                    vb[cap.r][cap.c] = null;
                }
            }
        }

        if (
            p.type === "k" &&
            Math.abs(FILES.indexOf(pm.to[0]) - FILES.indexOf(pm.from[0])) === 2
        ) {
            const rank = pm.from[1];
            const short = pm.to[0] === "g";
            const ra = squareToRC((short ? "h" : "a") + rank, myColor);
            const rb = squareToRC((short ? "f" : "d") + rank, myColor);
            const rook = vb[ra.r][ra.c];
            if (rook && rook.type === "r") {
                vb[ra.r][ra.c] = null;
                vb[rb.r][rb.c] = rook;
            }
        }

        vb[b.r][b.c] = placed;
    }

    return vb;
};

type PreSel = { square: string; key: string } | null;

export default function Board({
    board,
    selectedSquare,
    legalMoves,
    lastMove,
    checkSquare,
    onPressSquare,
    pieces,
    pieceToKey,
    myColor,
    mode,
    isCheck,
    isCheckmate,
    isStalemate,
    isDraw,
    onUndo,
    onRedo,
    onSave,
    onRestart,
    // --- Premove ---
    canPremove = false, // true, wenn das Spiel läuft und der GEGNER am Zug ist
    premove = null, // Einzel-Premove { from, to } | null (alter Weg, z.B. Online-Spiel)
    premoves, // NEU: Liste { from, to }[] für mehrere Premoves hintereinander
    multiPremove = false, // NEU: true -> Premove-Kette mit virtuellem Brett
    onPremove, // (from, to) => void
    onClearPremove, // () => void
}: any) {
    // =========================================================
    // DRAG & DROP
    // =========================================================

    const [boardSize, setBoardSize] = useState(0);
    const [drag, setDrag] = useState<{ from: string; pieceKey: string } | null>(null);
    const dragPos = useRef(new Animated.ValueXY()).current;

    // Premove-Auswahl (nur lokal im Board, solange der Gegner am Zug ist)
    const [preSel, setPreSelState] = useState<PreSel>(null);
    const preSelRef = useRef<PreSel>(null);
    const setPreSel = (v: PreSel) => {
        preSelRef.current = v;
        setPreSelState(v);
    };

    // Sobald ich wieder am Zug bin (oder das Spiel endet), Auswahl verwerfen
    useEffect(() => {
        if (!canPremove) setPreSel(null);
    }, [canPremove]);

    // Liste der vorgemerkten Züge (Rückwärtskompatibel mit dem alten Einzel-Premove)
    const pmList: { from: string; to: string }[] =
        premoves ?? (premove ? [premove] : []);

    // Brett, das angezeigt wird und auf dem geklickt wird:
    // im Ketten-Modus mit den vorgemerkten Zügen bereits angewandt
    const vboard =
        multiPremove && canPremove && pmList.length > 0
            ? buildVirtualBoard(board, pmList, myColor)
            : board;

    // Der PanResponder wird nur einmal erstellt -> immer die aktuellen Props über ein Ref lesen
    const latest = useRef<any>({});
    latest.current = {
        board: vboard,
        myColor,
        onPressSquare,
        pieceToKey,
        boardSize,
        canPremove,
        onPremove,
        onClearPremove,
    };

    const gesture = useRef({
        startX: 0,
        startY: 0,
        startSquare: null as string | null,
        dragging: false,
    });

    // Touch-Koordinate (relativ zum Brett) -> Feld
    const cellAt = (x: number, y: number) => {
        const { board, myColor, boardSize } = latest.current;
        const sq = boardSize / 8;
        if (!sq) return null;

        const c = Math.floor(x / sq);
        const r = Math.floor(y / sq);
        if (r < 0 || r > 7 || c < 0 || c > 7) return null;

        const square =
            myColor === "w" ? toSquare(r, c) : toSquare(7 - r, 7 - c);

        return { square, piece: board[r][c] };
    };

    // Steht die ausgewählte Figur (auf dem aktuell angezeigten Brett) noch dort?
    const selStillValid = (sel: NonNullable<PreSel>) => {
        const { board, myColor, pieceToKey } = latest.current;
        const { r, c } = squareToRC(sel.square, myColor);
        const p = board[r]?.[c];
        return !!p && pieceToKey(p) === sel.key;
    };

    const resetDrag = () => {
        gesture.current.dragging = false;
        setDrag(null);
    };

    // =========================================================
    // NEU: Rechtsklick (Web/Laptop) bricht die Premove-Kette ab - wie
    // in gängigen Schach-Apps üblich. Auf Touch-Geräten gibt es keinen
    // Rechtsklick, dort bleibt das Antippen einer leeren Fläche der Weg.
    // =========================================================
    const handleContextMenu = (e: any) => {
        if (Platform.OS !== "web") return;

        // Verhindert, dass zusätzlich das native Browser-Kontextmenü aufgeht.
        e?.preventDefault?.();

        const { canPremove, onClearPremove } = latest.current;
        if (!canPremove) return;

        setPreSel(null);
        onClearPremove?.();
        resetDrag();
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderTerminationRequest: () => false,

            onPanResponderGrant: (e) => {
                const { locationX: x, locationY: y } = e.nativeEvent;
                const g = gesture.current;
                const { myColor, pieceToKey, onPressSquare, canPremove } = latest.current;

                g.startX = x;
                g.startY = y;
                g.dragging = false;

                const cell = cellAt(x, y);
                g.startSquare = cell?.square ?? null;

                const ownPiece = !!(cell?.piece && cell.piece.color === myColor);

                if (canPremove) {
                    // Veraltete Auswahl (Figur wurde geschlagen / steht woanders) verwerfen
                    let sel = preSelRef.current;
                    if (sel && !selStillValid(sel)) {
                        setPreSel(null);
                        sel = null;
                    }

                    // Tippt man auf ein gültiges Ziel der ausgewählten Figur, das von einer
                    // EIGENEN Figur besetzt ist (Wiederschlagen nach Abtausch), dann ist das
                    // ein Ziel und keine neue Auswahl. Das Setzen passiert beim Loslassen.
                    const onTarget = !!(
                        sel &&
                        cell &&
                        cell.square !== sel.square &&
                        premoveTargets(sel.square, sel.key).includes(cell.square)
                    );

                    // PREMOVE-MODUS: eigene Figur auswählen + Drag starten, aber KEIN onPressSquare
                    if (ownPiece && cell && !onTarget) {
                        const key = pieceToKey(cell.piece);
                        g.dragging = true;
                        setPreSel({ square: cell.square, key });
                        dragPos.setValue({ x, y });
                        setDrag({ from: cell.square, pieceKey: key });
                    }
                    return;
                }

                // Eigene Figur: auswählen + Drag starten
                if (ownPiece && cell) {
                    g.dragging = true;
                    onPressSquare(cell.square);
                    dragPos.setValue({ x, y });
                    setDrag({
                        from: cell.square,
                        pieceKey: pieceToKey(cell.piece),
                    });
                }
            },

            onPanResponderMove: (_e, gs) => {
                const g = gesture.current;
                if (!g.dragging) return;
                dragPos.setValue({ x: g.startX + gs.dx, y: g.startY + gs.dy });
            },

            onPanResponderRelease: (_e, gs) => {
                const g = gesture.current;
                const { onPressSquare, myColor, canPremove, onPremove, onClearPremove } =
                    latest.current;

                // ---------- PREMOVE-MODUS ----------
                if (canPremove) {
                    const sel = preSelRef.current;

                    if (g.dragging) {
                        // Drag: auf ein anderes Feld losgelassen?
                        const target = cellAt(g.startX + gs.dx, g.startY + gs.dy);
                        if (
                            sel &&
                            target &&
                            target.square !== g.startSquare &&
                            premoveTargets(sel.square, sel.key).includes(target.square)
                        ) {
                            onPremove?.(sel.square, target.square);
                            setPreSel(null);
                        }
                        // sonst: Auswahl bleibt bestehen (wie beim normalen Antippen)
                    } else if (g.startSquare) {
                        // Tippen auf ein Zielfeld (leer, Gegnerfigur oder eigene Figur)
                        if (
                            sel &&
                            premoveTargets(sel.square, sel.key).includes(g.startSquare)
                        ) {
                            onPremove?.(sel.square, g.startSquare);
                            setPreSel(null);
                        } else {
                            // ins Leere getippt -> Auswahl UND alle vorhandenen Premoves löschen
                            setPreSel(null);
                            onClearPremove?.();
                        }
                    }

                    resetDrag();
                    return;
                }

                // ---------- NORMALER MODUS (unverändert) ----------
                if (g.dragging) {
                    const target = cellAt(g.startX + gs.dx, g.startY + gs.dy);

                    // Zug nur auslösen, wenn auf ein anderes Feld ohne eigene Figur losgelassen wurde
                    if (
                        target &&
                        target.square !== g.startSquare &&
                        !(target.piece && target.piece.color === myColor)
                    ) {
                        onPressSquare(target.square);
                    }
                } else if (g.startSquare) {
                    // normales Tippen (leeres Feld / Gegnerfigur als Ziel)
                    onPressSquare(g.startSquare);
                }

                resetDrag();
            },

            onPanResponderTerminate: resetDrag,
        })
    ).current;

    const squareSize = boardSize / 8;
    const preTargets = preSel ? premoveTargets(preSel.square, preSel.key) : [];

    return (
        <View style={styles.container}>
            {isCheck && (
                <Text style={{ color: "red", position: "absolute", top: 10 }}>
                    CHECK
                </Text>
            )}
            {isCheckmate && (
                <Text style={{ color: "red", position: "absolute", top: 30 }}>
                    CHECKMATE
                </Text>
            )}
            {isStalemate && (
                <Text style={{ color: "gray", position: "absolute", top: 30 }}>
                    STALEMATE
                </Text>
            )}
            {isDraw && (
                <Text style={{ color: "gray", position: "absolute", top: 30 }}>
                    DRAW
                </Text>
            )}

            <View
                style={styles.board}
                // -2 wegen borderWidth: 1 (links + rechts)
                onLayout={(e) => setBoardSize(e.nativeEvent.layout.width - 2)}
            >
                {vboard.map((row: any[], r: number) =>
                    row.map((piece, c) => {
                        const square =
                            myColor === "w"
                                ? toSquare(r, c)
                                : toSquare(7 - r, 7 - c);

                        const isSelected =
                            selectedSquare === square || preSel?.square === square;
                        const isLegal = legalMoves?.some((m: any) => m.to === square);
                        const isPreTarget = preTargets.includes(square);
                        const isPremoveSq = pmList.some(
                            (m) => m.from === square || m.to === square
                        );
                        const isLastFrom = lastMove?.from === square;
                        const isLastTo = lastMove?.to === square;
                        const isCheckSq = checkSquare === square;
                        const pieceKey = pieceToKey(piece);
                        const isDark = (r + c) % 2 === 1;

                        // Figur, die gerade gezogen wird, am Ursprung ausblenden
                        const hidden = drag?.from === square;

                        return (
                            <View
                                key={square}
                                style={[
                                    styles.square,
                                    {
                                        backgroundColor: (() => {
                                            if (isCheckSq) return "#ff4d4d";
                                            if (isPremoveSq) return "#e0735c";
                                            if (isLastTo) return "#6bb6ff";
                                            if (isLastFrom) return "#4da3ff";
                                            if (isSelected) return "#4da3ff";
                                            return (r + c) % 2 === 0 ? "#e7d5b7" : "#b58863";
                                        })(),
                                    },
                                ]}
                            >
                                {pieceKey && !hidden && (
                                    <Image
                                        source={pieces[pieceKey]}
                                        style={[
                                            styles.piece,
                                            { transform: pieceTransform(pieceKey) },
                                        ]}
                                    />
                                )}
                                {(isLegal || isPreTarget) && <View style={styles.dot} />}

                                {c === 0 && (
                                    <Text
                                        style={[
                                            styles.coordLabel,
                                            { top: 2, left: 2, color: isDark ? "#e5e7eb" : "#334155" },
                                        ]}
                                    >
                                        {myColor === "w" ? RANKS[r] : RANKS[7 - r]}
                                    </Text>
                                )}
                                {r === 7 && (
                                    <Text
                                        style={[
                                            styles.coordLabel,
                                            { bottom: 2, left: 2, color: isDark ? "#e5e7eb" : "#334155" },
                                        ]}
                                    >
                                        {myColor === "w" ? FILES[c] : FILES[7 - c]}
                                    </Text>
                                )}
                            </View>
                        );
                    })
                )}

                {/* Unsichtbare Touch-Schicht über dem ganzen Brett */}
                <View
                    style={StyleSheet.absoluteFill}
                    {...panResponder.panHandlers}
                    {...(Platform.OS === "web"
                        ? ({ onContextMenu: handleContextMenu } as any)
                        : {})}
                />

                {/* Figur, die am Finger klebt (etwas über dem Finger, damit man sie sieht) */}
                {drag && squareSize > 0 && (
                    <Animated.View
                        pointerEvents="none"
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: squareSize,
                            height: squareSize,
                            alignItems: "center",
                            justifyContent: "center",
                            transform: [
                                { translateX: Animated.subtract(dragPos.x, squareSize / 2) },
                                {
                                    translateY: Animated.subtract(
                                        dragPos.y,
                                        squareSize / 2 + squareSize * 0.5
                                    ),
                                },
                            ],
                        }}
                    >
                        <Image
                            source={pieces[drag.pieceKey]}
                            style={[
                                styles.piece,
                                { transform: pieceTransform(drag.pieceKey) },
                            ]}
                        />
                    </Animated.View>
                )}
            </View>

            {mode === "local" && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
                    <Pressable onPress={onUndo}>
                        <Text style={{ color: "white" }}>Undo </Text>
                    </Pressable>
                    <Pressable onPress={onRedo}>
                        <Text style={{ color: "white" }}>Redo </Text>
                    </Pressable>
                    <Pressable onPress={onSave}>
                        <Text style={{ color: "white" }}>Save </Text>
                    </Pressable>
                    <Pressable onPress={onRestart}>
                        <Text style={{ color: "white" }}>Restart </Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
    },
    board: {
        width: "92%",
        aspectRatio: 1,
        flexDirection: "row",
        flexWrap: "wrap",
        borderWidth: 1,
        borderColor: "#d4af37",
        borderRadius: 8,
        overflow: "hidden",
    },
    square: {
        width: "12.5%",
        height: "12.5%",
        justifyContent: "center",
        alignItems: "center",
    },
    piece: {
        width: "90%",
        height: "90%",
        resizeMode: "contain",
    },
    dot: {
        position: "absolute",
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "rgba(0,0,0,0.3)",
    },
    coordLabel: {
        position: "absolute",
        fontSize: 10,
        fontWeight: "600",
    },
});