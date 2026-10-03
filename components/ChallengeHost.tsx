import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import {
    cancelChallenge,
    ChallengeColor,
    challengeErrorText,
    ChallengePlayer,
    ChallengeSettings,
    isGameStartClaimed,
    onChallengeRequested,
    respondChallenge,
    sendChallenge,
} from "../lib/challenges";
import { getSocket } from "../lib/socket";
import { DEFAULT_TIME_CONTROL, describeTimeControl, loadTimeControl, saveTimeControl } from "../lib/timeControls";
import Segmented from "./play/Segmented";
import Sheet from "./play/Sheet";
import TimeControlPicker from "./play/TimeControlPicker";
import Avatar from "./ui/Avatar";
import { T } from "./ui/theme";
import { tr } from "../lib/i18n";

type Incoming = {
    challengeId: string;
    from: ChallengePlayer;
    expiresAt: number;
    timeControl: string;
    rated: boolean;
    /** The colour the challenged player gets. */
    color: ChallengeColor;
};
type Outgoing = { challengeId: string | null; target: ChallengePlayer; expiresAt: number; settings: ChallengeSettings };

const COLOR_TEXT: Record<ChallengeColor, string> = {
    get w() { return tr("You play White"); },
    get b() { return tr("You play Black"); },
    get random() { return tr("Random colours"); },
};
type Toast = { id: number; title: string; text: string; route?: "/friends" | "/clans" };

// Mounted once for the whole app (see app/_layout.tsx). Shows
//   - an incoming challenge with Accept / Decline
//   - "waiting for ..." after the user challenged someone
//   - short notices: friend request, clan invitation, declined challenge
// and opens the board when a challenge turns into a game.
export default function ChallengeHost() {
    const [incoming, setIncoming] = useState<Incoming | null>(null);
    const [outgoing, setOutgoing] = useState<Outgoing | null>(null);
    const [toast, setToast] = useState<Toast | null>(null);

    // Settings sheet that opens before a challenge is sent.
    const [setupTarget, setSetupTarget] = useState<ChallengePlayer | null>(null);
    const [timeControl, setTimeControl] = useState(DEFAULT_TIME_CONTROL);
    const [color, setColor] = useState<ChallengeColor>("random");
    const [rated, setRated] = useState(false);
    const [now, setNow] = useState(Date.now());

    const outgoingRef = useRef<Outgoing | null>(null);
    outgoingRef.current = outgoing;

    const toastAnim = useRef(new Animated.Value(0)).current;
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = useCallback(
        (title: string, text: string, route?: Toast["route"]) => {
            if (toastTimer.current) clearTimeout(toastTimer.current);

            setToast({ id: Date.now(), title, text, route });
            toastAnim.setValue(0);
            Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();

            toastTimer.current = setTimeout(() => {
                Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
                    setToast(null)
                );
            }, 4200);
        },
        [toastAnim]
    );

    // Countdown for the open challenge.
    useEffect(() => {
        if (!incoming && !outgoing) return;

        const id = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(id);
    }, [incoming, outgoing]);

    // Screens ask for a challenge via startChallenge().
    useEffect(() => {
        return onChallengeRequested((target) => {
            if (outgoingRef.current) return;

            // Start with the time control the player used last.
            loadTimeControl().then(setTimeControl);
            setSetupTarget(target);
        });
    }, []);

    async function sendSetup() {
        const target = setupTarget;
        if (!target || outgoingRef.current) return;

        const settings: ChallengeSettings = { timeControl, color: rated ? "random" : color, rated };

        setSetupTarget(null);
        saveTimeControl(timeControl);

        const socket = getSocket();
        setNow(Date.now());
        setOutgoing({ challengeId: null, target, expiresAt: Date.now() + 30000, settings });

        try {
            const res = await sendChallenge(socket, target.id, settings);
            setOutgoing((current) =>
                current && current.target.id === target.id
                    ? { ...current, challengeId: res.challengeId, expiresAt: Date.now() + res.expiresInMs }
                    : current
            );
        } catch (error: any) {
            setOutgoing(null);
            showToast(tr("Challenge not sent"), challengeErrorText(error?.message));
        }
    }

    useEffect(() => {
        const socket = getSocket();

        const onReceived = (data: any) => {
            if (!data?.challengeId || !data?.from) return;
            setNow(Date.now());
            setIncoming({
                challengeId: data.challengeId,
                from: data.from,
                expiresAt: Date.now() + (Number(data.expiresInMs) || 30000),
                timeControl: typeof data.timeControl === "string" ? data.timeControl : DEFAULT_TIME_CONTROL,
                rated: data.rated === true,
                color: data.color === "w" || data.color === "b" ? data.color : "random",
            });
        };

        const closeIfMatches = (data: any) => {
            setIncoming((current) => (current && current.challengeId === data?.challengeId ? null : current));
            setOutgoing((current) => (current && current.challengeId === data?.challengeId ? null : current));
        };

        const onDeclined = (data: any) => {
            closeIfMatches(data);
            showToast(tr("Challenge declined"), tr("{0} does not want to play right now.", data?.by?.username || "Your opponent"));
        };

        const onExpired = (data: any) => {
            const wasMine = outgoingRef.current?.challengeId === data?.challengeId;
            closeIfMatches(data);
            if (wasMine) showToast(tr("No answer"), tr("Your challenge was not answered in time."));
        };

        // A challenge was accepted: both players get a normal game start.
        const onGameStart = (data: any) => {
            if (!data?.challenge) return;

            setIncoming(null);
            setOutgoing(null);

            // The matchmaking screen and the online board open / reset the
            // board themselves.
            if (isGameStartClaimed()) return;

            router.push({ pathname: "/game/online-game", params: data } as any);
        };

        const onFriendRequest = (data: any) => {
            showToast(tr("Friend request"), tr("{0} wants to be your friend.", data?.from?.username || "Someone"), "/friends");
        };

        const onFriendAccepted = (data: any) => {
            showToast(tr("New friend"), tr("{0} accepted your friend request.", data?.by?.username || "Someone"), "/friends");
        };

        const onClanInvite = (data: any) => {
            showToast(tr("Clan invitation"), tr("You were invited to {0}.", data?.clanName || "a clan"), "/clans");
        };

        const onJoinAnswered = (data: any) => {
            showToast(
                data?.accepted ? tr("Welcome to the clan") : tr("Request declined"),
                data?.accepted
                    ? tr("{0} accepted your request.", data?.clanName || "The clan")
                    : tr("{0} declined your request.", data?.clanName || "The clan"),
                "/clans"
            );
        };

        socket.on("challenge_received", onReceived);
        socket.on("challenge_declined", onDeclined);
        socket.on("challenge_expired", onExpired);
        socket.on("challenge_cancelled", closeIfMatches);
        socket.on("game_start", onGameStart);
        socket.on("friend_request_received", onFriendRequest);
        socket.on("friend_request_accepted", onFriendAccepted);
        socket.on("clan_invite_received", onClanInvite);
        socket.on("clan_join_request_answered", onJoinAnswered);

        return () => {
            socket.off("challenge_received", onReceived);
            socket.off("challenge_declined", onDeclined);
            socket.off("challenge_expired", onExpired);
            socket.off("challenge_cancelled", closeIfMatches);
            socket.off("game_start", onGameStart);
            socket.off("friend_request_received", onFriendRequest);
            socket.off("friend_request_accepted", onFriendAccepted);
            socket.off("clan_invite_received", onClanInvite);
            socket.off("clan_join_request_answered", onJoinAnswered);
        };
    }, [showToast]);

    async function answer(accept: boolean) {
        if (!incoming) return;

        const { challengeId } = incoming;
        setIncoming(null);

        try {
            await respondChallenge(getSocket(), challengeId, accept);
        } catch (error: any) {
            if (accept) showToast(tr("Game not started"), challengeErrorText(error?.message));
        }
    }

    function cancelOutgoing() {
        if (outgoing?.challengeId) cancelChallenge(getSocket(), outgoing.challengeId);
        setOutgoing(null);
    }

    const secondsLeft = (expiresAt: number) => Math.max(0, Math.ceil((expiresAt - now) / 1000));

    if (!incoming && !outgoing && !toast && !setupTarget) return null;

    return (
        <View style={styles.host} pointerEvents="box-none">
            {toast && !incoming && (
                <Animated.View
                    style={[
                        styles.toast,
                        {
                            opacity: toastAnim,
                            transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
                        },
                    ]}
                >
                    <Pressable
                        onPress={() => {
                            const route = toast.route;
                            setToast(null);
                            if (route) router.push(route);
                        }}
                        style={styles.toastInner}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={styles.toastTitle}>{toast.title}</Text>
                            <Text style={styles.toastText}>{toast.text}</Text>
                        </View>
                        {toast.route && <Text style={styles.toastChevron}>›</Text>}
                    </Pressable>
                </Animated.View>
            )}

            {outgoing && !incoming && (
                <View style={styles.banner}>
                    <Avatar name={outgoing.target.username} uri={outgoing.target.avatar} size={38} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.bannerTitle} numberOfLines={1}>
                            {tr("Waiting for")} {outgoing.target.username}
                        </Text>
                        <Text style={styles.bannerText}>
                            {describeTimeControl(outgoing.settings.timeControl)} · {outgoing.settings.rated ? tr("Rated") : tr("Unrated")} ·{" "}
                            {secondsLeft(outgoing.expiresAt)} s
                        </Text>
                    </View>
                    <Pressable onPress={cancelOutgoing} style={styles.bannerButton} hitSlop={8}>
                        <Text style={styles.bannerButtonText}>{tr("Cancel")}</Text>
                    </Pressable>
                </View>
            )}

            {incoming && (
                <View style={styles.backdrop}>
                    <View style={styles.card}>
                        <Text style={styles.eyebrow}>{tr("CHALLENGE")}</Text>
                        <Avatar name={incoming.from.username} uri={incoming.from.avatar} size={72} />
                        <Text style={styles.name}>{incoming.from.username}</Text>
                        {incoming.from.rating != null && <Text style={styles.rating}>{incoming.from.rating} {tr("Elo")}</Text>}
                        <Text style={styles.text}>{tr("wants to play against you.")}</Text>

                        <View style={styles.terms}>
                            <View style={styles.term}>
                                <Text style={styles.termLabel}>{tr("TIME")}</Text>
                                <Text style={styles.termValue}>{describeTimeControl(incoming.timeControl)}</Text>
                            </View>
                            <View style={styles.termDivider} />
                            <View style={styles.term}>
                                <Text style={styles.termLabel}>{tr("GAME")}</Text>
                                <Text style={[styles.termValue, incoming.rated && { color: T.gold }]}>
                                    {incoming.rated ? tr("Rated") : tr("Unrated")}
                                </Text>
                            </View>
                            <View style={styles.termDivider} />
                            <View style={styles.term}>
                                <Text style={styles.termLabel}>{tr("COLOUR")}</Text>
                                <Text style={styles.termValue}>
                                    {incoming.color === "w" ? tr("White") : incoming.color === "b" ? tr("Black") : tr("Random")}
                                </Text>
                            </View>
                        </View>

                        <Text style={styles.note}>
                            {incoming.rated
                                ? tr("This game changes your rating.")
                                : tr("This game does not change your rating.")}
                        </Text>

                        <View style={styles.actions}>
                            <Pressable onPress={() => answer(false)} style={({ pressed }) => [styles.decline, pressed && styles.pressed]}>
                                <Text style={styles.declineText}>{tr("Decline")}</Text>
                            </Pressable>
                            <Pressable onPress={() => answer(true)} style={({ pressed }) => [styles.accept, pressed && styles.pressed]}>
                                <Text style={styles.acceptText}>{tr("Accept ·")} {secondsLeft(incoming.expiresAt)}</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            )}

            <Sheet
                visible={!!setupTarget}
                title={setupTarget ? tr("Challenge {0}", setupTarget.username) : ""}
                subtitle={tr("Choose how you want to play.")}
                onClose={() => setSetupTarget(null)}
                footer={
                    <Pressable onPress={sendSetup} style={({ pressed }) => [styles.send, pressed && styles.pressed]}>
                        <Text style={styles.sendText}>{tr("Send challenge")}</Text>
                        <Text style={styles.sendSub}>
                            {describeTimeControl(timeControl)} · {rated ? tr("Rated") : tr("Unrated")} ·{" "}
                            {COLOR_TEXT[rated ? "random" : color]}
                        </Text>
                    </Pressable>
                }
            >
                <Text style={styles.setupLabel}>{tr("Game")}</Text>
                <Segmented
                    value={rated ? "rated" : "unrated"}
                    onChange={(value) => setRated(value === "rated")}
                    options={[
                        { value: "unrated", label: tr("Unrated"), hint: tr("Just for fun") },
                        { value: "rated", label: tr("Rated"), hint: tr("Counts for Elo") },
                    ]}
                />

                <Text style={styles.setupLabel}>{tr("Your colour")}</Text>
                <Segmented
                    value={rated ? "random" : color}
                    onChange={setColor}
                    options={[
                        { value: "w", label: tr("White"), disabled: rated },
                        { value: "random", label: tr("Random") },
                        { value: "b", label: tr("Black"), disabled: rated },
                    ]}
                />
                {rated && <Text style={styles.setupHint}>{tr("In rated games the colours are always drawn.")}</Text>}

                <Text style={styles.setupLabel}>{tr("Time")}</Text>
                <TimeControlPicker value={timeControl} onChange={setTimeControl} />
            </Sheet>
        </View>
    );
}

const styles = StyleSheet.create({
    setupLabel: { color: T.text, fontSize: 14, fontWeight: "700", marginTop: 16, marginBottom: 10 },
    setupHint: { color: T.textFaint, fontSize: 12.5, marginTop: 8 },
    send: { backgroundColor: T.accent, borderRadius: 16, paddingVertical: 13, alignItems: "center" },
    sendText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
    sendSub: { color: "rgba(255,255,255,0.78)", fontSize: 12, marginTop: 2 },

    terms: {
        flexDirection: "row",
        alignSelf: "stretch",
        marginTop: 16,
        borderRadius: 14,
        backgroundColor: "rgba(237,240,243,0.05)",
        borderWidth: 1,
        borderColor: T.border,
        paddingVertical: 12,
    },
    term: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
    termLabel: { color: T.textFaint, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
    termValue: { color: T.text, fontSize: 13.5, fontWeight: "700", marginTop: 4, textAlign: "center" },
    termDivider: { width: 1, backgroundColor: T.border },
    note: { color: T.textFaint, fontSize: 12.5, marginTop: 10, textAlign: "center" },

    host: { ...StyleSheet.absoluteFillObject, zIndex: 9000, elevation: 9000 },
    pressed: { opacity: 0.85 },

    toast: { position: "absolute", top: 52, left: 14, right: 14 },
    toastInner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: "#1B2027",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: T.accentBorder,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    toastTitle: { color: T.text, fontSize: 14, fontWeight: "800" },
    toastText: { color: T.textDim, fontSize: 13, marginTop: 2, lineHeight: 18 },
    toastChevron: { color: T.accent, fontSize: 24, fontWeight: "300" },

    banner: {
        position: "absolute",
        left: 14,
        right: 14,
        bottom: 96,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: "#1B2027",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: T.accentBorder,
        padding: 12,
    },
    bannerTitle: { color: T.text, fontSize: 14.5, fontWeight: "800" },
    bannerText: { color: T.textDim, fontSize: 12.5, marginTop: 2, fontVariant: ["tabular-nums"] },
    bannerButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11, backgroundColor: "rgba(237,240,243,0.08)" },
    bannerButtonText: { color: T.text, fontSize: 13, fontWeight: "700" },

    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(4,6,9,0.78)",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    card: {
        width: "100%",
        maxWidth: 360,
        backgroundColor: T.cardSolid,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: T.borderStrong,
        padding: 24,
        alignItems: "center",
    },
    eyebrow: { color: T.accent, fontSize: 11, fontWeight: "800", letterSpacing: 1.4, marginBottom: 16 },
    name: { color: T.text, fontSize: 22, fontWeight: "800", marginTop: 12 },
    rating: { color: T.textDim, fontSize: 13.5, marginTop: 2, fontVariant: ["tabular-nums"] },
    text: { color: T.textDim, fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 12 },
    actions: { flexDirection: "row", gap: 10, marginTop: 22, alignSelf: "stretch" },
    decline: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "rgba(237,240,243,0.07)", alignItems: "center" },
    declineText: { color: T.text, fontSize: 15, fontWeight: "700" },
    accept: { flex: 1.4, paddingVertical: 14, borderRadius: 14, backgroundColor: T.accent, alignItems: "center" },
    acceptText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] },
});
