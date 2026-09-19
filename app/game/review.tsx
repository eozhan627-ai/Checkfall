import { Chess } from "chess.js";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator, Dimensions, Image, PanResponder, Pressable, ScrollView,
    StyleSheet, Text, View,
} from "react-native";
// Zusätzliche Pakete für Screenshot/Teilen-Funktion — falls noch nicht installiert:
// npx expo install react-native-view-shot expo-sharing
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { getCurrentAccount } from "../../lib/account";
import {
    onAnalysisComplete, onAnalysisError,
    onAnalysisProgress,
    requestGameAnalysis,
} from "../../lib/games";
import { getSocket } from "../../lib/socket";
import { supabase } from "../../lib/supabase";

const BOARD_SIZE = Math.min(Dimensions.get("window").width - 80, 380);
const SQUARE_SIZE = BOARD_SIZE / 8;

const COLORS = {
    bg: "#0D0F13",
    surface: "#171A20",
    surfaceRaised: "#1D2129",
    border: "rgba(255,255,255,0.07)",
    textPrimary: "#ECEDEE",
    textSecondary: "#868C94",
    textTertiary: "#565B63",
    accent: "#7C9473",
    accentSoft: "rgba(124,148,115,0.14)",
    accentBorder: "rgba(124,148,115,0.45)",
    boardLight: "#E9E2D0",
    boardDark: "#4B5C46",
    evalTrack: "#E9E2D0",
    evalFill: "#20242B",
    selected: "rgba(124,148,115,0.55)",
};

const pieces: Record<string, any> = {
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

const pieceToKey = (piece: any) => (piece ? `${piece.color}${piece.type}` : null);

type MoveClassification =
    | "brilliant" | "great" | "good" | "inaccuracy" | "mistake" | "blunder"
    | "missed_win" | "precise_defense" | "only_move" | "slip";

type AnalysisMove = { moveNumber: number; san: string; evalCp: number | null; bestMove: string; classification: MoveClassification };

type Analysis = {
  depth: number; tier: string; moves: AnalysisMove[];
  accuracy: { w: number | null; b: number | null };
  counts: Record<"w" | "b", Partial<Record<MoveClassification, number>>>;
};

const CLASSIFICATION_META: Record<MoveClassification, { label: string; icon: string; color: string }> = {
    brilliant: { label: "Brillant", icon: "★★", color: "#3FB6DE" },
    great: { label: "Starker Zug", icon: "★", color: "#6C8CFF" },
    good: { label: "Gut", icon: "✓", color: "#7C9473" },
    inaccuracy: { label: "Ungenauigkeit", icon: "?!", color: "#D2B45A" },
    mistake: { label: "Fehler", icon: "?", color: "#E0914D" },
    blunder: { label: "Patzer", icon: "??", color: "#DD6259" },
    missed_win: { label: "Gewinn verpasst", icon: "⚡", color: "#B37FE0" },
    precise_defense: { label: "Präzise Verteidigung", icon: "🛡", color: "#57BDA0" },
    only_move: { label: "Einziger Zug", icon: "‼", color: "#8B93E8" },
    slip: { label: "Kleiner Ausrutscher", icon: "~", color: "#C99C64" },
};

// Kleines, bewusst schlankes Eröffnungslexikon (Startzüge -> Name).
// Deckt die geläufigsten Eröffnungen ab; für vollständige ECO-Abdeckung
// empfiehlt sich später ein richtiges ECO-Paket statt dieser festen Tabelle.
const OPENING_BOOK: Record<string, string> = {
    "e4 e5": "Offenes Spiel",
    "e4 e5 Nf3 Nc6 Bb5": "Spanische Partie (Ruy López)",
    "e4 e5 Nf3 Nc6 Bc4": "Italienische Partie",
    "e4 e5 Nf3 Nf6": "Petrow-Verteidigung",
    "e4 c5": "Sizilianische Verteidigung",
    "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6": "Sizilianisch, Najdorf-Variante",
    "e4 e6": "Französische Verteidigung",
    "e4 c6": "Caro-Kann-Verteidigung",
    "d4 d5": "Geschlossenes Spiel",
    "d4 d5 c4": "Damengambit",
    "d4 Nf6 c4 g6": "Königsindische Verteidigung",
    "d4 Nf6 c4 e6": "Nimzowitsch-Indisch",
    "d4 f5": "Holländische Verteidigung",
    "c4": "Englische Eröffnung",
    "Nf3": "Réti-Eröffnung",
};

function detectOpening(sanHistory: string[]): string | null {
    const limit = Math.min(10, sanHistory.length);
    for (let len = limit; len >= 1; len -= 1) {
        const key = sanHistory.slice(0, len).join(" ");
        if (OPENING_BOOK[key]) return OPENING_BOOK[key];
    }
    return null;
}

function buildReport(analysis: Analysis): string[] {
    const negKeys: MoveClassification[] = ["blunder", "mistake", "inaccuracy", "missed_win", "slip"];
    const worst = (counts: Partial<Record<MoveClassification, number>>) => {
        let bestKey: MoveClassification | null = null;
        let bestVal = 0;
        for (const k of negKeys) {
            const v = counts[k] || 0;
            if (v > bestVal) { bestVal = v; bestKey = k; }
        }
        return bestKey ? { key: bestKey, count: bestVal } : null;
    };

    const lines: string[] = [];
const { w: white, b: black } = analysis.accuracy;
const wAcc = white ?? 0;
const bAcc = black ?? 0;

if (wAcc >= bAcc + 5) lines.push(`Weiß spielte insgesamt präziser (${wAcc}% gegenüber ${bAcc}%).`);
else if (bAcc >= wAcc + 5) lines.push(`Schwarz spielte insgesamt präziser (${bAcc}% gegenüber ${wAcc}%).`);
else lines.push(`Beide Seiten spielten ähnlich genau (${wAcc}% zu ${bAcc}%).`);

const w = worst(analysis.counts.w || {});
const b = worst(analysis.counts.b || {});
if (w) lines.push(`Größte Schwachstelle für Weiß: ${CLASSIFICATION_META[w.key].label} (${w.count}×).`);
if (b) lines.push(`Größte Schwachstelle für Schwarz: ${CLASSIFICATION_META[b.key].label} (${b.count}×).`);

    const brilliantTotal = (analysis.counts.w?.brilliant || 0) + (analysis.counts.b?.brilliant || 0);
    if (brilliantTotal > 0) {
        lines.push(`Die Partie enthält ${brilliantTotal} brillante${brilliantTotal > 1 ? "" : "n"} Zug${brilliantTotal > 1 ? "e" : ""}.`);
    }

    return lines;
}

function squareCenter(square: string) {
    const file = square.charCodeAt(0) - 97;
    const rank = parseInt(square[1], 10);
    const col = file;
    const row = 8 - rank;
    return { x: col * SQUARE_SIZE + SQUARE_SIZE / 2, y: row * SQUARE_SIZE + SQUARE_SIZE / 2 };
}

// Nimmt an, dass bestMove im UCI-Format vorliegt (z. B. "e2e4"), wie es
// Stockfish typischerweise liefert. Andere Formate (SAN) werden ignoriert,
// der Pfeil wird dann einfach nicht gezeichnet.
function parseUci(uci: string): { from: string; to: string } | null {
    const m = /^([a-h][1-8])([a-h][1-8])/.exec(uci);
    if (!m) return null;
    return { from: m[1], to: m[2] };
}

export default function GameReview() {
    const params = useLocalSearchParams();
    const gameId = params.gameId as string;

    const [pgn, setPgn] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [status, setStatus] = useState<"loading" | "not_vip" | "analyzing" | "ready" | "error">("loading");
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [currentIndex, setCurrentIndex] = useState(0);

    const [mode, setMode] = useState<"review" | "sandbox">("review");
    const [sandboxFen, setSandboxFen] = useState<string | null>(null);
    const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [playSpeed, setPlaySpeed] = useState(1);

    const [recentGames, setRecentGames] = useState<{ id: string; date: string; accuracy: number }[]>([]);

    const shareRef = useRef<View>(null);

    useEffect(() => {
        (async () => {
            const { data, error } = await supabase
                .from("games")
                .select("pgn, analyzed, analysis")
                .eq("id", gameId)
                .single();

            if (error || !data) {
                setStatus("error");
                return;
            }

            setPgn(data.pgn);

            if (data.analyzed && data.analysis) {
                setAnalysis(data.analysis);
                setStatus("ready");
                return;
            }

            const acc = await getCurrentAccount();
            if (!acc || !acc.vipTier || acc.vipTier === "none") {
                setStatus("not_vip");
                return;
            }

            setStatus("analyzing");

            try {
                const socket = getSocket();
                await requestGameAnalysis(socket, gameId);
            } catch (err: any) {
                setStatus(err?.message === "NOT_VIP" ? "not_vip" : "error");
            }
        })();
    }, [gameId]);

    useEffect(() => {
        const socket = getSocket();

        const offProgress = onAnalysisProgress(socket, (data) => {
            if (data.gameId !== gameId) return;
            setProgress({ done: data.progress, total: data.total });
        });

        const offComplete = onAnalysisComplete(socket, (data) => {
            if (data.gameId !== gameId) return;
            setAnalysis(data.analysis);
            setStatus("ready");
        });

        const offError = onAnalysisError(socket, (data) => {
            if (data.gameId !== gameId) return;
            setStatus("error");
        });

        return () => {
            offProgress();
            offComplete();
            offError();
        };
    }, [gameId]);

    const { positions, fens } = useMemo(() => {
        if (!pgn) return { positions: [] as any[], fens: [] as string[] };

        const source = new Chess();
        source.loadPgn(pgn);
        const sanMoves = source.history();

        const replay = new Chess();
        const boardsResult = [replay.board()];
        const fensResult = [replay.fen()];

        for (const san of sanMoves) {
            replay.move(san);
            boardsResult.push(replay.board());
            fensResult.push(replay.fen());
        }

        return { positions: boardsResult, fens: fensResult };
    }, [pgn]);

    const openingName = useMemo(() => {
        if (!pgn) return null;
        try {
            const g = new Chess();
            g.loadPgn(pgn);
            return detectOpening(g.history());
        } catch {
            return null;
        }
    }, [pgn]);

    const turningPoints = useMemo(() => {
        if (!analysis) return [] as { index: number; delta: number }[];
        let prevEval = 0;
        const deltas = analysis.moves.map((m, i) => {
            const cur = m.evalCp ?? prevEval;
            const delta = Math.abs(cur - prevEval);
            prevEval = cur;
            return { index: i, delta };
        });
        return deltas
            .filter((d) => d.delta >= 150)
            .sort((a, b) => b.delta - a.delta)
            .slice(0, 3)
            .sort((a, b) => a.index - b.index);
    }, [analysis]);

    const reportLines = useMemo(() => (analysis ? buildReport(analysis) : []), [analysis]);

    const sandboxGameObj = useMemo(() => {
        if (!sandboxFen) return null;
        const g = new Chess();
        try {
            g.load(sandboxFen);
        } catch {
            return null;
        }
        return g;
    }, [sandboxFen]);

    useEffect(() => {
        if (!isPlaying || !analysis) return;
        const id = setInterval(() => {
            setCurrentIndex((i) => {
                if (i >= analysis.moves.length) {
                    setIsPlaying(false);
                    return i;
                }
                return i + 1;
            });
        }, 900 / playSpeed);
        return () => clearInterval(id);
    }, [isPlaying, playSpeed, analysis]);

    // Verlauf über mehrere Partien. ANNAHME: Spalten "white_id" / "black_id"
    // in der "games"-Tabelle — bitte an das tatsächliche Supabase-Schema anpassen.
    useEffect(() => {
        if (status !== "ready") return;
        (async () => {
            try {
                const acc = await getCurrentAccount();
                if (!acc?.id) return;

                const { data } = await supabase
                    .from("games")
                    .select("id, created_at, analysis")
                    .or(`white_id.eq.${acc.id},black_id.eq.${acc.id}`)
                    .eq("analyzed", true)
                    .order("created_at", { ascending: false })
                    .limit(8);

                if (data) {
                    const parsed = data
                        .map((g: any) => ({
                            id: g.id,
                            date: g.created_at,
                            accuracy: g.analysis?.accuracy
                                ? Math.round((g.analysis.accuracy.white + g.analysis.accuracy.black) / 2)
                                : null,
                        }))
                        .filter((g: any) => g.accuracy !== null)
                        .reverse();
                    setRecentGames(parsed as any);
                }
            } catch {
                // Verlauf ist ein optionales Extra — bei Fehler einfach ausblenden
            }
        })();
    }, [status]);

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy),
                onPanResponderRelease: (_, g) => {
                    if (!analysis) return;
                    if (g.dx < -30) setCurrentIndex((i) => Math.min(analysis.moves.length, i + 1));
                    else if (g.dx > 30) setCurrentIndex((i) => Math.max(0, i - 1));
                },
            }),
        [analysis]
    );

    function enterSandbox() {
        const fen = fens[currentIndex] ?? fens[0];
        if (!fen) return;
        setSandboxFen(fen);
        setSelectedSquare(null);
        setMode("sandbox");
    }

    function exitSandbox() {
        setMode("review");
        setSandboxFen(null);
        setSelectedSquare(null);
    }

    function handleSandboxSquarePress(square: string) {
        if (!sandboxGameObj) return;

        if (!selectedSquare) {
            const piece = sandboxGameObj.get(square as any);
            if (piece) setSelectedSquare(square);
            return;
        }

        if (selectedSquare === square) {
            setSelectedSquare(null);
            return;
        }

        try {
            const move = sandboxGameObj.move({ from: selectedSquare, to: square, promotion: "q" } as any);
            if (move) setSandboxFen(sandboxGameObj.fen());
        } catch {
            // ungültiger Zug — einfach ignorieren
        }
        setSelectedSquare(null);
    }

    async function handleShare() {
        try {
            const uri = await captureRef(shareRef, { format: "png", quality: 0.92 });
            const available = await Sharing.isAvailableAsync();
            if (available) await Sharing.shareAsync(uri);
        } catch {
            // Teilen ist ein optionales Extra — bei Fehler (z. B. Paket fehlt) einfach nichts tun
        }
    }

    if (status === "loading" || status === "analyzing") {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={COLORS.accent} size="large" />
                {status === "analyzing" && (
                    <Text style={styles.loadingText}>
                        Partie wird analysiert · {progress.done}/{progress.total || "?"}  </Text>
                )}
            </View>
        );
    }

    if (status === "not_vip") {
        return (
            <View style={styles.center}>
                <View style={styles.vipBadge}>
                    <Text style={styles.vipBadgeText}>VIP</Text>
                </View>
                <Text style={styles.emptyTitle}>Nur für VIP-Mitglieder</Text>
                <Text style={styles.emptyText}>Die Stockfish-Analyse steht exklusiv VIP-Konten zur Verfügung.</Text>
                <Pressable onPress={() => router.push("/vip")} style={({ pressed }) => [styles.vipButton, pressed && styles.vipButtonPressed]}>
                    <Text style={styles.vipButtonText}>VIP ansehen</Text>
                </Pressable>
            </View>
        );
    }

    if (status === "error" || !analysis || positions.length === 0) {
        return (
            <View style={styles.center}>
                <Text style={styles.emptyTitle}>Analyse nicht verfügbar</Text>
                <Text style={styles.emptyText}>Die Partie konnte nicht geladen werden. Versuch es später erneut.</Text>
            </View>
        );
    }

    const board = mode === "sandbox" && sandboxGameObj ? sandboxGameObj.board() : positions[currentIndex] ?? positions[0];
    const currentMove = currentIndex > 0 ? analysis.moves[currentIndex - 1] : null;
    const evalCp = currentMove?.evalCp ?? 0;
    const clampedEval = Math.max(-500, Math.min(500, evalCp));
    const whiteFraction = 0.5 + clampedEval / 1000;

    const whiteCounts = analysis.counts.w || {};
    const blackCounts = analysis.counts.b || {};
    const maxCount = Math.max(1, ...Object.values(whiteCounts), ...Object.values(blackCounts));

    const bestMoveArrow = (() => {
        if (mode !== "review" || !currentMove?.bestMove) return null;
        const parsed = parseUci(currentMove.bestMove);
        if (!parsed) return null;
        const from = squareCenter(parsed.from);
        const to = squareCenter(parsed.to);
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        return { from, to, length, angle };
    })();

    const maxRecentAccuracy = Math.max(1, ...recentGames.map((g) => g.accuracy));

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.iconButton}>
                    <Text style={styles.backText}>‹</Text>
                </Pressable>
                <Text style={styles.headerTitle}>Partieanalyse</Text>
                <Pressable onPress={handleShare} style={styles.iconButton}>
                    <Text style={styles.shareText}>↗</Text>
                </Pressable>
            </View>

            <View style={styles.modeTabs}>
                <Pressable onPress={() => setMode("review")} style={[styles.modeTab, mode === "review" && styles.modeTabActive]}>
                    <Text style={[styles.modeTabText, mode === "review" && styles.modeTabTextActive]}>Analyse</Text>
                </Pressable>
                <Pressable onPress={enterSandbox} style={[styles.modeTab, mode === "sandbox" && styles.modeTabActive]}>
                    <Text style={[styles.modeTabText, mode === "sandbox" && styles.modeTabTextActive]}>Sandbox</Text>
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ alignItems: "center", paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                <View ref={shareRef} collapsable={false} style={{ alignItems: "center" }}>
                    <View style={styles.engineRow}>
                        <Text style={styles.engineText}>{analysis.tier} · Tiefe {analysis.depth}</Text>
                        {openingName && mode === "review" && <Text style={styles.openingText}>{openingName}</Text>}
                    </View>

                    <View style={styles.accuracyRow}>
                        <View style={styles.accuracyCard}>
                            <View style={[styles.accuracyDot, { backgroundColor: "#ECEDEE" }]} />
                            <Text style={styles.accuracyLabel}>Weiß </Text>
           <Text style={styles.accuracyValue}>{analysis.accuracy.w?.toFixed(1)}%</Text>
                        </View>
                        <View style={styles.accuracyDivider} />
                        <View style={styles.accuracyCard}>
                            <View style={[styles.accuracyDot, { backgroundColor: "#4B5058" }]} />
                            <Text style={styles.accuracyLabel}>Schwarz </Text>
             <Text style={styles.accuracyValue}>{analysis.accuracy.b?.toFixed(1)}%</Text>
                        </View>
                    </View>

                    <View style={styles.boardRow}>
                        {mode === "review" && (
                            <View style={styles.evalBarVertical}>
                                <View style={[styles.evalBarBlack, { height: `${(1 - whiteFraction) * 100}%` }]} />
                                <View style={styles.evalBarMidline} />
                            </View>
                        )}

                        <View style={styles.boardFrame} {...(mode === "review" ? panResponder.panHandlers : {})}>
                            <View style={{ width: BOARD_SIZE, height: BOARD_SIZE }}>
                                <View style={styles.board}>
                                    {board.map((row: any[], rowIndex: number) =>
                                        row.map((piece, colIndex) => {
                                            const isDark = (rowIndex + colIndex) % 2 === 1;
                                            const key = pieceToKey(piece);
                                            const file = String.fromCharCode(97 + colIndex);
                                            const rank = 8 - rowIndex;
                                            const square = `${file}${rank}`;
                                            const isSelected = mode === "sandbox" && selectedSquare === square;

                                            return (
                                                <Pressable
                                                    key={`${rowIndex}-${colIndex}`}
                                                    disabled={mode !== "sandbox"}
                                                    onPress={() => handleSandboxSquarePress(square)}
                                                    style={[
                                                        styles.square,
                                                        { backgroundColor: isDark ? COLORS.boardDark : COLORS.boardLight },
                                                        isSelected && { backgroundColor: COLORS.selected },
                                                    ]}
                                                >
                                                    {key && (
                                                        <Image
                                                            source={pieces[key]}
                                                            style={[
                                                                styles.piece,
                                                                {
                                                                    transform: [
                                                                        {
                                                                            scale:
                                                                                key === "wp" ? 1.35 :
                                                                                    key === "wn" ? 1.55 :
                                                                                        key === "wb" ? 1.7 :
                                                                                            key === "wr" ? 1.65 :
                                                                                                key === "wq" ? 1.55 :
                                                                                                    key === "wk" ? 1.30 :

                                                                                                        key === "bp" ? 1.3 :
                                                                                                            key === "bn" ? 1.20 :
                                                                                                                key === "bb" ? 1.3 :
                                                                                                                    key === "br" ? 1.15 :
                                                                                                                        key === "bq" ? 1.25 :
                                                                                                                            key === "bk" ? 1.15 :

                                                                                                                                1
                                                                        },
                                                                        {
                                                                            translateY:
                                                                                key === "wb" ? -1.1 :
                                                                                    key === "wr" ? -2 :
                                                                                        key === "wq" ? -2 :
                                                                                            key === "wp" ? 1.2 :

                                                                                                key === "bp" ? 2 :
                                                                                                    key === "bn" ? 2 :
                                                                                                        key === "br" ? 2 :
                                                                                                            key === "bq" ? 2 :
                                                                                                                key === "bb" ? 0.5 :

                                                                                                                    0
                                                                        }
                                                                    ]
                                                                }
                                                            ]}
                                                            resizeMode="contain"
                                                        />
                                                    )}
                                                </Pressable>
                                            );
                                        })
                                    )}
                                </View>

                                {bestMoveArrow && (
                                    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
                                        <View
                                            style={{
                                                position: "absolute",
                                                left: bestMoveArrow.from.x,
                                                top: bestMoveArrow.from.y - 2,
                                                width: bestMoveArrow.length,
                                                height: 4,
                                                backgroundColor: COLORS.accent,
                                                opacity: 0.85,
                                                borderRadius: 2,
                                                transform: [{ rotate: `${bestMoveArrow.angle}rad` }],
                                                // @ts-ignore — transformOrigin wird ab RN 0.71 unterstützt
                                                transformOrigin: "0% 50%",
                                            }}
                                        />
                                        <View
                                            style={{
                                                position: "absolute",
                                                left: bestMoveArrow.to.x - 5,
                                                top: bestMoveArrow.to.y - 5,
                                                width: 10,
                                                height: 10,
                                                borderRadius: 5,
                                                backgroundColor: COLORS.accent,
                                            }}
                                        />
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>

                    {mode === "review" && (
                        <View style={styles.classificationBanner}>
                            {currentMove ? (
                                <>
                                    <View style={[styles.classificationStripe, { backgroundColor: CLASSIFICATION_META[currentMove.classification].color }]} />
                                    <View style={[styles.classificationIconWrap, { backgroundColor: `${CLASSIFICATION_META[currentMove.classification].color}22` }]}>
                                        <Text style={[styles.classificationIcon, { color: CLASSIFICATION_META[currentMove.classification].color }]}>
                                            {CLASSIFICATION_META[currentMove.classification].icon}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text style={styles.classificationSan}>{currentMove.san}</Text>
                                        <Text style={[styles.classificationLabel, { color: CLASSIFICATION_META[currentMove.classification].color }]}>
                                            {CLASSIFICATION_META[currentMove.classification].label}
                                        </Text>
                                    </View>
                                </>
                            ) : (
                                <>
                                    <View style={[styles.classificationStripe, { backgroundColor: COLORS.textTertiary }]} />
                                    <Text style={styles.classificationLabelIdle}>Ausgangsstellung</Text>
                                </>
                            )}
                        </View>
                    )}
                </View>

                {mode === "sandbox" ? (
                    <View style={styles.sandboxControls}>
                        <Text style={styles.sandboxHint}>Sandbox-Modus · eigene Züge ohne Engine-Bewertung</Text>
                        <View style={styles.sandboxButtonsRow}>
                            <Pressable onPress={() => setSandboxFen(fens[currentIndex] ?? fens[0])} style={styles.navButton}>
                                <Text style={styles.navButtonText}>Zurücksetzen</Text>
                            </Pressable>
                            <Pressable onPress={exitSandbox} style={[styles.navButton, { backgroundColor: COLORS.accent }]}>
                                <Text style={[styles.navButtonText, { color: "#12151B" }]}>Zurück zur Analyse</Text>
                            </Pressable>
                        </View>
                    </View>
                ) : (
                    <>
                        {turningPoints.length > 0 && (
                            <ScrollView horizontal style={styles.turningList} contentContainerStyle={{ paddingHorizontal: 12 }} showsHorizontalScrollIndicator={false}>
                                <Text style={styles.turningLabel}>Wendepunkte</Text>
                                {turningPoints.map((tp) => {
                                    const m = analysis.moves[tp.index];
                                    return (
                                        <Pressable key={tp.index} onPress={() => setCurrentIndex(tp.index + 1)} style={styles.turningChip}>
                                            <Text style={styles.turningChipText}>{m.moveNumber}. {m.san}</Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        )}

                        <ScrollView horizontal style={styles.moveList} contentContainerStyle={{ paddingHorizontal: 12 }} showsHorizontalScrollIndicator={false}>
                            <Pressable onPress={() => setCurrentIndex(0)} style={[styles.moveChip, currentIndex === 0 && styles.moveChipActive]}>
                                <Text style={[styles.moveChipText, currentIndex === 0 && styles.moveChipTextActive]}>Start</Text>
                            </Pressable>

                            {analysis.moves.map((m, i) => {
                                const meta = CLASSIFICATION_META[m.classification];
                                const isActive = currentIndex === i + 1;

                                return (
                                    <Pressable
                                        key={i}
                                        onPress={() => setCurrentIndex(i + 1)}
                                        style={[styles.moveChip, isActive && { backgroundColor: meta.color, borderColor: meta.color }]}
                                    >
                                        <Text style={[styles.moveChipText, { color: isActive ? "#12151B" : meta.color }]}>{m.moveNumber}. {m.san}</Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.navRow}>
                            <Pressable
                                onPress={() => { setIsPlaying(false); setCurrentIndex((i) => Math.max(0, i - 1)); }}
                                style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
                            >
                                <Text style={styles.navButtonText}>‹  Zurück</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => { if (currentIndex >= analysis.moves.length) setCurrentIndex(0); setIsPlaying((p) => !p); }}
                                style={({ pressed }) => [styles.playButton, pressed && styles.navButtonPressed]}
                            >
                                <Text style={styles.playButtonText}>{isPlaying ? "❚❚" : "▶"}</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => { setIsPlaying(false); setCurrentIndex((i) => Math.min(analysis.moves.length, i + 1)); }}
                                style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
                            >
                                <Text style={styles.navButtonText}>Weiter  ›</Text>
                            </Pressable>
                        </View>

                        <View style={styles.speedRow}>
                            {[0.5, 1, 2].map((s) => (
                                <Pressable key={s} onPress={() => setPlaySpeed(s)} style={[styles.speedChip, playSpeed === s && styles.speedChipActive]}>
                                    <Text style={[styles.speedChipText, playSpeed === s && styles.speedChipTextActive]}>{s}×</Text>
                                </Pressable>
                            ))}
                            <Text style={styles.navIndex}>{currentIndex} / {analysis.moves.length}</Text>
                        </View>

                        {reportLines.length > 0 && (
                            <View style={styles.reportPanel}>
                                <Text style={styles.reportTitle}>Kurzreport</Text>
                                {reportLines.map((line, i) => (
                                    <Text key={i} style={styles.reportLine}>{line}</Text>
                                ))}
                            </View>
                        )}

                        <View style={styles.statsPanel}>
                            <View style={styles.statsHeaderRow}>
                                <Text style={styles.statsTitle}>Zugstatistik</Text>
                                <View style={styles.statsHeaderLegend}>
                                    <Text style={styles.statsHeaderLegendText}>Weiß</Text>
                                    <Text style={styles.statsHeaderLegendText}>Schwarz</Text>
                                </View>
                            </View>

                            {(Object.keys(CLASSIFICATION_META) as MoveClassification[]).map((key) => {
                                const meta = CLASSIFICATION_META[key];
                                const w = whiteCounts[key] || 0;
                                const b = blackCounts[key] || 0;
                                if (w === 0 && b === 0) return null;

                                return (
                                    <View key={key} style={styles.statsRow}>
                                        <View style={[styles.statsIconWrap, { backgroundColor: `${meta.color}1F` }]}>
                                            <Text style={[styles.statsIcon, { color: meta.color }]}>{meta.icon}</Text>
                                        </View>
                                        <View style={styles.statsLabelWrap}>
                                            <Text style={styles.statsLabel}>{meta.label}</Text>
                                            <View style={styles.statsBarTrack}>
                                                <View style={[styles.statsBarFill, { width: `${(w / maxCount) * 50}%`, backgroundColor: meta.color }]} />
                                                <View style={[styles.statsBarFill, { width: `${(b / maxCount) * 50}%`, backgroundColor: meta.color, opacity: 0.4, left: "50%" }]} />
                                            </View>
                                        </View>
                                        <Text style={styles.statsCount}>{w} · {b}</Text>
                                    </View>
                                );
                            })}
                        </View>

                        {recentGames.length > 1 && (
                            <View style={styles.trendPanel}>
                                <Text style={styles.reportTitle}>Dein Verlauf</Text>
                                <Text style={styles.trendSubtitle}>Ø-Genauigkeit der letzten {recentGames.length} analysierten Partien</Text>
                                <View style={styles.trendBars}>
                                    {recentGames.map((g) => (
                                        <View key={g.id} style={styles.trendBarWrap}>
                                            <View style={[styles.trendBar, { height: `${(g.accuracy / maxRecentAccuracy) * 100}%` }]} />
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 50 },
    center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center", paddingHorizontal: 36, gap: 10 },
    loadingText: { color: COLORS.textSecondary, fontSize: 14, marginTop: 14, letterSpacing: 0.2 },
    emptyTitle: { color: COLORS.textPrimary, fontSize: 19, fontWeight: "600" },
    emptyText: { color: COLORS.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 280 },
    vipBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 8, backgroundColor: COLORS.accentSoft, borderWidth: 1, borderColor: COLORS.accentBorder, marginBottom: 4 },
    vipBadgeText: { color: COLORS.accent, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
    vipButton: { backgroundColor: COLORS.accent, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 12, marginTop: 10 },
    vipButtonPressed: { opacity: 0.85 },
    vipButtonText: { color: "#12151B", fontWeight: "700", fontSize: 14 },

    header: { width: "100%", paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    iconButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surface, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
    backText: { color: COLORS.textPrimary, fontSize: 26, lineHeight: 26, fontWeight: "300" },
    shareText: { color: COLORS.accent, fontSize: 18, fontWeight: "600" },
    headerTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: "600", letterSpacing: 0.2 },

    modeTabs: { flexDirection: "row", alignSelf: "center", backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 4, marginBottom: 16, gap: 4 },
    modeTab: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 9 },
    modeTabActive: { backgroundColor: COLORS.accent },
    modeTabText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "600" },
    modeTabTextActive: { color: "#12151B" },

    engineRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
    engineText: { color: COLORS.textTertiary, fontSize: 11.5, letterSpacing: 0.2 },
    openingText: { color: COLORS.accent, fontSize: 11.5, fontWeight: "600" },

    accuracyRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20, overflow: "hidden" },
    accuracyCard: { flex: 1, alignItems: "center", paddingVertical: 14, gap: 3 },
    accuracyDivider: { width: 1, alignSelf: "stretch", backgroundColor: COLORS.border },
    accuracyDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 2 },
    accuracyLabel: { color: COLORS.textSecondary, fontSize: 12 },
    accuracyValue: { color: COLORS.textPrimary, fontSize: 22, fontWeight: "700" },

    boardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    evalBarVertical: { width: 12, height: BOARD_SIZE, borderRadius: 6, backgroundColor: COLORS.evalTrack, overflow: "hidden" },
    evalBarBlack: { width: "100%", backgroundColor: COLORS.evalFill },
    evalBarMidline: { position: "absolute", top: "50%", width: "100%", height: 1, backgroundColor: "rgba(0,0,0,0.15)" },
    boardFrame: { padding: 8, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
    board: { width: BOARD_SIZE, height: BOARD_SIZE, flexDirection: "row", flexWrap: "wrap", borderRadius: 8, overflow: "hidden" },
    square: { width: SQUARE_SIZE, height: SQUARE_SIZE, justifyContent: "center", alignItems: "center" },
    piece: { width: SQUARE_SIZE * 0.9, height: SQUARE_SIZE * 0.9 },

    classificationBanner: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18, paddingVertical: 12, paddingRight: 16, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, width: BOARD_SIZE + 24, overflow: "hidden" },
    classificationStripe: { width: 4, alignSelf: "stretch" },
    classificationIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    classificationIcon: { fontSize: 15, fontWeight: "800" },
    classificationSan: { color: COLORS.textPrimary, fontSize: 15, fontWeight: "600" },
    classificationLabel: { fontSize: 12.5, fontWeight: "600", marginTop: 1 },
    classificationLabelIdle: { color: COLORS.textSecondary, fontSize: 13.5, marginLeft: 4 },

    sandboxControls: { width: BOARD_SIZE + 24, marginTop: 18, alignItems: "center", gap: 10 },
    sandboxHint: { color: COLORS.textSecondary, fontSize: 12.5, textAlign: "center" },
    sandboxButtonsRow: { flexDirection: "row", gap: 12 },

    turningList: { marginTop: 4, maxHeight: 40, width: BOARD_SIZE + 24 },
    turningLabel: { color: COLORS.textTertiary, fontSize: 12, alignSelf: "center", marginRight: 8 },
    turningChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.accentSoft, borderWidth: 1, borderColor: COLORS.accentBorder, marginRight: 7, justifyContent: "center" },
    turningChipText: { color: COLORS.accent, fontSize: 12, fontWeight: "600" },

    moveList: { marginTop: 14, maxHeight: 44, width: BOARD_SIZE + 24 },
    moveChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, marginRight: 7 },
    moveChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
    moveChipText: { color: COLORS.textSecondary, fontSize: 12.5, fontWeight: "600" },
    moveChipTextActive: { color: "#12151B" },

    navRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 18 },
    navButton: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 11, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
    navButtonPressed: { backgroundColor: COLORS.surfaceRaised },
    navButtonText: { color: COLORS.textPrimary, fontWeight: "600", fontSize: 13.5 },
    playButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.accent, justifyContent: "center", alignItems: "center" },
    playButtonText: { color: "#12151B", fontSize: 15, fontWeight: "700" },
    navIndex: { color: COLORS.textTertiary, fontSize: 12.5, fontVariant: ["tabular-nums"], minWidth: 44, textAlign: "center" },

    speedRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12 },
    speedChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
    speedChipActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accentBorder },
    speedChipText: { color: COLORS.textSecondary, fontSize: 11.5, fontWeight: "600" },
    speedChipTextActive: { color: COLORS.accent },

    reportPanel: { width: BOARD_SIZE + 24, marginTop: 24, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 16, gap: 6 },
    reportTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: 2 },
    reportLine: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },

    statsPanel: { width: BOARD_SIZE + 24, marginTop: 16, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
    statsHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    statsTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "600" },
    statsHeaderLegend: { flexDirection: "row", gap: 14 },
    statsHeaderLegendText: { color: COLORS.textTertiary, fontSize: 11, width: 28, textAlign: "right" },
    statsRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
    statsIconWrap: { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center", marginRight: 10 },
    statsIcon: { fontSize: 12, fontWeight: "800" },
    statsLabelWrap: { flex: 1, gap: 4 },
    statsLabel: { color: COLORS.textPrimary, fontSize: 12.5, fontWeight: "500" },
    statsBarTrack: { flexDirection: "row", height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.05)", overflow: "hidden", position: "relative" },
    statsBarFill: { position: "absolute", top: 0, height: 4, borderRadius: 2 },
    statsCount: { color: COLORS.textSecondary, fontSize: 12, fontVariant: ["tabular-nums"], marginLeft: 10, minWidth: 40, textAlign: "right" },

    trendPanel: { width: BOARD_SIZE + 24, marginTop: 16, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
    trendSubtitle: { color: COLORS.textTertiary, fontSize: 11.5, marginBottom: 12 },
    trendBars: { flexDirection: "row", alignItems: "flex-end", height: 60, gap: 6 },
    trendBarWrap: { flex: 1, height: "100%", justifyContent: "flex-end" },
    trendBar: { backgroundColor: COLORS.accent, borderRadius: 3, minHeight: 4 },
});
