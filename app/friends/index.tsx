import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";

import {
    ActivityIndicator,
    ImageBackground,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { AccountType, getCurrentAccount } from "../../lib/account";
import {
    FriendEntry,
    FriendProfile,
    acceptFriendRequest,
    declineFriendRequest,
    getFriends,
    getIncomingRequests,
    removeFriend,
    searchUsers,
    sendFriendRequest,
} from "../../lib/friends";
import { getSocket } from "../../lib/socket";

type FriendWithStatus = FriendEntry & { online: boolean };

/** Gleiche Outline-Icon-Logik wie in Home/Social. */
type IconName = "person" | "chevron" | "search";

function Icon({ name, size = 18, color = "#EDF0F3" }: { name: IconName; size?: number; color?: string }) {
    const s = size;

    switch (name) {
        case "person":
            return (
                <View style={{ width: s, height: s, alignItems: "center", justifyContent: "center" }}>
                    <View
                        style={{
                            width: s * 0.36, height: s * 0.36, borderRadius: (s * 0.36) / 2,
                            borderWidth: 1.5, borderColor: color, marginBottom: 2,
                        }}
                    />
                    <View
                        style={{
                            width: s * 0.62, height: s * 0.32, borderWidth: 1.5, borderColor: color,
                            borderTopLeftRadius: s * 0.3, borderTopRightRadius: s * 0.3, borderBottomWidth: 0,
                        }}
                    />
                </View>
            );

        case "chevron":
            return (
                <View style={{ width: s, height: s, alignItems: "center", justifyContent: "center" }}>
                    <View
                        style={{
                            width: s * 0.38, height: s * 0.38,
                            borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: color,
                            transform: [{ rotate: "45deg" }], marginLeft: -(s * 0.06),
                        }}
                    />
                </View>
            );

        case "search":
            return (
                <View style={{ width: s, height: s, alignItems: "center", justifyContent: "center" }}>
                    <View
                        style={{
                            width: s * 0.55, height: s * 0.55, borderRadius: (s * 0.55) / 2,
                            borderWidth: 1.5, borderColor: color,
                        }}
                    />
                    <View
                        style={{
                            position: "absolute", width: s * 0.28, height: 1.5, backgroundColor: color,
                            bottom: s * 0.08, right: s * 0.08, transform: [{ rotate: "45deg" }],
                        }}
                    />
                </View>
            );
    }
}

const AVATAR_COLORS = ["#5B8DB8", "#6F9E8C", "#C9A24B", "#8B6FB8", "#C25450"];

function colorForName(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function Avatar({ username, size = 44 }: { username: string; size?: number }) {
    const initial = username.trim().charAt(0).toUpperCase() || "?";
    const bg = colorForName(username);

    return (
        <View
            style={{
                width: size, height: size, borderRadius: size / 2,
                backgroundColor: `${bg}33`, borderWidth: 1.5, borderColor: bg,
                alignItems: "center", justifyContent: "center",
            }}
        >
            <Text style={{ color: bg, fontWeight: "700", fontSize: size * 0.4 }}>{initial}</Text>
        </View>
    );
}

export default function FriendsScreen() {
    const router = useRouter();
    const backgroundImage = require("../../assets/images/background.png");

    const [account, setAccount] = useState<AccountType | null>(null);
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
    const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

    const [friends, setFriends] = useState<FriendWithStatus[]>([]);
    const [requests, setRequests] = useState<FriendEntry[]>([]);

    const loadData = useCallback(async () => {
        const acc = await getCurrentAccount();
        setAccount(acc);

        if (!acc || acc.guest || !acc.authId) {
            setLoading(false);
            return;
        }

        const [friendList, requestList] = await Promise.all([getFriends(), getIncomingRequests()]);

        setFriends(friendList.map((f) => ({ ...f, online: false })));
        setRequests(requestList);
        setLoading(false);

        const authIds = friendList.map((f) => f.profile.id).filter(Boolean);
        if (authIds.length === 0) return;

        const socket = getSocket();

        const handleStatus = (data: any) => {
            const online: string[] = Array.isArray(data?.online) ? data.online : [];
            setFriends((prev) => prev.map((f) => ({ ...f, online: online.includes(f.profile.id) })));
        };

        socket.once("friends_online_status", handleStatus);
        socket.emit("check_friends_online", { authIds });
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    async function handleSearch(text: string) {
        setSearch(text);

        if (text.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const results = await searchUsers(text);
            setSearchResults(results);
        } catch (error) {
            console.log("SEARCH ERROR:", error);
        } finally {
            setSearching(false);
        }
    }

    async function handleAddFriend(userId: string) {
        try {
            await sendFriendRequest(userId);
            setSentRequests((prev) => new Set(prev).add(userId));
        } catch (error: any) {
            console.log("ADD FRIEND ERROR:", error?.message || error);
        }
    }

    async function handleAccept(friendshipId: string) {
        try {
            await acceptFriendRequest(friendshipId);
            await loadData();
        } catch (error) {
            console.log("ACCEPT ERROR:", error);
        }
    }

    async function handleDecline(friendshipId: string) {
        try {
            await declineFriendRequest(friendshipId);
            setRequests((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
        } catch (error) {
            console.log("DECLINE ERROR:", error);
        }
    }

    async function handleRemoveFriend(friendshipId: string) {
        try {
            await removeFriend(friendshipId);
            setFriends((prev) => prev.filter((f) => f.friendshipId !== friendshipId));
        } catch (error) {
            console.log("REMOVE FRIEND ERROR:", error);
        }
    }

    function goToProfile(userId: string, username: string, avatar?: string, rating?: number) {
        router.push({
            pathname: "/profile",
            params: {
                userId,
                name: username,
                avatar: avatar || "",
                rating: rating != null ? String(rating) : "",
            },
        });
    }

    if (loading) {
        return (
            <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
                <View style={styles.scrim} />
                <View style={styles.center}>
                    <ActivityIndicator color="#EDF0F3" />
                </View>
            </ImageBackground>
        );
    }

    if (!account || account.guest || !account.authId) {
        return (
            <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
                <View style={styles.scrim} />
                <View style={styles.center}>
                    <View style={styles.emptyIconWrap}>
                        <Icon name="person" size={26} color="#5B8DB8" />
                    </View>
                    <Text style={styles.title}>Freunde</Text>
                    <Text style={styles.status}>
                        Melde dich mit einem Account an, um Freunde hinzuzufügen. Als Gast ist das
                        Freundessystem nicht verfügbar.
                    </Text>
                </View>
            </ImageBackground>
        );
    }

    return (
        <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
            <View style={styles.scrim} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
               {/* HEADER */}
<View style={styles.header}>
    <Pressable
        onPress={() => router.back()}
        style={styles.backButton}
    >
        <Text style={styles.backText}>‹</Text>
    </Pressable>

    <Text style={styles.headerTitle}>Freunde</Text>

    <View style={{ width: 42 }} />
</View>

<View style={styles.headerRow}>
    <Text style={styles.title}>{friends.length} Freunde</Text>

    {requests.length > 0 && (
        <View style={styles.requestPill}>
            <Text style={styles.requestPillText}>
                {requests.length}{" "}
                {requests.length === 1 ? "Anfrage" : "Anfragen"}
            </Text>
        </View>
    )}
</View>
                {/* SEARCH */}
                <View style={styles.searchCard}>
                    <View style={styles.searchInputRow}>
                        <Icon name="search" size={16} color="rgba(237,240,243,0.5)" />
                        <TextInput
                            value={search}
                            onChangeText={handleSearch}
                            placeholder="Username suchen"
                            placeholderTextColor="rgba(237,240,243,0.4)"
                            style={styles.input}
                            autoCapitalize="none"
                        />
                    </View>

                    {searching && <ActivityIndicator style={{ marginTop: 12 }} color="#EDF0F3" />}

                    {searchResults.map((user) => {
                        const alreadySent = sentRequests.has(user.id);
                        const alreadyFriend = friends.some((f) => f.profile.id === user.id);

                        return (
                            <View key={user.id} style={styles.searchRow}>
                                <Pressable
                                    style={styles.personTap}
                                    onPress={() => goToProfile(user.id, user.username, user.avatar ?? undefined, user.rating)}
                                    hitSlop={6}
                                >
                                    <Avatar username={user.username} size={36} />
                                    <Text style={styles.name}>{user.username}</Text>
                                </Pressable>

                                <Pressable
                                    style={[styles.smallButton, (alreadySent || alreadyFriend) && styles.smallButtonDisabled]}
                                    disabled={alreadySent || alreadyFriend}
                                    onPress={() => handleAddFriend(user.id)}
                                >
                                    <Text style={styles.buttonText}>
                                        {alreadyFriend ? "Befreundet" : alreadySent ? "Angefragt" : "Hinzufügen"}
                                    </Text>
                                </Pressable>
                            </View>
                        );
                    })}
                </View>

                {/* REQUESTS */}
                {requests.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Anfragen</Text>

                        {requests.map((r) => (
                            <View key={r.friendshipId} style={styles.cardRow}>
                                <Pressable
                                    style={styles.personTap}
                                    onPress={() => goToProfile(r.profile.id, r.profile.username, r.profile.avatar ?? undefined, r.profile.rating)}
                                    hitSlop={6}
                                >
                                    <Avatar username={r.profile.username} />
                                    <Text style={styles.name}>{r.profile.username}</Text>
                                </Pressable>

                                <View style={{ flexDirection: "row", gap: 10 }}>
                                    <Pressable style={styles.acceptBtn} onPress={() => handleAccept(r.friendshipId)}>
                                        <Text style={styles.acceptText}>Annehmen</Text>
                                    </Pressable>

                                    <Pressable style={styles.declineBtn} onPress={() => handleDecline(r.friendshipId)}>
                                        <Text style={styles.declineText}>✕</Text>
                                    </Pressable>
                                </View>
                            </View>
                        ))}
                    </>
                )}

                {/* FRIENDS */}
                <Text style={styles.sectionTitle}>Deine Freunde</Text>

                {friends.length === 0 && (
                    <View style={styles.emptyCard}>
                        <View style={styles.emptyIconWrap}>
                            <Icon name="person" size={22} color="#5B8DB8" />
                        </View>
                        <Text style={styles.emptyTitle}>Noch keine Freunde</Text>
                        <Text style={styles.status}>
                            Such oben nach einem Usernamen, um deine erste Freundschaft zu starten.
                        </Text>
                    </View>
                )}

                {friends.map((f) => (
                    <View key={f.friendshipId} style={styles.cardRow}>
                        <Pressable
                            style={styles.personTap}
                            onPress={() => goToProfile(f.profile.id, f.profile.username, f.profile.avatar ?? undefined, f.profile.rating)}
                            hitSlop={6}
                        >
                            <View>
                                <Avatar username={f.profile.username} />
                                {f.online && <View style={styles.onlineDot} />}
                            </View>

                            <View>
                                <Text style={styles.name}>{f.profile.username}</Text>
                                <Text style={styles.statusInline}>{f.online ? "Online" : "Offline"}</Text>
                            </View>
                        </Pressable>

                        <Pressable onPress={() => handleRemoveFriend(f.friendshipId)} hitSlop={8}>
                            <Text style={styles.declineText}>✕</Text>
                        </Pressable>
                    </View>
                ))}

                <View style={styles.bottomSpace} />
            </ScrollView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#12151B" },
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10, 12, 16, 0.55)" },
    scrollView: { flex: 1 },
    content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 40 },
backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#201B16",
    borderWidth: 1,
    borderColor: "rgba(245,237,226,0.09)",
    justifyContent: "center",
    alignItems: "center",
},

backText: {
    color: "#F8F4EE",
    fontSize: 34,
    lineHeight: 34,
    fontWeight: "300",
},

headerTitle: {
    color: "#F5EFE6",
    fontSize: 16,
    fontWeight: "600",
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
},
    center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },

    header: { height: 70, marginBottom: 20, justifyContent: "center", },
    logo: { color: "#5B8DB8", fontSize: 13, fontWeight: "700", letterSpacing: 1.4, marginBottom: 10 },
    headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    title: { color: "#F5F7F9", fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },

    requestPill: {
        backgroundColor: "rgba(194, 84, 80, 0.16)",
        borderWidth: 1, borderColor: "rgba(194, 84, 80, 0.4)",
        borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    },
    requestPillText: { color: "#E39490", fontSize: 12, fontWeight: "600" },

    sectionTitle: {
        color: "rgba(237, 240, 243, 0.8)", fontSize: 16, fontWeight: "600",
        marginTop: 22, marginBottom: 12, paddingLeft: 2,
    },

    searchCard: {
        backgroundColor: "#1B2027", borderRadius: 18, padding: 16,
        borderWidth: 1, borderColor: "rgba(237, 240, 243, 0.08)",
    },

    searchInputRow: {
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: "rgba(237, 240, 243, 0.06)",
        borderRadius: 12, paddingHorizontal: 14,
    },

    input: { flex: 1, color: "#EDF0F3", paddingVertical: 12, fontSize: 14 },

    searchRow: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14,
    },

    personTap: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },

    cardRow: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        backgroundColor: "#1B2027", borderRadius: 16, padding: 14, marginBottom: 10,
        borderWidth: 1, borderColor: "rgba(237, 240, 243, 0.08)",
    },

    name: { color: "#F2F4F6", fontSize: 15.5, fontWeight: "600" },
    statusInline: { color: "rgba(237, 240, 243, 0.5)", fontSize: 12.5, marginTop: 2 },

    onlineDot: {
        position: "absolute", bottom: -1, right: -1,
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: "#6F9E8C", borderWidth: 2, borderColor: "#1B2027",
    },

    smallButton: { backgroundColor: "rgba(91, 141, 184, 0.16)", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
    smallButtonDisabled: { opacity: 0.5 },
    buttonText: { color: "#5B8DB8", fontWeight: "600", fontSize: 12.5 },

    acceptBtn: { backgroundColor: "rgba(111, 158, 140, 0.18)", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
    acceptText: { color: "#6F9E8C", fontWeight: "600", fontSize: 12.5 },

    declineBtn: { alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
    declineText: { fontSize: 17, color: "rgba(237, 240, 243, 0.4)" },

    emptyCard: {
        backgroundColor: "#1B2027", borderRadius: 18, padding: 24, alignItems: "center",
        borderWidth: 1, borderColor: "rgba(237, 240, 243, 0.08)",
    },

    emptyIconWrap: {
        width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center",
        backgroundColor: "rgba(91, 141, 184, 0.14)", marginBottom: 14,
    },

    emptyTitle: { color: "#F2F4F6", fontSize: 16, fontWeight: "600", marginBottom: 6 },

    status: { color: "rgba(237, 240, 243, 0.5)", marginTop: 4, textAlign: "center", lineHeight: 20, fontSize: 13 },

    bottomSpace: { height: 18 },
});