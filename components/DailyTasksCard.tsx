import { Ionicons } from "@expo/vector-icons";
import { Href, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DailyTasks, TaskView, getDailyTasks } from "../lib/dailyTasks";
import Coin from "./Coin";
import { tr } from "../lib/i18n";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const GROUP_ICON: Record<TaskView["group"], IconName> = {
    play: "game-controller-outline",
    train: "extension-puzzle-outline",
    learn: "school-outline",
};

// Where a tap on a task leads. Playing starts on the home screen itself.
const TASK_ROUTE: Record<string, Href | null> = {
    play_1: null,
    play_3: null,
    win_1: null,
    puzzles_5: "/learn/puzzles",
    daily_puzzle: "/puzzle/dailyPuzzle",
    lesson_1: "/learn/tutorials",
    review_1: "/Spielverlauf",
};

function taskTitle(task: TaskView): string {
    switch (task.id) {
        case "play_1":
            return tr("Play a game");
        case "play_3":
            return tr("Play {0} games", task.goal);
        case "win_1":
            return tr("Win a game");
        case "puzzles_5":
            return tr("Solve {0} puzzles", task.goal);
        case "daily_puzzle":
            return tr("Solve the daily puzzle");
        case "lesson_1":
            return tr("Finish a lesson");
        case "review_1":
            return tr("Review one of your games");
        default:
            return task.id;
    }
}

/**
 * Three missions per day, each worth XP and coins, with a bonus for doing
 * all of them.
 * Shown on the home screen; reloads whenever the screen comes back into view.
 * onPlay: what a tap on a "play" task does (the home screen opens its
 * time-control picker).
 */
export default function DailyTasksCard({ onPlay }: { onPlay?: () => void }) {
    const router = useRouter();
    const [data, setData] = useState<DailyTasks | null>(null);

    useFocusEffect(
        useCallback(() => {
            let alive = true;

            getDailyTasks()
                .then((tasks) => alive && setData(tasks))
                .catch(() => undefined);

            return () => {
                alive = false;
            };
        }, [])
    );

    if (!data) return null;

    const allDone = data.doneCount === data.tasks.length;

    const open = (task: TaskView) => {
        const route = TASK_ROUTE[task.id];
        if (route) router.push(route);
        else onPlay?.();
    };

    return (
        <View>
            <View style={styles.header}>
                <Text style={styles.sectionTitle}>{tr("Daily Missions")}</Text>
                <Text style={styles.count}>{tr("{0} of {1} done", data.doneCount, data.tasks.length)}</Text>
            </View>

            <View style={styles.card}>
                {data.tasks.map((task, index) => (
                    <Pressable
                        key={task.id}
                        accessibilityRole="button"
                        accessibilityLabel={taskTitle(task)}
                        disabled={task.done}
                        onPress={() => open(task)}
                        style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && styles.pressed]}
                    >
                        <View style={[styles.badge, task.done && styles.badgeDone]}>
                            <Ionicons
                                name={task.done ? "checkmark" : GROUP_ICON[task.group]}
                                size={17}
                                color={task.done ? "#6FCF97" : "#EDF0F3"}
                            />
                        </View>

                        <View style={styles.body}>
                            <Text style={[styles.title, task.done && styles.titleDone]}>{taskTitle(task)}</Text>

                            {task.goal > 1 && !task.done ? (
                                <View style={styles.progressRow}>
                                    <View style={styles.track}>
                                        <View style={[styles.fill, { width: `${(task.progress / task.goal) * 100}%` }]} />
                                    </View>
                                    <Text style={styles.progressText}>
                                        {task.progress}/{task.goal}
                                    </Text>
                                </View>
                            ) : (
                                <Text style={styles.subtitle}>{task.done ? tr("Done") : tr("Not done yet")}</Text>
                            )}
                        </View>

                        <View style={[styles.xp, task.done && styles.xpDone]}>
                            <Text style={[styles.xpText, task.done && styles.xpTextDone]}>+{task.xp} XP</Text>
                            <Text style={[styles.xpText, styles.xpDot, task.done && styles.xpTextDone]}>·</Text>
                            <Text style={[styles.xpText, task.done && styles.xpTextDone]}>{data.coinsPerTask}</Text>
                            <Coin size={11} />
                        </View>
                    </Pressable>
                ))}

                <View style={[styles.bonus, styles.divider]}>
                    <Ionicons name={allDone ? "gift" : "gift-outline"} size={15} color="#D4AF37" />
                    <Text style={styles.bonusText}>
                        {allDone
                            ? tr("All done - bonus collected. New missions tomorrow.")
                            : tr("Finish all three: {0} XP and {1} coins extra", data.bonusXp, data.bonusCoins)}
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 16,
        marginBottom: 14,
    },
    sectionTitle: { color: "rgba(237, 240, 243, 0.8)", fontSize: 16, fontWeight: "600", paddingLeft: 2 },
    count: { color: "rgba(237, 240, 243, 0.5)", fontSize: 13 },

    card: {
        borderRadius: 18,
        backgroundColor: "#1B2027",
        borderWidth: 1,
        borderColor: "rgba(237, 240, 243, 0.08)",
        paddingHorizontal: 16,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
    divider: { borderTopWidth: 1, borderTopColor: "rgba(237, 240, 243, 0.06)" },
    pressed: { opacity: 0.72 },

    badge: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(237, 240, 243, 0.06)",
    },
    badgeDone: { backgroundColor: "rgba(111, 207, 151, 0.14)" },

    body: { flex: 1 },
    title: { color: "#F2F4F6", fontSize: 15, fontWeight: "600", marginBottom: 3 },
    titleDone: { color: "rgba(237, 240, 243, 0.55)" },
    subtitle: { color: "rgba(237, 240, 243, 0.5)", fontSize: 12.5 },

    progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
    track: { flex: 1, height: 5, borderRadius: 3, backgroundColor: "rgba(237, 240, 243, 0.08)", overflow: "hidden" },
    fill: { height: 5, borderRadius: 3, backgroundColor: "#5B8DB8" },
    progressText: { color: "rgba(237, 240, 243, 0.55)", fontSize: 12, fontWeight: "600" },

    xp: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: "rgba(212, 175, 55, 0.12)",
        borderWidth: 1,
        borderColor: "rgba(212, 175, 55, 0.35)",
    },
    xpDone: { backgroundColor: "rgba(111, 207, 151, 0.12)", borderColor: "rgba(111, 207, 151, 0.35)" },
    xpText: { color: "#D4AF37", fontSize: 12, fontWeight: "700" },
    xpTextDone: { color: "#6FCF97" },
    xpDot: { opacity: 0.6 },

    bonus: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
    bonusText: { flex: 1, color: "rgba(237, 240, 243, 0.6)", fontSize: 12.5, lineHeight: 17 },
});
