import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "../components/ui/theme";
import { SUPPORT_CATEGORIES, SupportCategory, sendSupportRequest } from "../lib/feedback";
import { tr } from "../lib/i18n";

const SUPPORT_EMAIL = "checkfall744@gmail.com";

function categoryLabel(category: SupportCategory): string {
    switch (category) {
        case "bug":
            return tr("Something is broken");
        case "account":
            return tr("Account");
        case "payment":
            return tr("VIP or payment");
        case "player":
            return tr("Another player");
        case "idea":
            return tr("Idea");
        default:
            return tr("Other");
    }
}

function errorText(error: string): string {
    switch (error) {
        case "MESSAGE_TOO_SHORT":
            return tr("Please write a little more, so we can help.");
        case "TOO_MANY":
            return tr("You have sent several messages. Please wait an hour.");
        default:
            return tr("The message could not be sent. You can also write to us by e-mail.");
    }
}

// Support form: the message goes to the server; e-mail stays as a fallback.
export default function SupportScreen() {
    const insets = useSafeAreaInsets();

    const [category, setCategory] = useState<SupportCategory>("bug");
    const [message, setMessage] = useState("");
    const [contact, setContact] = useState("");
    const [state, setState] = useState<"form" | "sending" | "done">("form");
    const [error, setError] = useState<string | null>(null);

    async function send() {
        if (state === "sending") return;

        if (message.trim().length < 10) {
            setError(errorText("MESSAGE_TOO_SHORT"));
            return;
        }

        setState("sending");
        setError(null);

        const result = await sendSupportRequest(category, message, contact);

        if (result.ok) {
            setState("done");
        } else {
            setState("form");
            setError(errorText(result.error));
        }
    }

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView
                contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10} accessibilityLabel={tr("Back")}>
                        <Ionicons name="chevron-back" size={20} color={T.text} />
                    </Pressable>

                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>{tr("Support")}</Text>
                        <Text style={styles.subtitle}>{tr("Write to us - we read every message")}</Text>
                    </View>
                </View>

                {state === "done" ? (
                    <View style={styles.doneCard}>
                        <Ionicons name="checkmark-circle" size={44} color={T.green} />
                        <Text style={styles.doneTitle}>{tr("Message sent")}</Text>
                        <Text style={styles.doneText}>
                            {contact.trim()
                                ? tr("Thank you. We will answer at the address you gave.")
                                : tr("Thank you. You gave no address, so we cannot answer - but we will look into it.")}
                        </Text>
                        <Pressable style={styles.primary} onPress={() => router.back()}>
                            <Text style={styles.primaryText}>{tr("Done")}</Text>
                        </Pressable>
                    </View>
                ) : (
                    <>
                        <Text style={styles.label}>{tr("What is it about?")}</Text>

                        <View style={styles.chips}>
                            {SUPPORT_CATEGORIES.map((entry) => {
                                const active = entry === category;

                                return (
                                    <Pressable
                                        key={entry}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: active }}
                                        onPress={() => setCategory(entry)}
                                        style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
                                    >
                                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{categoryLabel(entry)}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Text style={styles.label}>{tr("Your message")}</Text>
                        <TextInput
                            value={message}
                            onChangeText={(text) => {
                                setMessage(text);
                                setError(null);
                            }}
                            placeholder={tr("What happened? What did you expect?")}
                            placeholderTextColor={T.textFaint}
                            multiline
                            maxLength={3000}
                            style={[styles.input, styles.message]}
                        />

                        <Text style={styles.label}>{tr("E-mail for our answer (optional)")}</Text>
                        <TextInput
                            value={contact}
                            onChangeText={setContact}
                            placeholder="name@example.com"
                            placeholderTextColor={T.textFaint}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            maxLength={200}
                            style={styles.input}
                        />

                        {error ? <Text style={styles.error}>{error}</Text> : null}

                        <Pressable
                            style={[styles.primary, state === "sending" && styles.primaryDisabled]}
                            disabled={state === "sending"}
                            onPress={send}
                        >
                            {state === "sending" ? (
                                <ActivityIndicator color={T.onAccent} />
                            ) : (
                                <Text style={styles.primaryText}>{tr("Send message")}</Text>
                            )}
                        </Pressable>

                        <Text style={styles.note}>
                            {tr("Your message is sent with your app version and device type, and with your account if you are signed in.")}
                        </Text>
                    </>
                )}

                <Pressable
                    style={({ pressed }) => [styles.mail, pressed && styles.pressed]}
                    onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => undefined)}
                >
                    <Ionicons name="mail-outline" size={18} color={T.accent} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.mailTitle}>{tr("Or by e-mail")}</Text>
                        <Text style={styles.mailText}>{SUPPORT_EMAIL}</Text>
                    </View>
                </Pressable>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: T.bg },

    header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 22 },
    back: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: T.raised,
        borderWidth: 1,
        borderColor: T.border,
    },
    title: { color: T.text, fontSize: 24, fontWeight: "700", letterSpacing: -0.4 },
    subtitle: { color: T.textDim, fontSize: 13, marginTop: 2 },

    label: { color: "rgba(237, 240, 243, 0.8)", fontSize: 14, fontWeight: "600", marginBottom: 10, paddingLeft: 2 },

    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
    chip: {
        paddingHorizontal: 13,
        paddingVertical: 9,
        borderRadius: 11,
        backgroundColor: T.raised,
        borderWidth: 1,
        borderColor: T.border,
    },
    chipActive: { backgroundColor: T.accentSoft, borderColor: T.accentBorder },
    chipText: { color: T.textDim, fontSize: 13.5, fontWeight: "600" },
    chipTextActive: { color: T.text },

    input: {
        color: T.text,
        fontSize: 14.5,
        padding: 13,
        borderRadius: 14,
        backgroundColor: T.raised,
        borderWidth: 1,
        borderColor: T.border,
        marginBottom: 20,
    },
    message: { minHeight: 140, textAlignVertical: "top" },

    error: { color: "#E0735C", fontSize: 13, marginBottom: 12 },

    primary: {
        minHeight: 50,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: T.accent,
        paddingHorizontal: 24,
    },
    primaryDisabled: { opacity: 0.45 },
    primaryText: { color: T.onAccent, fontSize: 15, fontWeight: "700" },
    note: { color: T.textFaint, fontSize: 12, lineHeight: 17, marginTop: 12 },

    doneCard: {
        alignItems: "center",
        gap: 12,
        padding: 22,
        borderRadius: 18,
        backgroundColor: T.raised,
        borderWidth: 1,
        borderColor: T.border,
    },
    doneTitle: { color: T.text, fontSize: 18, fontWeight: "700" },
    doneText: { color: T.textDim, fontSize: 14, lineHeight: 20, textAlign: "center", marginBottom: 6 },

    mail: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 14,
        backgroundColor: T.raised,
        borderWidth: 1,
        borderColor: T.border,
        marginTop: 24,
    },
    mailTitle: { color: T.text, fontSize: 14, fontWeight: "600" },
    mailText: { color: T.textDim, fontSize: 13, marginTop: 1 },

    pressed: { opacity: 0.72 },
});
