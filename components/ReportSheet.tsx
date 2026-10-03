import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Socket } from "socket.io-client";
import { REPORT_REASONS, ReportReason, reportPlayer } from "../lib/feedback";
import { tr } from "../lib/i18n";
import Sheet from "./play/Sheet";
import { T } from "./ui/theme";

type Props = {
    visible: boolean;
    onClose: () => void;
    socket: Socket | null | undefined;
    roomId: string | null | undefined;
    opponentName: string;
};

function reasonLabel(reason: ReportReason): { title: string; hint: string } {
    switch (reason) {
        case "cheating":
            return { title: tr("Cheating"), hint: tr("Used an engine or outside help") };
        case "abuse":
            return { title: tr("Insults in chat"), hint: tr("Abusive or offensive messages") };
        case "stalling":
            return { title: tr("Stalling"), hint: tr("Let the clock run down or left on purpose") };
        case "name":
            return { title: tr("Name or picture"), hint: tr("Offensive username or avatar") };
        default:
            return { title: tr("Something else"), hint: tr("Describe it below") };
    }
}

function errorText(error: string): string {
    switch (error) {
        case "SIGN_IN_REQUIRED":
            return tr("Sign in to report a player.");
        case "TOO_MANY":
            return tr("You have sent many reports today. Try again tomorrow.");
        case "DETAILS_REQUIRED":
            return tr("Please describe what happened.");
        case "GAME_NOT_FOUND":
            return tr("This game can no longer be reported.");
        default:
            return tr("The report could not be sent. Please try again later.");
    }
}

/** Report the opponent of an online game, with a reason. */
export default function ReportSheet({ visible, onClose, socket, roomId, opponentName }: Props) {
    const [reason, setReason] = useState<ReportReason | null>(null);
    const [details, setDetails] = useState("");
    const [state, setState] = useState<"form" | "sending" | "done">("form");
    const [error, setError] = useState<string | null>(null);

    // A fresh form every time the sheet opens.
    useEffect(() => {
        if (visible) {
            setReason(null);
            setDetails("");
            setState("form");
            setError(null);
        }
    }, [visible]);

    async function send() {
        if (!reason || state === "sending") return;

        if (reason === "other" && details.trim().length < 5) {
            setError(errorText("DETAILS_REQUIRED"));
            return;
        }

        setState("sending");
        setError(null);

        const result = await reportPlayer(socket, roomId, reason, details);

        if (result.ok) {
            setState("done");
        } else {
            setState("form");
            setError(errorText(result.error));
        }
    }

    if (state === "done") {
        return (
            <Sheet visible={visible} title={tr("Report sent")} onClose={onClose}>
                <View style={styles.done}>
                    <Ionicons name="checkmark-circle" size={44} color={T.green} />
                    <Text style={styles.doneText}>
                        {tr("Thank you. We look at every report. You will not get a message about the result.")}
                    </Text>
                    <Pressable style={styles.primary} onPress={onClose}>
                        <Text style={styles.primaryText}>{tr("Close")}</Text>
                    </Pressable>
                </View>
            </Sheet>
        );
    }

    return (
        <Sheet
            visible={visible}
            title={tr("Report {0}", opponentName)}
            subtitle={tr("What happened in this game?")}
            onClose={onClose}
            footer={
                <Pressable
                    style={[styles.primary, (!reason || state === "sending") && styles.primaryDisabled]}
                    disabled={!reason || state === "sending"}
                    onPress={send}
                >
                    {state === "sending" ? (
                        <ActivityIndicator color={T.onAccent} />
                    ) : (
                        <Text style={styles.primaryText}>{tr("Send report")}</Text>
                    )}
                </Pressable>
            }
        >
            {REPORT_REASONS.map((entry) => {
                const label = reasonLabel(entry);
                const active = entry === reason;

                return (
                    <Pressable
                        key={entry}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        onPress={() => {
                            setReason(entry);
                            setError(null);
                        }}
                        style={({ pressed }) => [styles.reason, active && styles.reasonActive, pressed && styles.pressed]}
                    >
                        <View style={[styles.radio, active && styles.radioActive]}>
                            {active && <View style={styles.radioDot} />}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.reasonTitle}>{label.title}</Text>
                            <Text style={styles.reasonHint}>{label.hint}</Text>
                        </View>
                    </Pressable>
                );
            })}

            <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder={tr("Details (optional)")}
                placeholderTextColor={T.textFaint}
                multiline
                maxLength={1000}
                style={styles.input}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.note}>
                {tr("The moves of this game are sent along with your report. False reports can lead to a penalty.")}
            </Text>
        </Sheet>
    );
}

const styles = StyleSheet.create({
    reason: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 13,
        borderRadius: 14,
        backgroundColor: T.raised,
        borderWidth: 1,
        borderColor: T.border,
        marginBottom: 8,
    },
    reasonActive: { backgroundColor: T.accentSoft, borderColor: T.accentBorder },
    reasonTitle: { color: T.text, fontSize: 15, fontWeight: "600" },
    reasonHint: { color: T.textDim, fontSize: 12.5, marginTop: 2 },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: T.borderStrong,
        alignItems: "center",
        justifyContent: "center",
    },
    radioActive: { borderColor: T.accent },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.accent },

    input: {
        minHeight: 84,
        textAlignVertical: "top",
        color: T.text,
        fontSize: 14,
        padding: 13,
        borderRadius: 14,
        backgroundColor: T.raised,
        borderWidth: 1,
        borderColor: T.border,
        marginTop: 4,
    },
    error: { color: "#E0735C", fontSize: 13, marginTop: 10 },
    note: { color: T.textFaint, fontSize: 12, lineHeight: 17, marginTop: 12 },

    primary: {
        minHeight: 48,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: T.accent,
        paddingHorizontal: 20,
    },
    primaryDisabled: { opacity: 0.45 },
    primaryText: { color: T.onAccent, fontSize: 15, fontWeight: "700" },

    done: { alignItems: "center", gap: 14, paddingVertical: 12 },
    doneText: { color: T.textDim, fontSize: 14, lineHeight: 20, textAlign: "center" },

    pressed: { opacity: 0.72 },
});
