import { Chess } from "chess.js";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator, Dimensions, Image, PanResponder, Pressable, ScrollView,
    StyleSheet, Text, View,
} from "react-native";
// npx expo install react-native-view-shot expo-sharing
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
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
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

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
    // Brett – identisch zum Spielbrett
    boardLight: "#e7d5b7",
    boardDark: "#b58863",
    lastTo: "#6bb6ff",
    lastFrom: "#4da3ff",
    selected: "#4da3ff",
    check: "#ff4d4d",
    evalTrack: "#ECEDEE",
    evalFill: "#20242B",
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

const PIECE_SCALE: Record<string, number> = {
    wp: 1.35, wn: 1.55, wb: 1.7, wr: 1.65, wq: 1.55, wk: 1.3,
    bp: 1.3, bn: 1.2, bb: 1.3, br: 1.15, bq: 1.25, bk: 1.15,
};
const PIECE_SHIFT: Record<string, number> = {
    wb: -1.1, wr: -2, wq: -2, wp: 1.2, bp: 2, bn: 2, br: 2, bq: 2, bb: 0.5,
};
const pieceTransform = (key: string) => [
    { scale: PIECE_SCALE[key] ?? 1 },
    { translateY: PIECE_SHIFT[key] ?? 0 },
];

const pieceToKey = (piece: any) => (piece ? `${piece.color}${piece.type}` : null);

// ───────────────────────── Zugbewertung ─────────────────────────
// Nur die gängigen Kategorien. Die Bewertung wird hier aus den Engine-Werten
// berechnet (Gewinnwahrscheinlichkeit), damit Statistik, Genauigkeit und
// Kurzreport immer zusammenpassen.

type MoveClassification = "brilliant" | "best" | "good" | "inaccuracy" | "mistake" | "blunder" | "missed_win";

type AnalysisMove = { moveNumber: number; san: string; evalCp: number | null; bestMove: string; classification?: string };

type Analysis = {
    depth: number; tier: string; moves: AnalysisMove[];
    accuracy?: { w: number | null; b: number | null };
};

const CLASSIFICATION_META: Record<MoveClassification, { label: string; icon: string; color: string }> = {
    brilliant: { label: "Brillant", icon: "!!", color: "#3FB6DE" },
    best: { label: "Bester Zug", icon: "★", color: "#7C9473" },
    good: { label: "Gut", icon: "✓", color: "#9BB58F" },
    inaccuracy: { label: "Ungenauigkeit", icon: "?!", color: "#D2B45A" },
    mistake: { label: "Fehler", icon: "?", color: "#E0914D" },
    blunder: { label: "Patzer", icon: "??", color: "#DD6259" },
    missed_win: { label: "Gewinn verpasst", icon: "✗", color: "#B37FE0" },
};
const CLASS_ORDER: MoveClassification[] = ["brilliant", "best", "good", "inaccuracy", "mistake", "blunder", "missed_win"];
const NEG_KEYS: MoveClassification[] = ["blunder", "mistake", "inaccuracy", "missed_win"];
// "Gut" bekommt kein Badge auf dem Brett, damit es ruhig bleibt
const BADGE_HIDDEN: MoveClassification[] = ["good"];

const winPct = (cp: number) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
const moveAccuracy = (loss: number) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));
const round1 = (n: number) => Math.round(n * 10) / 10;
const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function evalSeries(moves: AnalysisMove[]): number[] {
    const out: number[] = [];
    let prev = 0;
    for (const m of moves) {
        prev = m.evalCp ?? prev;
        out.push(prev);
    }
    return out;
}

function moverStats(evals: number[], i: number) {
    const isWhite = i % 2 === 0;
    const prevCp = i === 0 ? 0 : evals[i - 1];
    const curCp = evals[i];
    const before = isWhite ? winPct(prevCp) : 100 - winPct(prevCp);
    const after = isWhite ? winPct(curCp) : 100 - winPct(curCp);
    return { before, after, loss: Math.max(0, before - after) };
}

function computeAccuracy(moves: AnalysisMove[]): { w: number | null; b: number | null } {
    const evals = evalSeries(moves);
    const sum = { w: 0, b: 0 };
    const cnt = { w: 0, b: 0 };
    moves.forEach((_, i) => {
        const side = i % 2 === 0 ? "w" : "b";
        sum[side] += moveAccuracy(moverStats(evals, i).loss);
        cnt[side] += 1;
    });
    return {
        w: cnt.w ? round1(sum.w / cnt.w) : null,
        b: cnt.b ? round1(sum.b / cnt.b) : null,
    };
}

type Ply = { from: string; to: string; uci: string; san: string; sacrifice: boolean };

function classifyMoves(moves: AnalysisMove[], plies: Ply[]): MoveClassification[] {
    const evals = evalSeries(moves);
    return moves.map((m, i) => {
        const { before, after, loss } = moverStats(evals, i);
        const ply = plies[i];
        const isBest = !!ply && !!m.bestMove && m.bestMove.slice(0, 4) === ply.uci.slice(0, 4);

        // Gewinn verpasst: klar gewonnen gewesen, danach nur noch Vorteil/Remis
        if (before >= 80 && after <= 65 && loss >= 12 && loss < 30) return "missed_win";
        if (loss > 20) return "blunder";
        if (loss > 10) return "mistake";
        if (loss > 5) return "inaccuracy";

        // Brillant: echtes Figurenopfer + (nahezu) bester Zug + nicht ohnehin schon gewonnen/verloren
        if (ply?.sacrifice && loss <= 2 && before < 85 && after >= 45) return "brilliant";

        if (isBest || loss <= 0.5) return "best";
        return "good";
    });
}

function computeCounts(classes: MoveClassification[]) {
    const counts: Record<"w" | "b", Partial<Record<MoveClassification, number>>> = { w: {}, b: {} };
    classes.forEach((c, i) => {
        const side = i % 2 === 0 ? "w" : "b";
        counts[side][c] = (counts[side][c] || 0) + 1;
    });
    return counts;
}

// ───────────────────────── Eröffnung ─────────────────────────
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

// ───────────────────────── Kurzreport ─────────────────────────
function buildReport(acc: { w: number | null; b: number | null }, counts: ReturnType<typeof computeCounts>): string[] {
    const worst = (c: Partial<Record<MoveClassification, number>>) => {
        let bestKey: MoveClassification | null = null;
        let bestVal = 0;
        for (const k of NEG_KEYS) {
            const v = c[k] || 0;
            if (v > bestVal) { bestVal = v; bestKey = k; }
        }
        return bestKey ? { key: bestKey, count: bestVal } : null;
    };

    const lines: string[] = [];
    const wAcc = acc.w ?? 0;
    const bAcc = acc.b ?? 0;
    const fmt = (n: number) => n.toFixed(1);

    if (wAcc >= bAcc + 5) lines.push(`Weiß spielte insgesamt präziser (${fmt(wAcc)}% gegenüber ${fmt(bAcc)}%).`);
    else if (bAcc >= wAcc + 5) lines.push(`Schwarz spielte insgesamt präziser (${fmt(bAcc)}% gegenüber ${fmt(wAcc)}%).`);
    else lines.push(`Beide Seiten spielten ähnlich genau (${fmt(wAcc)}% zu ${fmt(bAcc)}%).`);

    const w = worst(counts.w);
    const b = worst(counts.b);
    if (w) lines.push(`Größte Schwachstelle für Weiß: ${CLASSIFICATION_META[w.key].label} (${w.count}×).`);
    if (b) lines.push(`Größte Schwachstelle für Schwarz: ${CLASSIFICATION_META[b.key].label} (${b.count}×).`);

    const brilliantTotal = (counts.w.brilliant || 0) + (counts.b.brilliant || 0);
    if (brilliantTotal === 1) lines.push("Die Partie enthält einen brillanten Zug.");
    else if (brilliantTotal > 1) lines.push(`Die Partie enthält ${brilliantTotal} brillante Züge.`);

    return lines;
}

// ───────────────────────── Brett-Helfer ─────────────────────────
function squareCenter(square: string, flipped: boolean) {
    const file = square.charCodeAt(0) - 97;
    const rank = parseInt(square[1], 10);
    const col = flipped ? 7 - file : file;
    const row = flipped ? rank - 1 : 8 - rank;
    return { x: col * SQUARE_SIZE + SQUARE_SIZE / 2, y: row * SQUARE_SIZE + SQUARE_SIZE / 2 };
}

function parseUci(uci: string): { from: string; to: string; promotion?: string } | null {
    const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?/.exec(uci);
    if (!m) return null;
    return { from: m[1], to: m[2], promotion: m[3] };
}

function findCheckedKing(game: Chess): string | null {
    if (!game.inCheck()) return null;
    const turn = game.turn();
    const b = game.board();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = b[r][c];
            if (p && p.type === "k" && p.color === turn) return `${FILES[c]}${8 - r}`;
        }
    }
    return null;
}

function formatEval(cp: number) {
    const v = Math.abs(cp) / 100;
    const s = v >= 10 ? v.toFixed(0) : v.toFixed(1);
    return `${cp > 0 ? "+" : cp < 0 ? "−" : ""}${s}`;
}

// Prüft, ob der letzte Zug ein echtes Figurenopfer war (Basis für "Brillant")
function isSacrifice(game: Chess, last: any): boolean {
    try {
        if (!last || last.piece === "p" || last.piece === "k") return false;
        const movedValue = PIECE_VALUE[last.piece];
        const capturedValue = last.captured ? PIECE_VALUE[last.captured] : 0;
        const replies = game.moves({ verbose: true }).filter((m: any) => m.to === last.to && m.captured);
        if (replies.length === 0) return false;
        const cheapest = replies.reduce((a: any, b: any) => (PIECE_VALUE[a.piece] <= PIECE_VALUE[b.piece] ? a : b));
        const probe = new Chess(game.fen());
        probe.move(cheapest.san);
        const recapture = probe.moves({ verbose: true }).some((m: any) => m.to === last.to && m.captured);
        const net = movedValue - (recapture ? PIECE_VALUE[cheapest.piece] : 0) - capturedValue;
        return net >= 2;
    } catch {
        return false;
    }
}

// ───────────────────────── Screen ─────────────────────────
export default function GameReview() {
    const params = useLocalSearchParams();
    const gameId = params.gameId as string;

    const [pgn, setPgn] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [status, setStatus] = useState<"loading" | "not_vip" | "analyzing" | "ready" | "error">("loading");
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [currentIndex, setCurrentIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [showBest, setShowBest] = useState(false);

    const [mode, setMode] = useState<"review" | "sandbox">("review");
    const [sandboxFen, setSandboxFen] = useState<string | null>(null);
    const [sandboxHistory, setSandboxHistory] = useState<string[]>([]);
    const [sandboxLast, setSandboxLast] = useState<{ from: string; to: string } | null>(null);
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

            if (error || !data) { setStatus("error"); return; }
            setPgn(data.pgn);

            if (data.analyzed && data.analysis) {
                setAnalysis(data.analysis);
                setStatus("ready");
                return;
            }

            const acc = await getCurrentAccount();
            if (!acc || !acc.vipTier || acc.vipTier === "none") { setStatus("not_vip"); return; }

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
        return () => { offProgress(); offComplete(); offError(); };
    }, [gameId]);

    // Stellungen, Zug-Infos (von/nach/UCI/Opfer) und Schach-Felder je Halbzug
    const { positions, fens, plies, checks } = useMemo(() => {
        const empty = { positions: [] as any[], fens: [] as string[], plies: [] as Ply[], checks: [] as (string | null)[] };
        if (!pgn) return empty;
        try {
            const source = new Chess();
            source.loadPgn(pgn);
            const verbose = source.history({ verbose: true }) as any[];

            const replay = new Chess();
            const boards = [replay.board()];
            const fensOut = [replay.fen()];
            const checksOut: (string | null)[] = [null];
            const pliesOut: Ply[] = [];

            for (const mv of verbose) {
                const done: any = replay.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
                boards.push(replay.board());
                fensOut.push(replay.fen());
                checksOut.push(findCheckedKing(replay));
                pliesOut.push({
                    from: mv.from,
                    to: mv.to,
                    uci: `${mv.from}${mv.to}${mv.promotion ?? ""}`,
                    san: mv.san,
                    sacrifice: isSacrifice(replay, done),
                });
            }
            return { positions: boards, fens: fensOut, plies: pliesOut, checks: checksOut };
        } catch {
            return empty;
        }
    }, [pgn]);

    const openingName = useMemo(() => {
        if (plies.length === 0) return null;
        return detectOpening(plies.map((p) => p.san));
    }, [plies]);

    const classes = useMemo(() => (analysis ? classifyMoves(analysis.moves, plies) : []), [analysis, plies]);
    const counts = useMemo(() => computeCounts(classes), [classes]);
    const accuracy = useMemo(() => (analysis ? computeAccuracy(analysis.moves) : { w: null, b: null }), [analysis]);
    const evals = useMemo(() => (analysis ? evalSeries(analysis.moves) : []), [analysis]);
    const reportLines = useMemo(() => (analysis ? buildReport(accuracy, counts) : []), [analysis, accuracy, counts]);

    const turningPoints = useMemo(() => {
        if (!analysis) return [] as { index: number; delta: number }[];
        let prevEval = 0;
        const deltas = evals.map((cur, i) => {
            const delta = Math.abs(cur - prevEval);
            prevEval = cur;
            return { index: i, delta };
        });
        return deltas.filter((d) => d.delta >= 150).sort((a, b) => b.delta - a.delta).slice(0, 3).sort((a, b) => a.index - b.index);
    }, [analysis, evals]);

    const sandboxGameObj = useMemo(() => {
        if (!sandboxFen) return null;
        const g = new Chess();
        try { g.load(sandboxFen); } catch { return null; }
        return g;
    }, [sandboxFen]);

    // Bester Zug (SAN) zum aktuellen Halbzug – aus der Stellung VOR dem Zug
    const bestInfo = useMemo(() => {
        if (!analysis || currentIndex === 0) return null;
        const mv = analysis.moves[currentIndex - 1];
        const parsed = mv?.bestMove ? parseUci(mv.bestMove) : null;
        if (!parsed || !fens[currentIndex - 1]) return null;
        try {
            const g = new Chess(fens[currentIndex - 1]);
            const res = g.move({ from: parsed.from, to: parsed.to, promotion: parsed.promotion });
            return res ? { ...parsed, san: res.san } : null;
        } catch { return null; }
    }, [analysis, currentIndex, fens]);

    useEffect(() => { setShowBest(false); }, [currentIndex, mode]);

    useEffect(() => {
        if (!isPlaying || !analysis) return;
        const id = setInterval(() => {
            setCurrentIndex((i) => {
                if (i >= analysis.moves.length) { setIsPlaying(false); return i; }
                return i + 1;
            });
        }, 900 / playSpeed);
        return () => clearInterval(id);
    }, [isPlaying, playSpeed, analysis]);

    // Verlauf: ANNAHME Spalten "white_id" / "black_id" – ggf. ans Schema anpassen
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
                        .map((g: any) => {
                            const acc2 = g.analysis?.moves ? computeAccuracy(g.analysis.moves) : null;
                            return {
                                id: g.id,
                                date: g.created_at,
                                accuracy: acc2 && acc2.w != null && acc2.b != null ? Math.round((acc2.w + acc2.b) / 2) : null,
                            };
                        })
                        .filter((g: any) => g.accuracy !== null)
                        .reverse();
                    setRecentGames(parsed as any);
                }
            } catch { /* optional */ }
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
        setSandboxHistory([]);
        setSandboxLast(null);
        setSelectedSquare(null);
        setIsPlaying(false);
        setMode("sandbox");
    }

    function exitSandbox() {
        setMode("review");
        setSandboxFen(null);
        setSandboxHistory([]);
        setSandboxLast(null);
        setSelectedSquare(null);
    }

    function handleSandboxSquarePress(square: string) {
        if (!sandboxGameObj) return;
        const piece = sandboxGameObj.get(square as any);

        if (!selectedSquare) {
            if (piece && piece.color === sandboxGameObj.turn()) setSelectedSquare(square);
            return;
        }
        if (selectedSquare === square) { setSelectedSquare(null); return; }
        // anderes eigenes Stück antippen = Auswahl wechseln
        if (piece && piece.color === sandboxGameObj.turn()) { setSelectedSquare(square); return; }

        try {
            const move = sandboxGameObj.move({ from: selectedSquare, to: square, promotion: "q" } as any);
            if (move) {
                setSandboxHistory((h) => [...h, sandboxFen as string]);
                setSandboxLast({ from: move.from, to: move.to });
                setSandboxFen(sandboxGameObj.fen());
            }
        } catch { /* ungültiger Zug */ }
        setSelectedSquare(null);
    }

    function undoSandbox() {
        setSandboxHistory((h) => {
            if (h.length === 0) return h;
            setSandboxFen(h[h.length - 1]);
            setSandboxLast(null);
            setSelectedSquare(null);
            return h.slice(0, -1);
        });
    }

    async function handleShare() {
        try {
            const uri = await captureRef(shareRef, { format: "png", quality: 0.92 });
            if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
        } catch { /* optional */ }
    }

    if (status === "loading" || status === "analyzing") {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={COLORS.accent} size="large" />
                {status === "analyzing" && (
                    <Text style={styles.loadingText}>Partie wird analysiert · {progress.done}/{progress.total || "?"}</Text>
                )}
            </View>
        );
    }

    if (status === "not_vip") {
        return (
            <View style={styles.center}>
                <View style={styles.vipBadge}><Text style={styles.vipBadgeText}>VIP</Text></View>
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

    // ── Abgeleitete Werte für das Rendern ──
    const total = analysis.moves.length;
    const isSandbox = mode === "sandbox" && !!sandboxGameObj;
    const showingBest = mode === "review" && showBest && !!bestInfo && currentIndex > 0;

    const board = isSandbox
        ? sandboxGameObj!.board()
        : positions[showingBest ? currentIndex - 1 : currentIndex] ?? positions[0];

    const playedPly = currentIndex > 0 ? plies[currentIndex - 1] : null;
    const currentMove = currentIndex > 0 ? analysis.moves[currentIndex - 1] : null;
    const currentClass = currentIndex > 0 ? classes[currentIndex - 1] : null;
    const currentMeta = currentClass ? CLASSIFICATION_META[currentClass] : null;

    const lastMove = isSandbox ? sandboxLast : showingBest ? null : playedPly ? { from: playedPly.from, to: playedPly.to } : null;
    const checkSquare = isSandbox ? findCheckedKing(sandboxGameObj!) : checks[showingBest ? currentIndex - 1 : currentIndex] ?? null;

    const legalTargets = new Set<string>();
    if (isSandbox && selectedSquare) {
        (sandboxGameObj!.moves({ square: selectedSquare as any, verbose: true }) as any[]).forEach((m) => legalTargets.add(m.to));
    }

    const evalCp = currentIndex > 0 ? evals[currentIndex - 1] ?? 0 : 0;
    const whiteFraction = winPct(Math.max(-1000, Math.min(1000, evalCp))) / 100;

    const whiteCounts = counts.w;
    const blackCounts = counts.b;
    const maxCount = Math.max(1, ...Object.values(whiteCounts).map(Number), ...Object.values(blackCounts).map(Number));

    const arrow = (() => {
        if (!showingBest || !bestInfo) return null;
        const from = squareCenter(bestInfo.from, flipped);
        const to = squareCenter(bestInfo.to, flipped);
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        return {
            length: Math.sqrt(dx * dx + dy * dy),
            angle: Math.atan2(dy, dx),
            mid: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
        };
    })();

    const maxRecentAccuracy = Math.max(1, ...recentGames.map((g) => g.accuracy));
    const showBestButton = !!currentClass && !["best", "brilliant"].includes(currentClass) && !!bestInfo;

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.iconButton}><Text style={styles.backText}>‹</Text></Pressable>
                <Text style={styles.headerTitle}>Partieanalyse</Text>
                <Pressable onPress={handleShare} style={styles.iconButton}><Text style={styles.shareText}>↗</Text></Pressable>
            </View>

            <View style={styles.modeTabs}>
                <Pressable onPress={exitSandbox} style={[styles.modeTab, mode === "review" && styles.modeTabActive]}>
                    <Text style={[styles.modeTabText, mode === "review" && styles.modeTabTextActive]}>Analyse</Text>
                </Pressable>
                <Pressable onPress={enterSandbox} style={[styles.modeTab, mode === "sandbox" && styles.modeTabActive]}>
                    <Text style={[styles.modeTabText, mode === "sandbox" && styles.modeTabTextActive]}>Sandbox</Text>
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ alignItems: "center", paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                <View ref={shareRef} collapsable={false} style={{ alignItems: "center", backgroundColor: COLORS.bg, paddingBottom: 4 }}>
                    <View style={styles.engineRow}>
                        <Text style={styles.engineText}>{analysis.tier} · Tiefe {analysis.depth}</Text>
                        {openingName && mode === "review" && <Text style={styles.openingText}>{openingName}</Text>}
                    </View>

                    <View style={styles.accuracyRow}>
                        <View style={styles.accuracyCard}>
                            <View style={[styles.accuracyDot, { backgroundColor: "#ECEDEE" }]} />
                            <Text style={styles.accuracyLabel}>Weiß</Text>
                            <Text style={styles.accuracyValue}>{accuracy.w != null ? accuracy.w.toFixed(1) : "–"}%</Text>
                        </View>
                        <View style={styles.accuracyDivider} />
                        <View style={styles.accuracyCard}>
                            <View style={[styles.accuracyDot, { backgroundColor: "#4B5058" }]} />
                            <Text style={styles.accuracyLabel}>Schwarz</Text>
                            <Text style={styles.accuracyValue}>{accuracy.b != null ? accuracy.b.toFixed(1) : "–"}%</Text>
                        </View>
                    </View>

                    <View style={styles.boardRow}>
                        {mode === "review" && (
                            <View style={styles.evalWrap}>
                                <View style={[styles.evalBarVertical, { justifyContent: flipped ? "flex-end" : "flex-start" }]}>
                                    <View style={[styles.evalBarBlack, { height: `${(1 - whiteFraction) * 100}%` }]} />
                                    <View style={styles.evalBarMidline} />
                                </View>
                            </View>
                        )}

                        <View style={styles.boardFrame} {...(mode === "review" ? panResponder.panHandlers : {})}>
                            <View style={{ width: BOARD_SIZE, height: BOARD_SIZE }}>
                                <View style={styles.board}>
                                    {Array.from({ length: 8 }).map((_, r) =>
                                        Array.from({ length: 8 }).map((__, c) => {
                                            const br = flipped ? 7 - r : r;
                                            const bc = flipped ? 7 - c : c;
                                            const piece = board[br][bc];
                                            const key = pieceToKey(piece);
                                            const square = `${FILES[bc]}${8 - br}`;
                                            const isDark = (br + bc) % 2 === 1;

                                            const isCheckSq = checkSquare === square;
                                            const isLastTo = lastMove?.to === square;
                                            const isLastFrom = lastMove?.from === square;
                                            const isSelected = isSandbox && selectedSquare === square;
                                            const isLegal = legalTargets.has(square);

                                            const bg = isCheckSq ? COLORS.check
                                                : isLastTo ? COLORS.lastTo
                                                : isLastFrom ? COLORS.lastFrom
                                                : isSelected ? COLORS.selected
                                                : isDark ? COLORS.boardDark : COLORS.boardLight;

                                            const showBadge = !!currentClass && !showingBest && !isSandbox && isLastTo && !BADGE_HIDDEN.includes(currentClass);
                                            const labelColor = isDark ? "#e5e7eb" : "#334155";

                                            return (
                                                <Pressable
                                                    key={square}
                                                    disabled={!isSandbox}
                                                    onPress={() => handleSandboxSquarePress(square)}
                                                    style={[styles.square, { backgroundColor: bg }]}
                                                >
                                                    {key && (
                                                        <Image source={pieces[key]} style={[styles.piece, { transform: pieceTransform(key) }]} resizeMode="contain" />
                                                    )}
                                                    {isLegal && <View style={key ? styles.dotCapture : styles.dot} />}

                                                    {c === 0 && <Text style={[styles.coordLabel, { top: 2, left: 2, color: labelColor }]}>{8 - br}</Text>}
                                                    {r === 7 && <Text style={[styles.coordLabel, { bottom: 2, right: 3, color: labelColor }]}>{FILES[bc]}</Text>}

                                                    {showBadge && currentMeta && (
                                                        <View style={[styles.badge, { backgroundColor: currentMeta.color }]}>
                                                            <Text style={styles.badgeText}>{currentMeta.icon}</Text>
                                                        </View>
                                                    )}
                                                </Pressable>
                                            );
                                        })
                                    )}
                                </View>

                                {arrow && (
                                    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
                                        <View
                                            style={{
                                                position: "absolute",
                                                left: arrow.mid.x - arrow.length / 2,
                                                top: arrow.mid.y - 7,
                                                width: arrow.length,
                                                height: 14,
                                                justifyContent: "center",
                                                transform: [{ rotate: `${arrow.angle}rad` }],
                                                opacity: 0.9,
                                            }}
                                        >
                                            <View style={{ position: "absolute", left: 0, width: Math.max(0, arrow.length - 12), height: 6, backgroundColor: COLORS.accent, borderRadius: 3 }} />
                                            <View style={styles.arrowHead} />
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>

                    {mode === "review" && (
                        <View style={styles.classificationBanner}>
                            {currentMove && currentMeta ? (
                                <>
                                    <View style={[styles.classificationStripe, { backgroundColor: currentMeta.color }]} />
                                    <View style={[styles.classificationIconWrap, { backgroundColor: `${currentMeta.color}22` }]}>
                                        <Text style={[styles.classificationIcon, { color: currentMeta.color }]}>{currentMeta.icon}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.classificationSan}>{currentIndex % 2 === 1 ? `${Math.ceil(currentIndex / 2)}.` : `${Math.ceil(currentIndex / 2)}...`} {currentMove.san}</Text>
                                        <Text style={[styles.classificationLabel, { color: currentMeta.color }]}>{currentMeta.label}</Text>
                                    </View>
                                    <Text style={styles.evalText}>{formatEval(evalCp)}</Text>
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

                {mode === "review" && showBestButton && bestInfo && (
                    <Pressable onPress={() => setShowBest((s) => !s)} style={[styles.bestButton, showBest && styles.bestButtonActive]}>
                        <Text style={[styles.bestButtonText, showBest && { color: "#12151B" }]}>
                            {showBest ? "Zurück zum gespielten Zug" : `Besser wäre ${bestInfo.san} gewesen – zeigen`}
                        </Text>
                    </Pressable>
                )}

                {mode === "sandbox" ? (
                    <View style={styles.sandboxControls}>
                        <Text style={styles.sandboxHint}>Sandbox · eigene Züge ohne Engine-Bewertung</Text>
                        <View style={styles.sandboxButtonsRow}>
                            <Pressable onPress={undoSandbox} style={[styles.navButton, sandboxHistory.length === 0 && { opacity: 0.4 }]}>
                                <Text style={styles.navButtonText}>Zug zurück</Text>
                            </Pressable>
                            <Pressable onPress={() => { setSandboxFen(fens[currentIndex] ?? fens[0]); setSandboxHistory([]); setSandboxLast(null); setSelectedSquare(null); }} style={styles.navButton}>
                                <Text style={styles.navButtonText}>Zurücksetzen</Text>
                            </Pressable>
                            <Pressable onPress={() => setFlipped((f) => !f)} style={styles.navButton}>
                                <Text style={styles.navButtonText}>⇅</Text>
                            </Pressable>
                        </View>
                        <Pressable onPress={exitSandbox} style={[styles.navButton, { backgroundColor: COLORS.accent, borderColor: COLORS.accent }]}>
                            <Text style={[styles.navButtonText, { color: "#12151B" }]}>Zurück zur Analyse</Text>
                        </Pressable>
                    </View>
                ) : (
                    <>
                        {/* Bewertungsverlauf: antippen springt zum Zug */}
                        <View style={styles.graphPanel}>
                            <View style={styles.graphHeader}>
                                <Text style={styles.reportTitle}>Bewertungsverlauf</Text>
                                <Pressable onPress={() => setFlipped((f) => !f)}><Text style={styles.flipText}>Brett drehen ⇅</Text></Pressable>
                            </View>
                            <View style={styles.graphBars}>
                                {evals.map((cp, i) => {
                                    const wp = winPct(Math.max(-1000, Math.min(1000, cp)));
                                    const cls = classes[i];
                                    const hot = cls === "blunder" || cls === "mistake" || cls === "missed_win";
                                    return (
                                        <Pressable key={i} onPress={() => { setIsPlaying(false); setCurrentIndex(i + 1); }} style={[styles.graphCol, currentIndex === i + 1 && styles.graphColActive]}>
                                            <View style={{ height: `${100 - wp}%`, backgroundColor: COLORS.evalFill }} />
                                            {hot && <View style={[styles.graphMark, { backgroundColor: CLASSIFICATION_META[cls].color }]} />}
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>

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
                                const meta = CLASSIFICATION_META[classes[i]];
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
                            <Pressable onPress={() => { setIsPlaying(false); setCurrentIndex((i) => Math.max(0, i - 1)); }} style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}>
                                <Text style={styles.navButtonText}>‹  Zurück</Text>
                            </Pressable>
                            <Pressable onPress={() => { if (currentIndex >= total) setCurrentIndex(0); setIsPlaying((p) => !p); }} style={({ pressed }) => [styles.playButton, pressed && styles.navButtonPressed]}>
                                <Text style={styles.playButtonText}>{isPlaying ? "❚❚" : "▶"}</Text>
                            </Pressable>
                            <Pressable onPress={() => { setIsPlaying(false); setCurrentIndex((i) => Math.min(total, i + 1)); }} style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}>
                                <Text style={styles.navButtonText}>Weiter  ›</Text>
                            </Pressable>
                        </View>

                        <View style={styles.speedRow}>
                            {[0.5, 1, 2].map((s) => (
                                <Pressable key={s} onPress={() => setPlaySpeed(s)} style={[styles.speedChip, playSpeed === s && styles.speedChipActive]}>
                                    <Text style={[styles.speedChipText, playSpeed === s && styles.speedChipTextActive]}>{s}×</Text>
                                </Pressable>
                            ))}
                            <Text style={styles.navIndex}>{currentIndex} / {total}</Text>
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

                            {CLASS_ORDER.map((key) => {
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

    accuracyRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20, overflow: "hidden", width: BOARD_SIZE + 24 },
    accuracyCard: { flex: 1, alignItems: "center", paddingVertical: 14, gap: 3 },
    accuracyDivider: { width: 1, alignSelf: "stretch", backgroundColor: COLORS.border },
    accuracyDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 2 },
    accuracyLabel: { color: COLORS.textSecondary, fontSize: 12 },
    accuracyValue: { color: COLORS.textPrimary, fontSize: 22, fontWeight: "700" },

    boardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    evalWrap: { alignItems: "center" },
    evalBarVertical: { width: 12, height: BOARD_SIZE, borderRadius: 6, backgroundColor: COLORS.evalTrack, overflow: "hidden" },
    evalBarBlack: { width: "100%", backgroundColor: COLORS.evalFill },
    evalBarMidline: { position: "absolute", top: "50%", width: "100%", height: 1, backgroundColor: "rgba(0,0,0,0.15)" },
    boardFrame: { padding: 8, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
    board: { width: BOARD_SIZE, height: BOARD_SIZE, flexDirection: "row", flexWrap: "wrap", borderRadius: 8, overflow: "hidden" },
    square: { width: SQUARE_SIZE, height: SQUARE_SIZE, justifyContent: "center", alignItems: "center" },
    piece: { width: SQUARE_SIZE * 0.9, height: SQUARE_SIZE * 0.9 },
    coordLabel: { position: "absolute", fontSize: 9, fontWeight: "700" },
    dot: { position: "absolute", width: SQUARE_SIZE * 0.3, height: SQUARE_SIZE * 0.3, borderRadius: SQUARE_SIZE * 0.15, backgroundColor: "rgba(0,0,0,0.25)" },
    dotCapture: { position: "absolute", width: SQUARE_SIZE * 0.9, height: SQUARE_SIZE * 0.9, borderRadius: SQUARE_SIZE * 0.45, borderWidth: 3, borderColor: "rgba(0,0,0,0.25)" },
    badge: { position: "absolute", top: -1, right: -1, minWidth: 18, height: 18, paddingHorizontal: 3, borderRadius: 9, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.25)" },
    badgeText: { color: "#12151B", fontSize: 9, fontWeight: "900" },
    arrowHead: { position: "absolute", right: 0, width: 0, height: 0, borderTopWidth: 8, borderBottomWidth: 8, borderLeftWidth: 14, borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: COLORS.accent },

    classificationBanner: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18, paddingVertical: 12, paddingRight: 16, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, width: BOARD_SIZE + 24, overflow: "hidden" },
    classificationStripe: { width: 4, alignSelf: "stretch" },
    classificationIconWrap: { minWidth: 34, height: 34, paddingHorizontal: 4, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    classificationIcon: { fontSize: 15, fontWeight: "800" },
    classificationSan: { color: COLORS.textPrimary, fontSize: 15, fontWeight: "600" },
    classificationLabel: { fontSize: 12.5, fontWeight: "600", marginTop: 1 },
    classificationLabelIdle: { color: COLORS.textSecondary, fontSize: 13.5, marginLeft: 4 },
    evalText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] },

    bestButton: { marginTop: 12, width: BOARD_SIZE + 24, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentSoft, alignItems: "center" },
    bestButtonActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
    bestButtonText: { color: COLORS.accent, fontSize: 13, fontWeight: "600" },

    sandboxControls: { width: BOARD_SIZE + 24, marginTop: 18, alignItems: "center", gap: 12 },
    sandboxHint: { color: COLORS.textSecondary, fontSize: 12.5, textAlign: "center" },
    sandboxButtonsRow: { flexDirection: "row", gap: 10 },

    graphPanel: { width: BOARD_SIZE + 24, marginTop: 16, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
    graphHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    flipText: { color: COLORS.accent, fontSize: 12, fontWeight: "600" },
    graphBars: { flexDirection: "row", height: 56, borderRadius: 6, overflow: "hidden", backgroundColor: COLORS.evalTrack },
    graphCol: { flex: 1, height: "100%" },
    graphColActive: { backgroundColor: COLORS.accent },
    graphMark: { position: "absolute", bottom: 0, left: 0, right: 0, height: 3 },

    turningList: { marginTop: 14, maxHeight: 40, width: BOARD_SIZE + 24 },
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
    statsIconWrap: { minWidth: 28, height: 28, paddingHorizontal: 3, borderRadius: 8, justifyContent: "center", alignItems: "center", marginRight: 10 },
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