import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import {
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getSocket } from "../../lib/socket";
import WaitingChessBoard from "../components/WaitingChessBoard";

export default function WaitingScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // ================================
    // MATCHMAKING
    // ================================
    useEffect(() => {
        const socket = getSocket();

        const handleGameStart = (data: any) => {
            console.log(
                "🎮 MATCHMAKING: GAME START",
                data
            );

            router.replace({
                pathname: "/game/online-game",
                params: data,
            });
        };

        const handleWaiting = () => {
            console.log(
                "⏳ MATCHMAKING: WAITING"
            );
        };

        const handleError = (data: any) => {
            console.log(
                "❌ MATCHMAKING ERROR:",
                data
            );
        };

        const startMatchmaking = () => {
            const rating = Number(params.rating);

            console.log(
                "================================="
            );
            console.log(
                "🔎 MATCHMAKING START"
            );
            console.log(
                "SOCKET ID:",
                socket.id
            );
            console.log(
                "SOCKET CONNECTED:",
                socket.connected
            );
            console.log(
                "NAME:",
                params.name
            );
            console.log(
                "AVATAR:",
                params.avatar
            );
            console.log(
                "RATING:",
                rating
            );
            console.log(
                "================================="
            );

            if (!Number.isFinite(rating)) {
                console.log(
                    "❌ INVALID RATING:",
                    params.rating
                );

                return;
            }

            socket.emit("find_match", {
                name: params.name,
                avatar: params.avatar,
                rating,
            });

            console.log(
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
            console.log(
                "🟢 SOCKET ALREADY CONNECTED"
            );

            startMatchmaking();
        } else {
            console.log(
                "🔌 SOCKET NOT CONNECTED → CONNECTING..."
            );

            socket.once(
                "connect",
                startMatchmaking
            );

            socket.connect();
        }

        // ================================
        // CLEANUP
        // ================================

        return () => {
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
        };
    }, []);

    return (
        <SafeAreaView style={styles.container}>

            <View style={styles.content}>

                {/* BRAND */}
                <Text style={styles.brand}>
                    POVCheck
                </Text>

                {/* TITLE */}
                <Text style={styles.title}>
                    Gegner wird gesucht
                </Text>

                {/* SUBTITLE */}
                <Text style={styles.subtitle}>
                    Wir suchen einen passenden Gegner für dich.
                </Text>

                {/* CHESS BOARD */}
                <WaitingChessBoard />

                {/* STATUS */}
                <View style={styles.statusBox}>

                    <View style={styles.statusDot} />

                    <Text style={styles.statusText}>
                        Suche nach einem Gegner...
                    </Text>

                </View>

                {/* INFO */}
                <Text style={styles.info}>
                    Das Match startet automatisch,
                    sobald ein Gegner gefunden wurde.
                </Text>

            </View>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
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

    info: {
        marginTop: 18,

        color: "#64748b",

        fontSize: 12,

        textAlign: "center",

        lineHeight: 18,

        maxWidth: 280,
    },
});