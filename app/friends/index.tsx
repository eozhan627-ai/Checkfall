import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";

import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import ImageBackground from "../../components/ui/ImageBackground";
import { AccountType, getCurrentAccount } from "../../lib/account";
import {
    FriendEntry,
    FriendProfile,
    acceptFriendRequest,
    cancelFriendRequest,
    declineFriendRequest,
    getFriends,
    getIncomingRequests,
    getOutgoingRequests,
    removeFriend,
    searchUsers,
    sendFriendRequest,
} from "../../lib/friends";
import { getSocket } from "../../lib/socket";
import { log } from "../../lib/log";
import UiAvatar from "../../components/ui/Avatar";
import { startChallenge } from "../../lib/challenges";
import { tr } from "../../lib/i18n";

type FriendWithStatus = FriendEntry & { online: boolean; inGame: boolean };

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

function Avatar({
    username,
    uri,
    size = 44,
    status = null,
}: {
    username: string;
    uri?: string | null;
    size?: number;
    status?: "online" | "ingame" | "offline" | null;
}) {
    return <UiAvatar name={username} uri={uri} size={size} status={status} />;
}

export default function FriendsScreen() {
    const router = useRouter();
    const backgroundImage = require("../../assets/images/background.jpg");

    const [account, setAccount] = useState<AccountType | null>(null);
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
    const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

    const [friends, setFriends] = useState<FriendWithStatus[]>([]);
    const [requests, setRequests] = useState<FriendEntry[]>([]);
    const [outgoing, setOutgoing] = useState<FriendEntry[]>([]);

    const loadData = useCallback(async () => {
        const acc = await getCurrentAccount();
        setAccount(acc);

        if (!acc || acc.guest || !acc.authId) {
            setLoading(false);
            return;
        }

        const [friendList, requestList, sentList] = await Promise.all([
            getFriends(),
            getIncomingRequests(),
            getOutgoingRequests(),
        ]);

        setFriends((prev) =>
            friendList.map((f) => {
                const known = prev.find((p) => p.profile.id === f.profile.id);
                return { ...f, online: known?.online ?? false, inGame: known?.inGame ?? false };
            })
        );
        setRequests(requestList);
        setOutgoing(sentList);
        setLoading(false);

        const authIds = friendList.map((f) => f.profile.id).filter(Boolean);
        if (authIds.length > 0) getSocket().emit("check_friends_online", { authIds });
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Who is online / in a game. The answer arrives as an event; the list is
    // asked for again every 15 seconds while the screen is open.
    useEffect(() => {
        const socket = getSocket();

        const handleStatus = (data: any) => {
            const online: string[] = Array.isArray(data?.online) ? data.online : [];
            const inGame: string[] = Array.isArray(data?.inGame) ? data.inGame : [];

            setFriends((prev) =>
                prev.map((f) => ({
                    ...f,
                    online: online.includes(f.profile.id),
                    inGame: inGame.includes(f.profile.id),
                }))
            );
        };

        // A new request or an accepted one: load the lists again.
        const reload = () => {
            loadData();
        };

        socket.on("friends_online_status", handleStatus);
        socket.on("friend_request_received", reload);
        socket.on("friend_request_accepted", reload);

        const interval = setInterval(() => {
            setFriends((current) => {
                const authIds = current.map((f) => f.profile.id).filter(Boolean);
                if (authIds.length > 0) socket.emit("check_friends_online", { authIds });
                return current;
            });
        }, 15000);

        return () => {
            clearInterval(interval);
            socket.off("friends_online_status", handleStatus);
            socket.off("friend_request_received", reload);
            socket.off("friend_request_accepted", reload);
        };
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
            log("SEARCH ERROR:", error);
        } finally {
            setSearching(false);
        }
    }

    async function handleAddFriend(userId: string) {
        try {
            await sendFriendRequest(userId);
            setSentRequests((prev) => new Set(prev).add(userId));

            // Lets the other player see the request right away.
            getSocket().emit("friend_request_sent", { targetAuthId: userId });
            getOutgoingRequests().then(setOutgoing).catch(() => undefined);
        } catch (error: any) {
            log("ADD FRIEND ERROR:", error?.message || error);
        }
    }

    async function handleAccept(friendshipId: string, userId: string) {
        try {
            await acceptFriendRequest(friendshipId);
            getSocket().emit("friend_request_accepted", { targetAuthId: userId });
            await loadData();
        } catch (error) {
            log("ACCEPT ERROR:", error);
        }
    }

    async function handleDecline(friendshipId: string) {
        try {
            await declineFriendRequest(friendshipId);
            setRequests((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
        } catch (error) {
            log("DECLINE ERROR:", error);
        }
    }

    async function handleCancelRequest(friendshipId: string) {
        try {
            await cancelFriendRequest(friendshipId);
            setOutgoing((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
        } catch (error) {
            log("CANCEL REQUEST ERROR:", error);
        }
    }

    function handleRemoveFriend(friendshipId: string, username: string) {
        const remove = async () => {
            try {
                await removeFriend(friendshipId);
                setFriends((prev) => prev.filter((f) => f.friendshipId !== friendshipId));
            } catch (error) {
                log("REMOVE FRIEND ERROR:", error);
            }
        };

        const message = `Remove ${username} from your friends?`;

        if (Platform.OS === "web") {
            if (typeof window !== "undefined" && window.confirm(message)) remove();
            return;
        }

        Alert.alert(tr("Remove friend"), message, [
            { text: tr("Cancel"), style: "cancel" },
            { text: tr("Remove"), style: "destructive", onPress: remove },
        ]);
    }

    function handleChallenge(friend: FriendWithStatus) {
        startChallenge({
            id: friend.profile.id,
            username: friend.profile.username,
            avatar: friend.profile.avatar,
            rating: friend.profile.rating,
        });
    }

    // Online friends first, then by name.
    const sortedFriends = friends.slice().sort((a, b) => {
        const presence = Number(b.online) - Number(a.online);
        if (presence !== 0) return presence;
        return a.profile.username.localeCompare(b.profile.username);
    });

    const onlineCount = friends.filter((f) => f.online).length;

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
                    <Text style={styles.title}>{tr("Friends")}</Text>
                    <Text style={styles.status}>
                        {tr("Sign in with an account to add friends. The friends system is not available for guests.")}
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

    <Text style={styles.headerTitle}>{tr("Friends")}</Text>

    <View style={{ width: 42 }} />
</View>

<View style={styles.headerRow}>
    <Text style={styles.title}>{friends.length === 1 ? tr("1 friend") : tr("{0} friends", friends.length)}</Text>

    {requests.length > 0 && (
        <View style={styles.requestPill}>
            <Text style={styles.requestPillText}>
                {requests.length === 1 ? tr("1 request") : tr("{0} requests", requests.length)}
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
                            placeholder={tr("Search username")}
                            placeholderTextColor="rgba(237,240,243,0.4)"
                            style={styles.input}
                            autoCapitalize="none"
                        />
                    </View>

                    {searching && <ActivityIndicator style={{ marginTop: 12 }} color="#EDF0F3" />}

                    {searchResults.map((user) => {
                        const alreadySent =
                            sentRequests.has(user.id) || outgoing.some((r) => r.profile.id === user.id);
                        const alreadyFriend = friends.some((f) => f.profile.id === user.id);

                        return (
                            <View key={user.id} style={styles.searchRow}>
                                <Pressable
                                    style={styles.personTap}
                                    onPress={() => goToProfile(user.id, user.username, user.avatar ?? undefined, user.rating)}
                                    hitSlop={6}
                                >
                                    <Avatar username={user.username} uri={user.avatar} size={36} />
                                    <Text style={styles.name}>{user.username}</Text>
                                </Pressable>

                                <Pressable
                                    style={[styles.smallButton, (alreadySent || alreadyFriend) && styles.smallButtonDisabled]}
                                    disabled={alreadySent || alreadyFriend}
                                    onPress={() => handleAddFriend(user.id)}
                                >
                                    <Text style={styles.buttonText}>
                                        {alreadyFriend ? tr("Friends") : alreadySent ? tr("Requested") : tr("Add")}
                                    </Text>
                                </Pressable>
                            </View>
                        );
                    })}
                </View>

                {/* REQUESTS */}
                {requests.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>{tr("Requests")}</Text>

                        {requests.map((r) => (
                            <View key={r.friendshipId} style={styles.cardRow}>
                                <Pressable
                                    style={styles.personTap}
                                    onPress={() => goToProfile(r.profile.id, r.profile.username, r.profile.avatar ?? undefined, r.profile.rating)}
                                    hitSlop={6}
                                >
                                    <Avatar username={r.profile.username} uri={r.profile.avatar} />
                                    <View>
                                        <Text style={styles.name}>{r.profile.username}</Text>
                                        <Text style={styles.statusInline}>
                                            {r.profile.rating != null ? tr("{0} Elo", r.profile.rating) : tr("Friend request")}
                                        </Text>
                                    </View>
                                </Pressable>

                                <View style={{ flexDirection: "row", gap: 10 }}>
                                    <Pressable style={styles.acceptBtn} onPress={() => handleAccept(r.friendshipId, r.profile.id)}>
                                        <Text style={styles.acceptText}>{tr("Accept")}</Text>
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
                <Text style={styles.sectionTitle}>
                    {tr("Your friends")}{friends.length > 0 ? tr(" · {0} online", onlineCount) : ""}
                </Text>

                {friends.length === 0 && (
                    <View style={styles.emptyCard}>
                        <View style={styles.emptyIconWrap}>
                            <Icon name="person" size={22} color="#5B8DB8" />
                        </View>
                        <Text style={styles.emptyTitle}>{tr("No friends yet")}</Text>
                        <Text style={styles.status}>
                            {tr("Search for a username above to add your first friend.")}
                        </Text>
                    </View>
                )}

                {sortedFriends.map((f) => {
                    const status = f.inGame ? "ingame" : f.online ? "online" : "offline";

                    return (
                        <View key={f.friendshipId} style={styles.cardRow}>
                            <Pressable
                                style={styles.personTap}
                                onPress={() => goToProfile(f.profile.id, f.profile.username, f.profile.avatar ?? undefined, f.profile.rating)}
                                hitSlop={6}
                            >
                                <Avatar username={f.profile.username} uri={f.profile.avatar} status={status} />

                                <View style={{ flexShrink: 1 }}>
                                    <Text style={styles.name} numberOfLines={1}>{f.profile.username}</Text>
                                    <Text
                                        style={[
                                            styles.statusInline,
                                            status === "online" && { color: "#4ADE80" },
                                            status === "ingame" && { color: "#F5B544" },
                                        ]}
                                    >
                                        {status === "ingame" ? tr("In a game") : status === "online" ? tr("Online") : tr("Offline")}
                                        {f.profile.rating != null ? tr(" · {0} Elo", f.profile.rating) : ""}
                                    </Text>
                                </View>
                            </Pressable>

                            <View style={styles.rowActions}>
                                {f.online && !f.inGame && (
                                    <Pressable style={styles.playBtn} onPress={() => handleChallenge(f)}>
                                        <Text style={styles.playText}>{tr("Play")}</Text>
                                    </Pressable>
                                )}
                                <Pressable onPress={() => handleRemoveFriend(f.friendshipId, f.profile.username)} hitSlop={8}>
                                    <Text style={styles.declineText}>✕</Text>
                                </Pressable>
                            </View>
                        </View>
                    );
                })}

                {/* SENT REQUESTS */}
                {outgoing.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>{tr("Sent requests")}</Text>

                        {outgoing.map((r) => (
                            <View key={r.friendshipId} style={styles.cardRow}>
                                <Pressable
                                    style={styles.personTap}
                                    onPress={() => goToProfile(r.profile.id, r.profile.username, r.profile.avatar ?? undefined, r.profile.rating)}
                                    hitSlop={6}
                                >
                                    <Avatar username={r.profile.username} uri={r.profile.avatar} />
                                    <View>
                                        <Text style={styles.name}>{r.profile.username}</Text>
                                        <Text style={styles.statusInline}>{tr("Waiting for an answer")}</Text>
                                    </View>
                                </Pressable>

                                <Pressable style={styles.smallButton} onPress={() => handleCancelRequest(r.friendshipId)}>
                                    <Text style={styles.buttonText}>{tr("Cancel")}</Text>
                                </Pressable>
                            </View>
                        ))}
                    </>
                )}

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

    personTap: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1, flex: 1 },

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

    rowActions: { flexDirection: "row", alignItems: "center", gap: 14 },
    playBtn: { backgroundColor: "#5B8DB8", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
    playText: { color: "#FFFFFF", fontWeight: "800", fontSize: 12.5 },

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