import { Chess } from "chess.js";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import AccuracyRing, { accuracyColor } from "../../components/review/AccuracyRing";
import AnalysisProgress, {
    AnalysisProgressState,
    EMPTY_PROGRESS,
} from "../../components/review/AnalysisProgress";
import ClassificationBadge from "../../components/review/ClassificationBadge";
import EvalGraph from "../../components/review/EvalGraph";
import MoveTable from "../../components/review/MoveTable";
import ReviewBoard, { EvalBar } from "../../components/review/ReviewBoard";
import LimitGate from "../../components/LimitGate";
import { T } from "../../components/ui/theme";
import { getCurrentAccount } from "../../lib/account";
import {
    CLASSIFICATION_META,
    CLASSIFICATION_ORDER,
    describeMove,
    formatEval,
    GameReview,
    isCurrentReview,
    moveLabel,
    normalizeAnalysis,
    Side,
    summarize,
    whiteShare,
} from "../../lib/analysis";
import { askCoach } from "../../lib/coach";
import {
    AnalysisError,
    confirmAnalysisAd,
    onAnalysisComplete,
    onAnalysisError,
    onAnalysisProgress,
    requestGameAnalysis,
} from "../../lib/games";
import { getSocket } from "../../lib/socket";
import { supabase } from "../../lib/supabase";
import { getLanguage, tr } from "../../lib/i18n";
import { reportTaskEvent } from "../../lib/dailyTasks";

const WINDOW_WIDTH = Dimensions.get("window").width;
const EVAL_BAR_SPACE = 28; // bar + gap
const BOARD_SIZE = Math.floor(Math.min(WINDOW_WIDTH - 32 - EVAL_BAR_SPACE, 420) / 8) * 8;
const CONTENT_WIDTH = BOARD_SIZE + EVAL_BAR_SPACE;
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

const coachImage = require("../../assets/images/coach.png");

const COACH_QUESTIONS = [
    "Why is this move good or bad?",
    "What was the idea behind the best move?",
    "What should my plan be here?",
];

// "limit": today's free analysis is used up (see LimitGate).
// "guest": not signed in - games of guests are not stored on the server.
type Status = "loading" | "guest" | "limit" | "analyzing" | "ready" | "error";

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

function parseUci(uci: string | null): { from: string; to: string } | null {
    const m = uci ? /^([a-h][1-8])([a-h][1-8])/.exec(uci) : null;
    return m ? { from: m[1], to: m[2] } : null;
}

const RESULT_TEXT: Record<string, string> = {
    get win() { return tr("You won"); },
    get loss() { return tr("You lost"); },
    get draw() { return tr("Draw"); },
    get aborted() { return tr("Aborted"); },
};

export default function GameReviewScreen() {
    const params = useLocalSearchParams();
    const gameId = params.gameId as string;
    const colorParam = params.color === "w" || params.color === "b" ? (params.color as Side) : null;

    const [pgn, setPgn] = useState<string | null>(null);
    const [review, setReview] = useState<GameReview | null>(null);
    const [status, setStatus] = useState<Status>("loading");

    // Daily tasks: looking at a finished analysis counts as "reviewed a game".
    const reviewCounted = useRef(false);
    useEffect(() => {
        if (status === "ready" && !reviewCounted.current) {
            reviewCounted.current = true;
            reportTaskEvent("game_reviewed");
        }
    }, [status]);
    const [progress, setProgress] = useState<AnalysisProgressState>(EMPTY_PROGRESS);

    // Daily limit: the window with "Upgrade" / "Watch an ad".
    const [gateOpen, setGateOpen] = useState(false);
    const [adsLeft, setAdsLeft] = useState<number | null>(null);
    // The analysis request that was sent when the ad started.
    const adRequest = useRef<Promise<unknown> | null>(null);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [showBest, setShowBest] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const [sandbox, setSandbox] = useState<{ fen: string; history: string[]; last: { from: string; to: string } | null } | null>(null);
    const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

    const [coachOpen, setCoachOpen] = useState(false);
    const [coachQuestion, setCoachQuestion] = useState("");
    const [coachBusy, setCoachBusy] = useState(false);
    const [coachAnswer, setCoachAnswer] = useState<{ ply: number; text: string; remaining?: number } | null>(null);
    const [coachError, setCoachError] = useState<string | null>(null);

    const [trend, setTrend] = useState<{ id: string; accuracy: number }[]>([]);

    const shareRef = useRef<View>(null);
    const scrollRef = useRef<ScrollView>(null);
    const boardY = useRef(0);

    // =============================
    // LOAD + ANALYSE
    // =============================

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const { data, error } = await supabase
                .from("games")
                .select("pgn, analyzed, analysis")
                .eq("id", gameId)
                .single();

            if (cancelled) return;
            if (error || !data) {
                setStatus("error");
                return;
            }

            setPgn(data.pgn);

            const stored = data.analyzed ? normalizeAnalysis(data.analysis) : null;

            if (stored && isCurrentReview(stored)) {
                setReview(stored);
                setStatus("ready");
                return;
            }

            const acc = await getCurrentAccount();
            if (cancelled) return;

            const isVip = !!acc?.vipTier && acc.vipTier !== "none";

            // An analysis in the old format: VIP gets it redone automatically.
            // Without VIP it is shown as it is - redoing it would use up
            // today's free analysis without being asked.
            if (stored && !isVip) {
                setReview(stored);
                setStatus("ready");
                return;
            }

            if (!acc?.authId || acc.guest) {
                setStatus("guest");
                return;
            }

            setStatus("analyzing");

            try {
                await requestGameAnalysis(getSocket(), gameId, colorParam);
            } catch (err: any) {
                if (cancelled) return;

                if (stored) {
                    setReview(stored);
                    setStatus("ready");
                } else if (err?.message === "DAILY_LIMIT") {
                    setAdsLeft((err as AnalysisError).quota?.adsLeft ?? null);
                    setStatus("limit");
                    setGateOpen(true);
                } else {
                    setStatus("error");
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [gameId, colorParam]);

    useEffect(() => {
        const socket = getSocket();

        const offProgress = onAnalysisProgress(socket, (data) => {
            if (data.gameId !== gameId) return;

            setProgress((prev) => {
                const feed = data.last ? [data.last, ...prev.feed].slice(0, 8) : prev.feed;
                const evals =
                    data.last && data.last.ply >= 0
                        ? { ...prev.evals, [data.last.ply]: { evalCp: data.last.evalCp, mate: !!data.last.mate } }
                        : prev.evals;

                return {
                    done: data.progress ?? prev.done,
                    total: data.total ?? prev.total,
                    queued: !!data.queued,
                    queuePosition: data.queuePosition ?? 0,
                    active: data.active ?? [],
                    feed,
                    evals,
                };
            });
        });

        const offComplete = onAnalysisComplete(socket, (data) => {
            if (data.gameId !== gameId) return;

            const next = normalizeAnalysis(data.analysis);
            if (!next) {
                setStatus("error");
                return;
            }

            setReview(next);
            setStatus("ready");
        });

        const offError = onAnalysisError(socket, (data) => {
            if (data.gameId !== gameId) return;
            setStatus((current) => (current === "ready" ? current : "error"));
        });

        return () => {
            offProgress();
            offComplete();
            offError();
        };
    }, [gameId]);

    // =============================
    // POSITIONS OF THE GAME
    // =============================

    const { boards, fens, plies, checks } = useMemo(() => {
        const empty = {
            boards: [] as any[][][],
            fens: [] as string[],
            plies: [] as { from: string; to: string }[],
            checks: [] as (string | null)[],
        };
        if (!pgn) return empty;

        try {
            const source = new Chess();
            source.loadPgn(pgn);
            const verbose = source.history({ verbose: true }) as any[];

            const replay = new Chess();
            const boardsOut: any[][][] = [replay.board()];
            const fensOut = [replay.fen()];
            const checksOut: (string | null)[] = [null];
            const pliesOut: { from: string; to: string }[] = [];

            for (const mv of verbose) {
                replay.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
                boardsOut.push(replay.board());
                fensOut.push(replay.fen());
                checksOut.push(findCheckedKing(replay));
                pliesOut.push({ from: mv.from, to: mv.to });
            }

            return { boards: boardsOut, fens: fensOut, plies: pliesOut, checks: checksOut };
        } catch {
            return empty;
        }
    }, [pgn]);

    // The user's own side at the bottom.
    useEffect(() => {
        if (review?.playerColor === "b") setFlipped(true);
    }, [review?.playerColor]);

    useEffect(() => {
        setShowBest(false);
    }, [currentIndex]);

    useEffect(() => {
        if (!isPlaying || !review) return;

        const id = setInterval(() => {
            setCurrentIndex((i) => {
                if (i >= review.moves.length) {
                    setIsPlaying(false);
                    return i;
                }
                return i + 1;
            });
        }, 1100);

        return () => clearInterval(id);
    }, [isPlaying, review]);

    // =============================
    // TREND OVER THE LAST GAMES
    // =============================

    useEffect(() => {
        if (status !== "ready") return;
        let cancelled = false;

        (async () => {
            try {
                const acc = await getCurrentAccount();
                if (!acc?.authId) return;

                const { data } = await supabase
                    .from("games")
                    .select("id, created_at, analysis")
                    .eq("user_id", acc.authId)
                    .eq("analyzed", true)
                    .order("created_at", { ascending: false })
                    .limit(8);

                if (cancelled || !data) return;

                const points = data
                    .map((g: any) => {
                        const r = normalizeAnalysis(g.analysis);
                        if (!r) return null;

                        const own = r.playerColor ? r.accuracy[r.playerColor] : null;
                        const both =
                            r.accuracy.w !== null && r.accuracy.b !== null ? (r.accuracy.w + r.accuracy.b) / 2 : null;
                        const accuracy = own ?? both;

                        return accuracy === null ? null : { id: g.id as string, accuracy };
                    })
                    .filter((p): p is { id: string; accuracy: number } => p !== null)
                    .reverse();

                setTrend(points);
            } catch {
                // The trend is optional.
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [status]);

    // =============================
    // SANDBOX
    // =============================

    const sandboxGame = useMemo(() => {
        if (!sandbox) return null;
        try {
            return new Chess(sandbox.fen);
        } catch {
            return null;
        }
    }, [sandbox]);

    function enterSandbox() {
        const fen = fens[currentIndex] ?? fens[0];
        if (!fen) return;
        setIsPlaying(false);
        setSelectedSquare(null);
        setSandbox({ fen, history: [], last: null });
    }

    function exitSandbox() {
        setSandbox(null);
        setSelectedSquare(null);
    }

    function handleSandboxPress(square: string) {
        if (!sandbox || !sandboxGame) return;

        const piece = sandboxGame.get(square as any);

        if (!selectedSquare) {
            if (piece && piece.color === sandboxGame.turn()) setSelectedSquare(square);
            return;
        }
        if (selectedSquare === square) {
            setSelectedSquare(null);
            return;
        }
        if (piece && piece.color === sandboxGame.turn()) {
            setSelectedSquare(square);
            return;
        }

        try {
            const move = sandboxGame.move({ from: selectedSquare, to: square, promotion: "q" } as any);
            if (move) {
                setSandbox({
                    fen: sandboxGame.fen(),
                    history: [...sandbox.history, sandbox.fen],
                    last: { from: move.from, to: move.to },
                });
            }
        } catch {
            // illegal move - ignore
        }
        setSelectedSquare(null);
    }

    function undoSandbox() {
        if (!sandbox || sandbox.history.length === 0) return;
        setSelectedSquare(null);
        setSandbox({
            fen: sandbox.history[sandbox.history.length - 1],
            history: sandbox.history.slice(0, -1),
            last: null,
        });
    }

    // =============================
    // ACTIONS
    // =============================

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy),
                onPanResponderRelease: (_, g) => {
                    if (!review) return;
                    if (g.dx < -30) setCurrentIndex((i) => Math.min(review.moves.length, i + 1));
                    else if (g.dx > 30) setCurrentIndex((i) => Math.max(0, i - 1));
                },
            }),
        [review]
    );

    async function handleShare() {
        try {
            const uri = await captureRef(shareRef, { format: "png", quality: 0.92 });
            if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
        } catch {
            // sharing is optional
        }
    }

    function goTo(index: number) {
        setIsPlaying(false);
        setCurrentIndex(index);
    }

    function jumpToKeyMoment(direction: 1 | -1) {
        if (!review) return;

        const targets = review.keyMoments.map((ply) => ply + 1);
        const next =
            direction === 1
                ? targets.find((t) => t > currentIndex)
                : [...targets].reverse().find((t) => t < currentIndex);

        if (next !== undefined) goTo(next);
    }

    function startReview() {
        const first = review?.keyMoments[0];
        goTo(first !== undefined ? first + 1 : 1);
        scrollRef.current?.scrollTo({ y: Math.max(0, boardY.current - 8), animated: true });
    }

    // ---- daily limit: unlock this analysis with an ad ----

    // The ad starts: the server begins to analyse right away, so the result
    // is ready (or nearly ready) when the ad is over.
    function handleAdStart() {
        setProgress(EMPTY_PROGRESS);

        adRequest.current = requestGameAnalysis(getSocket(), gameId, colorParam, { adUnlock: true }).catch(
            (err: AnalysisError) => {
                if (err?.message === "AD_LIMIT_REACHED") setAdsLeft(0);
                return null;
            }
        );
    }

    // The ad was watched to the end: the server releases the analysis.
    async function handleAdRewarded() {
        setStatus("analyzing");

        const socket = getSocket();

        try {
            await adRequest.current;

            try {
                await confirmAnalysisAd(socket, gameId);
            } catch {
                // The first request did not reach the server: send it again.
                await requestGameAnalysis(socket, gameId, colorParam, { adUnlock: true });
                await confirmAnalysisAd(socket, gameId);
            }
        } catch (err: any) {
            if (err?.message === "AD_LIMIT_REACHED") {
                setAdsLeft(0);
                setStatus("limit");
            } else {
                setStatus((current) => (current === "ready" ? current : "error"));
            }
        }
    }

    async function handleAskCoach(question: string) {
        const text = question.trim();
        if (!text || coachBusy || currentIndex === 0) return;

        setCoachBusy(true);
        setCoachError(null);

        try {
            const res = await askCoach(getSocket(), { gameId, moveIndex: currentIndex, question: text });
            setCoachAnswer({ ply: currentIndex - 1, text: res.answer, remaining: res.remaining });
            setCoachQuestion("");
        } catch (err: any) {
            const code = err?.message;
            setCoachError(
                code === "LIMIT_REACHED"
                    ? tr("You have used all coach questions for today.")
                    : code === "NOT_VIP"
                        ? tr("The coach is part of VIP.")
                        : tr("The coach could not answer right now. Please try again.")
            );
        } finally {
            setCoachBusy(false);
        }
    }

    // =============================
    // STATES BEFORE THE REVIEW IS READY
    // =============================

    const header = (
        <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.iconButton}>
                <Text style={styles.backText}>‹</Text>
            </Pressable>
            <Text style={styles.headerTitle}>{tr("Game Review")}</Text>
            {status === "ready" ? (
                <Pressable onPress={handleShare} style={styles.iconButton}>
                    <Text style={styles.shareText}>↗</Text>
                </Pressable>
            ) : (
                <View style={{ width: 40 }} />
            )}
        </View>
    );

    if (status === "loading") {
        return (
            <View style={styles.screen}>
                {header}
                <View style={styles.center}>
                    <ActivityIndicator color={T.accent} size="large" />
                </View>
            </View>
        );
    }

    if (status === "analyzing") {
        return (
            <View style={styles.screen}>
                {header}
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <AnalysisProgress progress={progress} boards={boards} plies={plies} boardSize={BOARD_SIZE} />
                </ScrollView>
            </View>
        );
    }

    if (status === "guest") {
        return (
            <View style={styles.screen}>
                {header}
                <View style={styles.center}>
                    <Text style={styles.emptyTitle}>{tr("Sign in to analyse your games")}</Text>
                    <Text style={styles.emptyText}>
                        {tr("See every move rated from brilliant to blunder, your accuracy, the best lines and a coach that explains what happened.")}
                    </Text>
                </View>
            </View>
        );
    }

    if (status === "limit") {
        return (
            <View style={styles.screen}>
                {header}
                <View style={styles.center}>
                    <View style={styles.vipBadge}>
                        <Text style={styles.vipBadgeText}>{tr("DAILY LIMIT")}</Text>
                    </View>
                    <Text style={styles.emptyTitle}>{tr("Today's free analysis is used up")}</Text>
                    <Text style={styles.emptyText}>
                        {tr("One game analysis a day is free. Upgrade to VIP for unlimited analyses - or watch a short ad to analyse this game.")}
                    </Text>
                    <Pressable onPress={() => setGateOpen(true)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                        <Text style={styles.primaryButtonText}>{tr("Unlock this analysis")}</Text>
                    </Pressable>
                </View>

                <LimitGate
                    visible={gateOpen}
                    kind="analysis"
                    adAllowed={adsLeft === null || adsLeft > 0}
                    onClose={() => setGateOpen(false)}
                    onAdStart={handleAdStart}
                    onRewarded={handleAdRewarded}
                />
            </View>
        );
    }

    if (status === "error" || !review || boards.length === 0) {
        return (
            <View style={styles.screen}>
                {header}
                <View style={styles.center}>
                    <Text style={styles.emptyTitle}>{tr("Analysis not available")}</Text>
                    <Text style={styles.emptyText}>{tr("The game could not be analyzed. Please try again later.")}</Text>
                </View>
            </View>
        );
    }

    // =============================
    // REVIEW
    // =============================

    const total = review.moves.length;
    const move = currentIndex > 0 ? review.moves[currentIndex - 1] : null;
    const comment = move ? describeMove(move, review, getLanguage()) : null;
    const meta = move ? CLASSIFICATION_META[move.classification] : null;

    const bestArrow = move ? parseUci(move.bestMove) : null;
    const canShowBest = !!move && !!bestArrow && !!move.bestSan && move.bestSan !== move.san;
    const showingBest = showBest && canShowBest && !sandbox;

    const board = sandbox && sandboxGame
        ? sandboxGame.board()
        : boards[showingBest ? currentIndex - 1 : currentIndex] ?? boards[0];

    const lastMove = sandbox
        ? sandbox.last
        : showingBest
            ? null
            : currentIndex > 0
                ? plies[currentIndex - 1]
                : null;

    const checkSquare = sandbox && sandboxGame
        ? findCheckedKing(sandboxGame)
        : checks[showingBest ? currentIndex - 1 : currentIndex] ?? null;

    const legalTargets = new Set<string>();
    if (sandbox && sandboxGame && selectedSquare) {
        (sandboxGame.moves({ square: selectedSquare as any, verbose: true }) as any[]).forEach((m) =>
            legalTargets.add(m.to)
        );
    }

    const players = review.players;
    const sideName = (side: Side) =>
        (side === "w" ? players?.white.name : players?.black.name) ?? (side === "w" ? tr("White") : tr("Black"));
    const sideRating = (side: Side) => (side === "w" ? players?.white.rating : players?.black.rating) ?? null;
    const isUser = (side: Side) => review.playerColor === side;

    const hasPrevKey = review.keyMoments.some((ply) => ply + 1 < currentIndex);
    const hasNextKey = review.keyMoments.some((ply) => ply + 1 > currentIndex);

    const phaseSide: Side | null = review.playerColor;
    const hasPhases = (["w", "b"] as Side[]).some((s) =>
        Object.values(review.phases[s]).some((v) => v !== null)
    );

    const coachAnswerForMove = coachAnswer && move && coachAnswer.ply === move.ply ? coachAnswer : null;

    const playerCard = (side: Side) => (
        <View style={styles.playerCard}>
            <View style={styles.playerNameRow}>
                <View style={[styles.sideDot, { backgroundColor: side === "w" ? "#F1F3F5" : "#3A404A" }]} />
                <Text style={styles.playerName} numberOfLines={1}>
                    {sideName(side)}
                </Text>
                {isUser(side) && (
                    <View style={styles.youTag}>
                        <Text style={styles.youTagText}>{tr("YOU")}</Text>
                    </View>
                )}
            </View>
            <Text style={styles.playerRating}>
                {sideRating(side) !== null
                    ? tr("{0} Elo", sideRating(side))
                    : players
                        ? side === "w" ? tr("White") : tr("Black")
                        : " "}
            </Text>

            <View style={{ marginTop: 10 }}>
                <AccuracyRing value={review.accuracy[side]} size={92} />
            </View>

            {review.estimatedRating[side] !== null && (
                <View style={styles.estimate}>
                    <Text style={styles.estimateValue}>{review.estimatedRating[side]}</Text>
                    <Text style={styles.estimateLabel}>{tr("played like")}</Text>
                </View>
            )}
        </View>
    );

    return (
        <View style={styles.screen}>
            {header}

            <ScrollView
                ref={scrollRef}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ───────────── Summary ───────────── */}
                <View ref={shareRef} collapsable={false} style={{ backgroundColor: T.bg, alignItems: "center" }}>
                    <View style={[styles.card, { width: CONTENT_WIDTH }]}>
                        <View style={styles.summaryTop}>
                            {review.opening.name ? (
                                <Text style={styles.opening} numberOfLines={1}>
                                    {review.opening.name}
                                </Text>
                            ) : (
                                <Text style={styles.opening}>{tr("Game summary")}</Text>
                            )}
                            {review.result && review.playerColor && RESULT_TEXT[review.result] ? (
                                <View
                                    style={[
                                        styles.resultTag,
                                        review.result === "win" && { backgroundColor: T.greenSoft },
                                        review.result === "loss" && { backgroundColor: T.redSoft },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.resultTagText,
                                            review.result === "win" && { color: T.green },
                                            review.result === "loss" && { color: T.red },
                                        ]}
                                    >
                                        {RESULT_TEXT[review.result]}
                                    </Text>
                                </View>
                            ) : null}
                        </View>

                        <View style={styles.playersRow}>
                            {playerCard("w")}
                            <View style={styles.playersDivider} />
                            {playerCard("b")}
                        </View>

                        <Text style={styles.summaryText}>{summarize(review, getLanguage())}</Text>

                        <Pressable onPress={startReview} style={({ pressed }) => [styles.primaryButton, { alignSelf: "stretch", marginTop: 14 }, pressed && styles.pressed]}>
                            <Text style={styles.primaryButtonText}>
                                {review.keyMoments.length > 0 ? tr("Review the key moments") : tr("Go through the game")}
                            </Text>
                        </Pressable>
                    </View>

                    {/* ───────────── Move quality ───────────── */}
                    <View style={[styles.card, { width: CONTENT_WIDTH }]}>
                        <View style={styles.qualityHeader}>
                            <Text style={[styles.qualitySide, { textAlign: "left" }]} numberOfLines={1}>
                                {sideName("w")}
                            </Text>
                            <Text style={styles.cardTitle}>{tr("Move quality")}</Text>
                            <Text style={[styles.qualitySide, { textAlign: "right" }]} numberOfLines={1}>
                                {sideName("b")}
                            </Text>
                        </View>

                        {CLASSIFICATION_ORDER.map((key) => {
                            const w = review.counts.w[key] || 0;
                            const b = review.counts.b[key] || 0;
                            const info = CLASSIFICATION_META[key];
                            const dim = w === 0 && b === 0;

                            return (
                                <View key={key} style={[styles.qualityRow, dim && { opacity: 0.38 }]}>
                                    <Text style={[styles.qualityCount, { textAlign: "left", color: w > 0 ? info.color : T.textFaint }]}>
                                        {w}
                                    </Text>
                                    <View style={styles.qualityLabelWrap}>
                                        <ClassificationBadge classification={key} size={22} />
                                        <Text style={styles.qualityLabel}>{tr(info.label)}</Text>
                                    </View>
                                    <Text style={[styles.qualityCount, { textAlign: "right", color: b > 0 ? info.color : T.textFaint }]}>
                                        {b}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* ───────────── Board ───────────── */}
                <View
                    style={{ width: CONTENT_WIDTH, marginTop: 18 }}
                    onLayout={(e) => {
                        boardY.current = e.nativeEvent.layout.y;
                    }}
                >
                    <View style={styles.boardRow}>
                        {!sandbox && (
                            <EvalBar share={whiteShare(move)} height={BOARD_SIZE} flipped={flipped} label={formatEval(move)} />
                        )}
                        <View style={styles.boardFrame} {...(!sandbox ? panResponder.panHandlers : {})}>
                            <ReviewBoard
                                board={board}
                                size={sandbox ? BOARD_SIZE + EVAL_BAR_SPACE : BOARD_SIZE}
                                flipped={flipped}
                                lastMove={lastMove}
                                classification={sandbox || showingBest ? null : move?.classification ?? null}
                                checkSquare={checkSquare}
                                arrow={showingBest ? bestArrow : null}
                                selectedSquare={sandbox ? selectedSquare : null}
                                legalTargets={legalTargets}
                                onSquarePress={sandbox ? handleSandboxPress : undefined}
                            />
                        </View>
                    </View>

                    {sandbox ? (
                        <View style={[styles.card, { marginTop: 12 }]}>
                            <Text style={styles.cardTitle}>{tr("Try your own moves")}</Text>
                            <Text style={styles.sandboxHint}>
                                {tr("Move the pieces freely from this position. Nothing here changes the review.")}
                            </Text>
                            <View style={styles.sandboxRow}>
                                <Pressable onPress={undoSandbox} style={[styles.secondaryButton, sandbox.history.length === 0 && { opacity: 0.4 }]}>
                                    <Text style={styles.secondaryButtonText}>{tr("Undo")}</Text>
                                </Pressable>
                                <Pressable onPress={enterSandbox} style={styles.secondaryButton}>
                                    <Text style={styles.secondaryButtonText}>{tr("Reset")}</Text>
                                </Pressable>
                                <Pressable onPress={() => setFlipped((f) => !f)} style={styles.secondaryButton}>
                                    <Text style={styles.secondaryButtonText}>{tr("Flip")}</Text>
                                </Pressable>
                            </View>
                            <Pressable onPress={exitSandbox} style={({ pressed }) => [styles.primaryButton, { alignSelf: "stretch", marginTop: 12 }, pressed && styles.pressed]}>
                                <Text style={styles.primaryButtonText}>{tr("Back to the review")}</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <>
                            {/* Coach */}
                            <View style={[styles.coachCard, meta && { borderColor: `${meta.color}66` }]}>
                                <Image source={coachImage} style={styles.coachAvatar} resizeMode="contain" />

                                <View style={{ flex: 1 }}>
                                    {move && comment && meta ? (
                                        <>
                                            <View style={styles.coachHeadline}>
                                                <ClassificationBadge classification={move.classification} size={22} />
                                                <Text style={[styles.coachTitle, { color: meta.color }]}>{comment.headline}</Text>
                                            </View>
                                            <Text style={styles.coachMeta}>
                                                {moveLabel(move)} · {formatEval(move)}
                                            </Text>
                                            <Text style={styles.coachText}>{comment.text}</Text>

                                            {move.bestLine.length > 1 && canShowBest && (
                                                <Text style={styles.coachLine} numberOfLines={2}>
                                                    <Text style={styles.coachLineLabel}>{tr("Best line")}  </Text>
                                                    {move.bestLine.join("  ")}
                                                </Text>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <Text style={styles.coachTitle}>{tr("Starting position")}</Text>
                                            <Text style={styles.coachText}>
                                                {tr("Step through the game with the arrows, swipe over the board or tap a point in the graph.")}
                                            </Text>
                                        </>
                                    )}
                                </View>
                            </View>

                            {move && (
                                <View style={styles.actionsRow}>
                                    {canShowBest && (
                                        <Pressable
                                            onPress={() => setShowBest((s) => !s)}
                                            style={[styles.chipButton, showBest && styles.chipButtonActive]}
                                        >
                                            <Text style={[styles.chipButtonText, showBest && styles.chipButtonTextActive]}>
                                                {showBest ? tr("Show played move") : tr("Show best: {0}", move.bestSan)}
                                            </Text>
                                        </Pressable>
                                    )}
                                    <Pressable
                                        onPress={() => setCoachOpen((o) => !o)}
                                        style={[styles.chipButton, coachOpen && styles.chipButtonActive]}
                                    >
                                        <Text style={[styles.chipButtonText, coachOpen && styles.chipButtonTextActive]}>{tr("Ask the coach")}</Text>
                                    </Pressable>
                                </View>
                            )}

                            {move && coachOpen && (
                                <View style={[styles.card, { marginTop: 10 }]}>
                                    {coachAnswerForMove ? (
                                        <>
                                            <Text style={styles.coachAnswer}>{coachAnswerForMove.text}</Text>
                                            {typeof coachAnswerForMove.remaining === "number" && (
                                                <Text style={styles.coachRemaining}>
                                                    {coachAnswerForMove.remaining} {tr("questions left today")}
                                                </Text>
                                            )}
                                        </>
                                    ) : null}

                                    {COACH_QUESTIONS.map((q) => (
                                        <Pressable key={q} onPress={() => handleAskCoach(q)} disabled={coachBusy} style={styles.questionChip}>
                                            <Text style={styles.questionChipText}>{q}</Text>
                                        </Pressable>
                                    ))}

                                    <View style={styles.coachInputRow}>
                                        <TextInput
                                            value={coachQuestion}
                                            onChangeText={setCoachQuestion}
                                            placeholder={tr("Your own question about this move…")}
                                            placeholderTextColor={T.textFaint}
                                            style={styles.coachInput}
                                            maxLength={300}
                                            editable={!coachBusy}
                                            onSubmitEditing={() => handleAskCoach(coachQuestion)}
                                        />
                                        <Pressable
                                            onPress={() => handleAskCoach(coachQuestion)}
                                            disabled={coachBusy || !coachQuestion.trim()}
                                            style={[styles.sendButton, (coachBusy || !coachQuestion.trim()) && { opacity: 0.5 }]}
                                        >
                                            {coachBusy ? (
                                                <ActivityIndicator color={T.onAccent} size="small" />
                                            ) : (
                                                <Text style={styles.sendButtonText}>{tr("Ask")}</Text>
                                            )}
                                        </Pressable>
                                    </View>

                                    {coachError && <Text style={styles.coachErrorText}>{coachError}</Text>}
                                </View>
                            )}

                            {/* Controls */}
                            <View style={styles.controls}>
                                <Pressable onPress={() => goTo(0)} style={styles.controlButton}>
                                    <Text style={styles.controlText}>⏮</Text>
                                </Pressable>
                                <Pressable onPress={() => goTo(Math.max(0, currentIndex - 1))} style={styles.controlButton}>
                                    <Text style={styles.controlTextLarge}>‹</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => {
                                        if (currentIndex >= total) setCurrentIndex(0);
                                        setIsPlaying((p) => !p);
                                    }}
                                    style={styles.playButton}
                                >
                                    <Text style={styles.playText}>{isPlaying ? "❚❚" : "▶"}</Text>
                                </Pressable>
                                <Pressable onPress={() => goTo(Math.min(total, currentIndex + 1))} style={styles.controlButton}>
                                    <Text style={styles.controlTextLarge}>›</Text>
                                </Pressable>
                                <Pressable onPress={() => goTo(total)} style={styles.controlButton}>
                                    <Text style={styles.controlText}>⏭</Text>
                                </Pressable>
                            </View>

                            <View style={styles.keyRow}>
                                <Pressable
                                    onPress={() => jumpToKeyMoment(-1)}
                                    disabled={!hasPrevKey}
                                    style={[styles.keyButton, !hasPrevKey && { opacity: 0.35 }]}
                                >
                                    <Text style={styles.keyButtonText}>{tr("‹ Previous key moment")}</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => jumpToKeyMoment(1)}
                                    disabled={!hasNextKey}
                                    style={[styles.keyButton, styles.keyButtonPrimary, !hasNextKey && { opacity: 0.35 }]}
                                >
                                    <Text style={[styles.keyButtonText, { color: T.text }]}>{tr("Next key moment ›")}</Text>
                                </Pressable>
                            </View>

                            <View style={styles.toolsRow}>
                                <Pressable onPress={() => setFlipped((f) => !f)}>
                                    <Text style={styles.toolText}>{tr("Flip board")}</Text>
                                </Pressable>
                                <Text style={styles.toolIndex}>
                                    {tr("Move")} {currentIndex} / {total}
                                </Text>
                                <Pressable onPress={enterSandbox}>
                                    <Text style={styles.toolText}>{tr("Try moves")}</Text>
                                </Pressable>
                            </View>
                        </>
                    )}
                </View>

                {!sandbox && (
                    <>
                        {/* ───────────── Graph ───────────── */}
                        <View style={[styles.card, { width: CONTENT_WIDTH }]}>
                            <Text style={[styles.cardTitle, { marginBottom: 10 }]}>{tr("Evaluation")}</Text>
                            <EvalGraph moves={review.moves} currentIndex={currentIndex} onSelect={goTo} width={CONTENT_WIDTH - 34} />
                            <View style={styles.legendRow}>
                                {(["brilliant", "great", "mistake", "miss", "blunder"] as const).map((key) => (
                                    <View key={key} style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: CLASSIFICATION_META[key].color }]} />
                                        <Text style={styles.legendText}>{tr(CLASSIFICATION_META[key].label)}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* ───────────── Phases ───────────── */}
                        {hasPhases && (
                            <View style={[styles.card, { width: CONTENT_WIDTH }]}>
                                <Text style={[styles.cardTitle, { marginBottom: 12 }]}>
                                    {phaseSide ? tr("Your accuracy by phase") : tr("Accuracy by phase")}
                                </Text>
                                <View style={styles.phaseRow}>
                                    {(["opening", "middlegame", "endgame"] as const).map((phase) => {
                                        const sides: Side[] = phaseSide ? [phaseSide] : ["w", "b"];

                                        return (
                                            <View key={phase} style={styles.phaseCell}>
                                                <Text style={styles.phaseName}>
                                                    {phase === "opening" ? tr("Opening") : phase === "middlegame" ? tr("Middlegame") : tr("Endgame")}
                                                </Text>
                                                {sides.map((s) => {
                                                    const value = review.phases[s][phase];
                                                    return (
                                                        <View key={s} style={styles.phaseValueRow}>
                                                            {!phaseSide && (
                                                                <View style={[styles.sideDot, { backgroundColor: s === "w" ? "#F1F3F5" : "#3A404A" }]} />
                                                            )}
                                                            <Text style={[styles.phaseValue, { color: accuracyColor(value) }]}>
                                                                {value === null ? "–" : value.toFixed(0)}
                                                            </Text>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* ───────────── Moves ───────────── */}
                        <View style={[styles.card, { width: CONTENT_WIDTH }]}>
                            <Text style={[styles.cardTitle, { marginBottom: 8 }]}>{tr("Moves")}</Text>
                            <MoveTable moves={review.moves} currentIndex={currentIndex} onSelect={goTo} />
                        </View>

                        {/* ───────────── Trend ───────────── */}
                        {trend.length > 1 && (
                            <View style={[styles.card, { width: CONTENT_WIDTH }]}>
                                <Text style={styles.cardTitle}>{tr("Your trend")}</Text>
                                <Text style={styles.trendSubtitle}>{tr("Accuracy in your last")} {trend.length} {tr("analyzed games")}</Text>
                                <View style={styles.trendBars}>
                                    {trend.map((point) => (
                                        <View key={point.id} style={styles.trendBarWrap}>
                                            <Text style={styles.trendValue}>{Math.round(point.accuracy)}</Text>
                                            <View
                                                style={[
                                                    styles.trendBar,
                                                    {
                                                        height: `${Math.max(6, point.accuracy - 30) * (100 / 70)}%`,
                                                        backgroundColor: point.id === gameId ? T.accent : "rgba(91,141,184,0.4)",
                                                    },
                                                ]}
                                            />
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        <Text style={styles.footnote}>
                            {review.tier && review.tier !== "none"
                                ? tr("{0}{1} analysis", review.tier.charAt(0).toUpperCase(), review.tier.slice(1))
                                : tr("Analysis")}
                            {review.depth ? tr(" · average depth {0}", review.depth) : ""}
                            {" · "}{tr("“Played like” is an estimate from this single game.")}
                        </Text>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: T.bg, paddingTop: 50 },
    scrollContent: { alignItems: "center", paddingBottom: 48 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 34, gap: 10 },
    pressed: { opacity: 0.85 },

    header: { paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    iconButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: T.cardSolid, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
    backText: { color: T.text, fontSize: 26, lineHeight: 28, fontWeight: "300" },
    shareText: { color: T.accent, fontSize: 18, fontWeight: "700" },
    headerTitle: { color: T.text, fontSize: 16, fontWeight: "700", letterSpacing: 0.2 },

    emptyTitle: { color: T.text, fontSize: 19, fontWeight: "700", textAlign: "center" },
    emptyText: { color: T.textDim, fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 300 },
    vipBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 8, backgroundColor: T.goldSoft, borderWidth: 1, borderColor: T.goldBorder, marginBottom: 4 },
    vipBadgeText: { color: T.gold, fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },

    primaryButton: { backgroundColor: T.accent, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 13, alignItems: "center", marginTop: 8 },
    primaryButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14.5 },
    secondaryButton: { flex: 1, paddingVertical: 11, borderRadius: 11, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: "center" },
    secondaryButtonText: { color: T.text, fontWeight: "700", fontSize: 13.5 },

    card: { backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 16, marginTop: 14 },
    cardTitle: { color: T.text, fontSize: 15, fontWeight: "700" },

    summaryTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 },
    opening: { color: T.textDim, fontSize: 13, fontWeight: "600", flex: 1 },
    resultTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: "rgba(237,240,243,0.08)" },
    resultTagText: { color: T.textDim, fontSize: 12, fontWeight: "800" },
    playersRow: { flexDirection: "row", alignItems: "stretch" },
    playersDivider: { width: 1, backgroundColor: T.border, marginHorizontal: 8 },
    playerCard: { flex: 1, alignItems: "center" },
    playerNameRow: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" },
    sideDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: "rgba(237,240,243,0.35)" },
    playerName: { color: T.text, fontSize: 15, fontWeight: "700", flexShrink: 1 },
    youTag: { paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 5, backgroundColor: T.accentSoft },
    youTagText: { color: T.accent, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
    playerRating: { color: T.textFaint, fontSize: 12, marginTop: 2 },
    estimate: { alignItems: "center", marginTop: 10 },
    estimateValue: { color: T.text, fontSize: 17, fontWeight: "800", fontVariant: ["tabular-nums"] },
    estimateLabel: { color: T.textFaint, fontSize: 10.5, fontWeight: "600", marginTop: 1 },
    summaryText: { color: T.textDim, fontSize: 13.5, lineHeight: 19, textAlign: "center", marginTop: 16 },

    qualityHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
    qualitySide: { flex: 1, color: T.textFaint, fontSize: 11.5, fontWeight: "700" },
    qualityRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6.5, borderTopWidth: 1, borderTopColor: T.border },
    qualityCount: { width: 44, fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] },
    qualityLabelWrap: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
    qualityLabel: { color: T.text, fontSize: 14, fontWeight: "600", width: 104 },

    boardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    boardFrame: { borderRadius: 8, overflow: "hidden" },

    coachCard: { flexDirection: "row", gap: 12, marginTop: 12, padding: 14, borderRadius: 18, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, minHeight: 104 },
    coachAvatar: { width: 56, height: 56 },
    coachHeadline: { flexDirection: "row", alignItems: "center", gap: 8 },
    coachTitle: { color: T.text, fontSize: 16, fontWeight: "800", flexShrink: 1 },
    coachMeta: { color: T.textFaint, fontSize: 12, fontWeight: "600", marginTop: 3, fontVariant: ["tabular-nums"] },
    coachText: { color: T.textDim, fontSize: 13.5, lineHeight: 19.5, marginTop: 6 },
    coachLine: { color: T.text, fontSize: 12.5, lineHeight: 18, marginTop: 8, fontWeight: "600" },
    coachLineLabel: { color: T.textFaint, fontWeight: "700" },

    actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
    chipButton: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: T.accentBorder, backgroundColor: T.accentSoft },
    chipButtonActive: { backgroundColor: T.accent, borderColor: T.accent },
    chipButtonText: { color: "#9CC3E6", fontSize: 13, fontWeight: "700" },
    chipButtonTextActive: { color: "#FFFFFF" },

    coachAnswer: { color: T.text, fontSize: 14, lineHeight: 20.5, marginBottom: 6 },
    coachRemaining: { color: T.textFaint, fontSize: 11.5, marginBottom: 10 },
    questionChip: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 11, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, marginTop: 6 },
    questionChipText: { color: T.text, fontSize: 13.5, fontWeight: "600" },
    coachInputRow: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" },
    coachInput: { flex: 1, backgroundColor: T.raised, borderRadius: 11, borderWidth: 1, borderColor: T.border, paddingHorizontal: 12, paddingVertical: 10, color: T.text, fontSize: 13.5 },
    sendButton: { backgroundColor: T.accent, borderRadius: 11, paddingHorizontal: 16, height: 40, alignItems: "center", justifyContent: "center" },
    sendButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13.5 },
    coachErrorText: { color: "#F0A19E", fontSize: 12.5, marginTop: 8 },

    controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 14 },
    controlButton: { width: 52, height: 46, borderRadius: 13, backgroundColor: T.cardSolid, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" },
    controlText: { color: T.text, fontSize: 15 },
    controlTextLarge: { color: T.text, fontSize: 26, lineHeight: 28, fontWeight: "300" },
    playButton: { width: 56, height: 50, borderRadius: 15, backgroundColor: T.accent, alignItems: "center", justifyContent: "center" },
    playText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },

    keyRow: { flexDirection: "row", gap: 8, marginTop: 10 },
    keyButton: { flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: T.cardSolid, borderWidth: 1, borderColor: T.border, alignItems: "center" },
    keyButtonPrimary: { backgroundColor: T.accentSoft, borderColor: T.accentBorder },
    keyButtonText: { color: T.textDim, fontSize: 12.5, fontWeight: "700" },

    toolsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingHorizontal: 4 },
    toolText: { color: "#9CC3E6", fontSize: 12.5, fontWeight: "700" },
    toolIndex: { color: T.textFaint, fontSize: 12, fontVariant: ["tabular-nums"] },

    sandboxHint: { color: T.textDim, fontSize: 13, lineHeight: 18.5, marginTop: 5, marginBottom: 12 },
    sandboxRow: { flexDirection: "row", gap: 8 },

    legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { color: T.textFaint, fontSize: 11, fontWeight: "600" },

    phaseRow: { flexDirection: "row", gap: 8 },
    phaseCell: { flex: 1, backgroundColor: T.raised, borderRadius: 12, paddingVertical: 11, alignItems: "center", borderWidth: 1, borderColor: T.border },
    phaseName: { color: T.textFaint, fontSize: 11, fontWeight: "700", marginBottom: 5 },
    phaseValueRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    phaseValue: { fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },

    trendSubtitle: { color: T.textFaint, fontSize: 12, marginTop: 3, marginBottom: 12 },
    trendBars: { flexDirection: "row", alignItems: "flex-end", height: 84, gap: 7 },
    trendBarWrap: { flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center" },
    trendValue: { color: T.textFaint, fontSize: 10, fontWeight: "700", marginBottom: 3 },
    trendBar: { width: "100%", borderRadius: 5, minHeight: 5 },

    footnote: { color: T.textFaint, fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 18, width: CONTENT_WIDTH, paddingHorizontal: 10 },
});
