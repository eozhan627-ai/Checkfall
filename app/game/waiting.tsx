import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { claimGameStart } from "../../lib/challenges";
import { ensureSocketConnected, getSocket } from "../../lib/socket";
import WaitingChessBoard from "../../components/WaitingChessBoard";
import { log } from "../../lib/log";
import { describeTimeControl, getTimeControl } from "../../lib/timeControls";
import { tr } from "../../lib/i18n";

export default function WaitingScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // Seconds spent searching - the server widens the rating range over time.
    const [elapsed, setElapsed] = useState(0);
    const gameStarted = useRef(false);

    useEffect(() => {
        const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    // ================================
    // MATCHMAKING
    // ================================
    useEffect(() => {
        const socket = getSocket();
        const releaseGameStart = claimGameStart();

        const handleGameStart = (data: any) => {
            log(
                "🎮 MATCHMAKING: GAME START",
                data
            );

            gameStarted.current = true;

            router.replace({
                pathname: "/game/online-game",
                params: data,
            });
        };

        const handleWaiting = (data: any) => {
            log(
                "⏳ MATCHMAKING: WAITING",
                data?.timeControl ?? ""
            );
        };

        const handleError = (data: any) => {
            log(
                "❌ MATCHMAKING ERROR:",
                data
            );
        };

        const startMatchmaking = () => {
            const rating = Number(params.rating);

            log(
                "================================="
            );
            log(
                "🔎 MATCHMAKING START"
            );
            log(
                "SOCKET ID:",
                socket.id
            );
            log(
                "SOCKET CONNECTED:",
                socket.connected
            );
            log(
                "NAME:",
                params.name
            );
            log(
                "AVATAR:",
                params.avatar
            );
            log(
                "RATING:",
                rating
            );
            log(
                "TIME CONTROL:",
                getTimeControl(String(params.timeControl ?? "")).id
            );
            log(
                "================================="
            );

            if (!Number.isFinite(rating)) {
                log(
                    "❌ INVALID RATING:",
                    params.rating
                );

                return;
            }

            socket.emit("find_match", {
                name: params.name,
                avatar: params.avatar,
                rating,
                timeControl: getTimeControl(String(params.timeControl ?? "")).id,
            });

            log(
                "📤 FIND_MATCH SENT"
            );
        };

        // ================================
        // LISTENERS
        // ================================

        socket.on(
            "game_start",
            handleGameStart
        );

        socket.on(
            "waiting",
            handleWaiting
        );

        socket.on(
            "matchmaking_error",
            handleError
        );

        // ================================
        // SOCKET CONNECTION
        // ================================

        if (socket.connected) {
            log(
                "🟢 SOCKET ALREADY CONNECTED"
            );

            startMatchmaking();
        } else {
            log(
                "🔌 SOCKET NOT CONNECTED → CONNECTING..."
            );

            socket.once(
                "connect",
                startMatchmaking
            );

            ensureSocketConnected();
        }

        // ================================
        // CLEANUP
        // ================================

        return () => {
            releaseGameStart();

            socket.off(
                "game_start",
                handleGameStart
            );

            socket.off(
                "waiting",
                handleWaiting
            );

            socket.off(
                "matchmaking_error",
                handleError
            );

            socket.off(
                "connect",
                startMatchmaking
            );

            // Leaving this screen in any way (Cancel, the Android back
            // button, a swipe) ends the search. Otherwise the server could
            // still pair this player while nobody is looking.
            if (!gameStarted.current) {
                socket.emit("cancel_matchmaking");
            }
        };
    }, []);

    // Cancel search and navigate back. The effect above tells the server
    // ("cancel_matchmaking") when this screen closes.
    const handleCancel = () => {
        router.back();
    };

    const statusText =
        elapsed >= 10 ? tr("Widening the rating range...") : tr("Searching for an opponent...");

    return (
        <SafeAreaView style={styles.container}>

            <View style={styles.content}>

                {/* BRAND */}
                <Text style={styles.brand}>
                    {tr("POVCheck")}
                </Text>

                {/* TITLE */}
                <Text style={styles.title}>
                    {tr("Finding an opponent")}
                </Text>

                {/* SUBTITLE */}
                <Text style={styles.subtitle}>
                    {tr("We're finding a suitable opponent for you.")}
                </Text>

                {/* TIME CONTROL */}
                <View style={styles.timePill}>
                    <Text style={styles.timePillText}>
                        {getTimeControl(String(params.timeControl ?? "")).category} · {describeTimeControl(String(params.timeControl ?? ""))} {tr("· Rated")}
                    </Text>
                </View>

                {/* CHESS BOARD */}
                <WaitingChessBoard />

                {/* STATUS */}
                <View style={styles.statusBox}>

                    <View style={styles.statusDot} />

                    <Text style={styles.statusText}>
                        {statusText}
                    </Text>

                </View>

                {/* CANCEL */}
                <Pressable
                    onPress={handleCancel}
                    style={({ pressed }) => [
                        styles.cancelButton,
                        pressed && styles.cancelButtonPressed,
                    ]}
                >
                    <Text style={styles.cancelButtonText}>
                        {tr("Cancel")}
                    </Text>
                </Pressable>

                {/* INFO */}
                <Text style={styles.info}>
                    {tr("The match will start automatically once an opponent has been found.")}
                </Text>

            </View>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    timePill: {
        alignSelf: "center",
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: "rgba(91,141,184,0.16)",
        borderWidth: 1,
        borderColor: "rgba(91,141,184,0.45)",
        marginTop: 14,
        marginBottom: 18,
    },
    timePillText: { color: "#CFE0EF", fontSize: 13, fontWeight: "700" },
    container: {
        flex: 1,
        backgroundColor: "#0f172a",
    },

    content: {
        flex: 1,

        alignItems: "center",
        justifyContent: "center",

        paddingHorizontal: 20,
    },

    brand: {
        fontSize: 15,
        fontWeight: "800",

        letterSpacing: 4,

        color: "#d4af37",

        marginBottom: 12,
    },

    title: {
        fontSize: 26,
        fontWeight: "800",

        color: "#ffffff",

        textAlign: "center",
    },

    subtitle: {
        marginTop: 8,

        fontSize: 14,

        color: "#94a3b8",

        textAlign: "center",
    },

    statusBox: {
        flexDirection: "row",

        alignItems: "center",

        marginTop: 22,

        paddingHorizontal: 18,
        paddingVertical: 11,

        borderRadius: 12,

        backgroundColor: "#1e293b",

        borderWidth: 1,
        borderColor: "#334155",
    },

    statusDot: {
        width: 8,
        height: 8,

        borderRadius: 4,

        backgroundColor: "#22c55e",

        marginRight: 9,
    },

    statusText: {
        color: "#e5e7eb",

        fontSize: 14,

        fontWeight: "600",
    },

    cancelButton: {
        marginTop: 22,
        paddingHorizontal: 26,
        paddingVertical: 13,
        borderRadius: 12,
        backgroundColor: "#1e293b",
        borderWidth: 1,
        borderColor: "#c62828",
    },

    cancelButtonPressed: {
        opacity: 0.75,
    },

    cancelButtonText: {
        color: "#ff6b6b",
        fontSize: 15,
        fontWeight: "700",
    },

    info: {
        marginTop: 18,

        color: "#64748b",

        fontSize: 12,

        textAlign: "center",

        lineHeight: 18,

        maxWidth: 280,
    },
});