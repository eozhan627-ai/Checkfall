import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ImageBackground,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

// ANNAHME: Socket-Singleton, analog zu "./supabase" in account.ts.
// Falls dein Socket woanders herkommt (Context/Hook), nur diese Zeile anpassen.
import { getSocket } from "../../lib/socket";

import { AccountType, getCurrentAccount } from "../../lib/account";
import {
    ClanInviteType,
    ClanMemberType,
    ClanMessageType,
    ClanPublicType,
    ClanRank,
    ClanType,
    createClan,
    demoteAdmin,
    getClanData,
    getMyClan,
    getMyInvites,
    getPublicClans,
    inviteToClan,
    joinClan,
    joinClanRoom,
    kickMember,
    leaveClan,
    onClanInviteReceived,
    onClanMemberDemoted,
    onClanMemberJoined,
    onClanMemberLeft,
    onClanMemberPromoted,
    onClanMessage,
    onKickedFromClan,
    promoteMember,
    respondToInvite,
    sendClanMessage,
} from "../../lib/clans";

const backgroundImage = require("../../assets/images/clanbackground.png");

export default function ClansScreen() {
    // Ein einziger Socket für die ganze Komponente, statt an jeder
    // Stelle neu zu deklarieren (das war der Grund für "Cannot find name 'socket'").
    const socket = getSocket();

    const [account, setAccount] = useState<AccountType | null>(null);
    const [loading, setLoading] = useState(true);

    // Kein-Clan-Zustand
    const [publicClans, setPublicClans] = useState<ClanPublicType[]>([]);
    const [newClanName, setNewClanName] = useState("");

    // Im-Clan-Zustand
    const [myClan, setMyClan] = useState<ClanType | null>(null);
    const [myRank, setMyRank] = useState<ClanRank | null>(null);
    const [members, setMembers] = useState<ClanMemberType[]>([]);
    const [messages, setMessages] = useState<ClanMessageType[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [inviteUsername, setInviteUsername] = useState("");

    // Einladungen (immer relevant, egal ob im Clan oder nicht)
    const [invites, setInvites] = useState<ClanInviteType[]>([]);

    const scrollRef = useRef<ScrollView>(null);
    const isLeaderOrAdmin = myRank === "leader" || myRank === "admin";

    // =============================
    // LADEN
    // =============================

    const loadNoClanState = useCallback(async () => {
        const clans = await getPublicClans();
        setPublicClans(clans);
    }, []);

    const loadClanState = useCallback(
        async (clanId: string) => {
            const data = await getClanData(socket, clanId);
            setMembers(data.members);
            setMessages(data.messages);
        },
        [socket]
    );

    const bootstrap = useCallback(async () => {
        setLoading(true);

        const acc = await getCurrentAccount();
        setAccount(acc);

        try {
            const { invites } = await getMyInvites(socket);
            setInvites(invites);
        } catch {
            // egal, Einladungen sind nicht kritisch fürs Laden
        }

        try {
            const { clan, myRank } = await getMyClan(socket);

            if (clan) {
                setMyClan(clan);
                setMyRank(myRank || "member");
                await joinClanRoom(socket, clan.id);
                await loadClanState(clan.id);
            } else {
                setMyClan(null);
                setMyRank(null);
                await loadNoClanState();
            }
        } catch (error) {
            console.log("CLAN BOOTSTRAP ERROR:", error);
            await loadNoClanState();
        }

        setLoading(false);
    }, [socket, loadClanState, loadNoClanState]);

    useEffect(() => {
        bootstrap();
    }, [bootstrap]);

    // =============================
    // REALTIME LISTENER
    // =============================

    useEffect(() => {
        // Alle on-Event-Funktionen erwarten (socket, callback) - vorher fehlte
        // jeweils der Socket als erstes Argument ("Expected 2 arguments, but got 1").
        const offMessage = onClanMessage(socket, (msg) => {
            if (myClan && msg.clan_id === myClan.id) {
                setMessages((prev) => [...prev, msg]);
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
            }
        });

        const offJoined = onClanMemberJoined(socket, (data) => {
            setMembers((prev) => {
                if (prev.some((m) => m.user_id === data.userId)) return prev;
                return [
                    ...prev,
                    {
                        user_id: data.userId,
                        rank: "member",
                        joined_at: new Date().toISOString(),
                        profiles: { username: data.username },
                    },
                ];
            });
        });

        const offLeft = onClanMemberLeft(socket, (data) => {
            setMembers((prev) => prev.filter((m) => m.user_id !== data.userId));
        });

        const offPromoted = onClanMemberPromoted(socket, (data) => {
            setMembers((prev) =>
                prev.map((m) => (m.user_id === data.userId ? { ...m, rank: "admin" } : m))
            );
        });

        const offDemoted = onClanMemberDemoted(socket, (data) => {
            setMembers((prev) =>
                prev.map((m) => (m.user_id === data.userId ? { ...m, rank: "member" } : m))
            );
        });

        const offInvite = onClanInviteReceived(socket, async () => {
            try {
                const { invites } = await getMyInvites(socket);
                setInvites(invites);
            } catch { }
        });

        const offKicked = onKickedFromClan(socket, (data) => {
            if (myClan && data.clanId === myClan.id) {
                Alert.alert("Clan", "Du wurdest aus dem Clan entfernt.");
                setMyClan(null);
                setMyRank(null);
                setMembers([]);
                setMessages([]);
                loadNoClanState();
            }
        });

        return () => {
            offMessage();
            offJoined();
            offLeft();
            offPromoted();
            offDemoted();
            offInvite();
            offKicked();
        };
    }, [socket, myClan, loadNoClanState]);

    // =============================
    // AKTIONEN
    // =============================

    async function handleCreateClan() {
        if (!newClanName.trim()) return;

        try {
            const { clan } = await createClan(socket, { name: newClanName.trim() });
            setMyClan(clan);
            setMyRank("leader");
            setNewClanName("");
            await loadClanState(clan.id);
        } catch (error: any) {
            Alert.alert("Fehler", translateClanError(error.message));
        }
    }

    async function handleJoinClan(clanId: string) {
        try {
            await joinClan(socket, clanId);
            const { clan, myRank } = await getMyClan(socket);
            setMyClan(clan);
            setMyRank(myRank || "member");
            if (clan) {
                await joinClanRoom(socket, clan.id);
                await loadClanState(clan.id);
            }
        } catch (error: any) {
            Alert.alert("Fehler", translateClanError(error.message));
        }
    }

    async function handleLeaveClan() {
        if (!myClan) return;

        Alert.alert("Clan verlassen", `Möchtest du "${myClan.name}" wirklich verlassen?`, [
            { text: "Abbrechen", style: "cancel" },
            {
                text: "Verlassen",
                style: "destructive",
                onPress: async () => {
                    try {
                        await leaveClan(socket, myClan.id);
                        setMyClan(null);
                        setMyRank(null);
                        setMembers([]);
                        setMessages([]);
                        await loadNoClanState();
                    } catch (error: any) {
                        Alert.alert("Fehler", translateClanError(error.message));
                    }
                },
            },
        ]);
    }

    async function handleSendMessage() {
        if (!myClan || !chatInput.trim()) return;

        const text = chatInput.trim();
        setChatInput("");

        try {
            await sendClanMessage(socket, myClan.id, text);
        } catch (error: any) {
            Alert.alert("Fehler", translateClanError(error.message));
        }
    }

    async function handleInvite() {
        if (!myClan || !inviteUsername.trim()) return;

        try {
            await inviteToClan(socket, myClan.id, inviteUsername.trim());
            setInviteUsername("");
            Alert.alert("Einladung gesendet", `${inviteUsername.trim()} wurde eingeladen.`);
        } catch (error: any) {
            Alert.alert("Fehler", translateClanError(error.message));
        }
    }

    async function handleRespondInvite(invite: ClanInviteType, accept: boolean) {
        try {
            const result = await respondToInvite(socket, invite.id, accept);
            setInvites((prev) => prev.filter((i) => i.id !== invite.id));

            if (accept && result.clanId) {
                const { clan, myRank } = await getMyClan(socket);
                setMyClan(clan);
                setMyRank(myRank || "member");
                if (clan) {
                    await joinClanRoom(socket, clan.id);
                    await loadClanState(clan.id);
                }
            }
        } catch (error: any) {
            Alert.alert("Fehler", translateClanError(error.message));
        }
    }

    async function handlePromote(userId: string) {
        if (!myClan) return;
        try {
            await promoteMember(socket, myClan.id, userId);
        } catch (error: any) {
            Alert.alert("Fehler", translateClanError(error.message));
        }
    }

    async function handleDemote(userId: string) {
        if (!myClan) return;
        try {
            await demoteAdmin(socket, myClan.id, userId);
        } catch (error: any) {
            Alert.alert("Fehler", translateClanError(error.message));
        }
    }

    async function handleKick(userId: string, username: string) {
        if (!myClan) return;

        Alert.alert("Mitglied entfernen", `${username} wirklich aus dem Clan werfen?`, [
            { text: "Abbrechen", style: "cancel" },
            {
                text: "Entfernen",
                style: "destructive",
                onPress: async () => {
                    try {
                        await kickMember(socket, myClan.id, userId);
                    } catch (error: any) {
                        Alert.alert("Fehler", translateClanError(error.message));
                    }
                },
            },
        ]);
    }

    // =============================
    // RENDER
    // =============================

    if (loading) {
        return (
            <ImageBackground source={backgroundImage} style={{ flex: 1 }}>
                <View style={styles.centered}>
                    <ActivityIndicator color="#fff" size="large" />
                </View>
            </ImageBackground>
        );
    }

    return (
        <ImageBackground source={backgroundImage} style={{ flex: 1 }}>
            <ScrollView
                ref={scrollRef}
                style={styles.container}
                contentContainerStyle={{ padding: 16 }}
            >
                <Text style={styles.title}>Clans</Text>

                {/* OFFENE EINLADUNGEN */}
                {invites.length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Deine Einladungen</Text>

                        {invites.map((invite) => (
                            <View key={invite.id} style={styles.inviteRow}>
                                <Text style={styles.memberText}>
                                    {invite.clans?.name || "Clan"}
                                </Text>

                                <View style={{ flexDirection: "row", gap: 8 }}>
                                    <TouchableOpacity
                                        style={styles.smallBtnAccept}
                                        onPress={() => handleRespondInvite(invite, true)}
                                    >
                                        <Text style={styles.joinText}>Annehmen</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.smallBtnDecline}
                                        onPress={() => handleRespondInvite(invite, false)}
                                    >
                                        <Text style={styles.joinText}>Ablehnen</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {!myClan ? (
                    <>
                        <Text style={styles.subtitle}>
                            Erstelle einen Clan oder tritt einem bei
                        </Text>

                        {/* CREATE */}
                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Clan erstellen</Text>

                            <TextInput
                                value={newClanName}
                                onChangeText={setNewClanName}
                                placeholder="Clan Name"
                                placeholderTextColor="#888"
                                style={styles.input}
                                maxLength={40}
                            />

                            <TouchableOpacity style={styles.button} onPress={handleCreateClan}>
                                <Text style={styles.buttonText}>Clan erstellen</Text>
                            </TouchableOpacity>
                        </View>

                        {/* CLAN LIST */}
                        <Text style={styles.sectionTitle}>Öffentliche Clans</Text>

                        {publicClans.length === 0 && (
                            <Text style={styles.memberText}>Noch keine Clans vorhanden.</Text>
                        )}

                        {publicClans.map((clan) => (
                            <View key={clan.id} style={styles.clanCard}>
                                <View>
                                    <Text style={styles.clanName}>
                                        🏰 {clan.name} {clan.tag ? `[${clan.tag}]` : ""}
                                    </Text>

                                    <Text style={styles.memberText}>
                                        {clan.member_count}/50 Mitglieder · Liga: {clan.league}
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    style={styles.joinBtn}
                                    onPress={() => handleJoinClan(clan.id)}
                                    disabled={clan.member_count >= 50}
                                >
                                    <Text style={styles.joinText}>
                                        {clan.member_count >= 50 ? "Voll" : "Beitreten"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </>
                ) : (
                    <>
                        {/* CLAN HEADER */}
                        <View style={styles.card}>
                            <Text style={styles.clanName}>
                                🏰 {myClan.name} {myClan.tag ? `[${myClan.tag}]` : ""}
                            </Text>

                            <Text style={styles.memberText}>
                                {members.length}/50 Mitglieder · Liga: {myClan.league} · Dein Rang:{" "}
                                {rankLabel(myRank)}
                            </Text>

                            {myClan.description ? (
                                <Text style={[styles.memberText, { marginTop: 6 }]}>
                                    {myClan.description}
                                </Text>
                            ) : null}

                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: "#5c1f1f", marginTop: 12 }]}
                                onPress={handleLeaveClan}
                            >
                                <Text style={styles.buttonText}>Clan verlassen</Text>
                            </TouchableOpacity>
                        </View>

                        {/* EINLADEN (nur Leader/Admin) */}
                        {isLeaderOrAdmin && (
                            <View style={styles.card}>
                                <Text style={styles.sectionTitle}>Spieler einladen</Text>

                                <TextInput
                                    value={inviteUsername}
                                    onChangeText={setInviteUsername}
                                    placeholder="Username"
                                    placeholderTextColor="#888"
                                    style={styles.input}
                                    maxLength={60}
                                    autoCapitalize="none"
                                />

                                <TouchableOpacity style={styles.button} onPress={handleInvite}>
                                    <Text style={styles.buttonText}>Einladen</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* ROSTER */}
                        <Text style={styles.sectionTitle}>Mitglieder</Text>

                        {members
                            .slice()
                            .sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank))
                            .map((member) => (
                                <View key={member.user_id} style={styles.clanCard}>
                                    <View>
                                        <Text style={styles.clanName}>
                                            {rankIcon(member.rank)} {member.profiles?.username}
                                        </Text>

                                        <Text style={styles.memberText}>
                                            {rankLabel(member.rank)}
                                            {member.profiles?.rating != null
                                                ? ` · ${member.profiles.rating} Elo`
                                                : ""}
                                        </Text>
                                    </View>

                                    {myRank === "leader" && member.rank === "member" && (
                                        <TouchableOpacity
                                            style={styles.smallBtnAccept}
                                            onPress={() => handlePromote(member.user_id)}
                                        >
                                            <Text style={styles.joinText}>Zum Admin</Text>
                                        </TouchableOpacity>
                                    )}

                                    {myRank === "leader" && member.rank === "admin" && (
                                        <TouchableOpacity
                                            style={styles.smallBtnDecline}
                                            onPress={() => handleDemote(member.user_id)}
                                        >
                                            <Text style={styles.joinText}>Admin entfernen</Text>
                                        </TouchableOpacity>
                                    )}

                                    {isLeaderOrAdmin &&
                                        member.rank !== "leader" &&
                                        !(myRank === "admin" && member.rank === "admin") &&
                                        member.user_id !== account?.authId && (
                                            <TouchableOpacity
                                                style={styles.smallBtnDecline}
                                                onPress={() =>
                                                    handleKick(
                                                        member.user_id,
                                                        member.profiles?.username || "Mitglied"
                                                    )
                                                }
                                            >
                                                <Text style={styles.joinText}>Kick</Text>
                                            </TouchableOpacity>
                                        )}
                                </View>
                            ))}

                        {/* CHAT */}
                        <Text style={styles.sectionTitle}>Clan-Chat</Text>

                        <View style={styles.chatBox}>
                            {messages.map((msg) => (
                                <View key={msg.id} style={{ marginBottom: 8 }}>
                                    {msg.type === "system" ? (
                                        <Text style={styles.systemMessage}>· {msg.message} ·</Text>
                                    ) : (
                                        <Text style={styles.chatMessage}>
                                            <Text style={{ fontWeight: "700" }}>
                                                {msg.sender_username}:{" "}
                                            </Text>
                                            {msg.message}
                                        </Text>
                                    )}
                                </View>
                            ))}
                        </View>

                        <View style={styles.chatInputRow}>
                            <TextInput
                                value={chatInput}
                                onChangeText={setChatInput}
                                placeholder="Nachricht schreiben..."
                                placeholderTextColor="#888"
                                style={[styles.input, { flex: 1, marginTop: 0 }]}
                                maxLength={300}
                                onSubmitEditing={handleSendMessage}
                            />

                            <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
                                <Text style={styles.buttonText}>Senden</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </ScrollView>
        </ImageBackground>
    );
}

// =============================
// HELPER
// =============================

function rankIcon(rank: ClanRank) {
    if (rank === "leader") return "👑";
    if (rank === "admin") return "🛡️";
    return "♟️";
}

function rankLabel(rank: ClanRank | null) {
    if (rank === "leader") return "Anführer";
    if (rank === "admin") return "Admin";
    if (rank === "member") return "Mitglied";
    return "-";
}

function rankOrder(rank: ClanRank) {
    if (rank === "leader") return 0;
    if (rank === "admin") return 1;
    return 2;
}

function translateClanError(code: string) {
    const map: Record<string, string> = {
        INVALID_NAME: "Bitte gib einen gültigen Clan-Namen ein.",
        ALREADY_IN_CLAN: "Du bist bereits in einem Clan.",
        NAME_TAKEN: "Dieser Clan-Name ist bereits vergeben.",
        CLAN_FULL: "Dieser Clan ist bereits voll (50/50).",
        NOT_A_MEMBER: "Du bist kein Mitglied dieses Clans.",
        USER_NOT_FOUND: "Dieser Nutzer wurde nicht gefunden.",
        USER_ALREADY_IN_CLAN: "Dieser Nutzer ist bereits in einem Clan.",
        ALREADY_INVITED: "Dieser Nutzer wurde bereits eingeladen.",
        NOT_ALLOWED: "Dafür hast du keine Berechtigung.",
        CANNOT_KICK_LEADER: "Der Anführer kann nicht entfernt werden.",
        RATE_LIMITED: "Bitte nicht so viele Nachrichten auf einmal.",
        NOT_AUTHENTICATED: "Bitte melde dich erneut an.",
    };

    return map[code] || "Etwas ist schiefgelaufen. Bitte versuch es erneut.";
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },

    title: {
        fontSize: 28,
        fontWeight: "700",
        color: "#fff",
        marginBottom: 6,
        marginTop: 20,
    },

    subtitle: { color: "#aaa", fontSize: 14, marginBottom: 20 },

    sectionTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 12,
    },

    card: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
    },

    input: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: 12,
        color: "#fff",
        marginTop: 8,
    },

    button: {
        marginTop: 14,
        backgroundColor: "#1f2937",
        borderRadius: 12,
        padding: 14,
        alignItems: "center",
    },

    buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },

    clanCard: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
        gap: 8,
    },

    clanName: { color: "#fff", fontSize: 17, fontWeight: "600" },
    memberText: { color: "#aaa", marginTop: 4 },

    joinBtn: {
        backgroundColor: "#2d3748",
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
    },

    joinText: { color: "#fff", fontWeight: "600" },

    smallBtnAccept: {
        backgroundColor: "#1f4d2f",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
    },

    smallBtnDecline: {
        backgroundColor: "#5c1f1f",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
    },

    inviteRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 8,
    },

    chatBox: {
        backgroundColor: "rgba(0,0,0,0.3)",
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
        minHeight: 120,
    },

    chatMessage: { color: "#fff", fontSize: 14 },
    systemMessage: { color: "#888", fontSize: 12, fontStyle: "italic", textAlign: "center" },

    chatInputRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 40,
    },

    sendBtn: {
        backgroundColor: "#1f2937",
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
});