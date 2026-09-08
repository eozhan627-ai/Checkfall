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

export default function FriendsScreen() {
    const backgroundImage = require("../../assets/images/socialbackground.png");

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

        const [friendList, requestList] = await Promise.all([
            getFriends(),
            getIncomingRequests(),
        ]);

        setFriends(friendList.map((f) => ({ ...f, online: false })));
        setRequests(requestList);
        setLoading(false);

        const authIds = friendList.map((f) => f.profile.id).filter(Boolean);
        if (authIds.length === 0) return;

        const socket = getSocket();

        const handleStatus = (data: any) => {
            const online: string[] = Array.isArray(data?.online) ? data.online : [];

            setFriends((prev) =>
                prev.map((f) => ({
                    ...f,
                    online: online.includes(f.profile.id),
                }))
            );
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

    if (loading) {
        return (
            <ImageBackground source={backgroundImage} style={{ flex: 1 }}>
                <View style={styles.center}>
                    <ActivityIndicator color="#fff" />
                </View>
            </ImageBackground>
        );
    }

    if (!account || account.guest || !account.authId) {
        return (
            <ImageBackground source={backgroundImage} style={{ flex: 1 }}>
                <View style={styles.center}>
                    <Text style={styles.title}>Freunde</Text>
                    <Text style={styles.status}>
                        Melde dich mit einem Account an, um Freunde hinzuzufügen.
                        Als Gast ist das Freundessystem nicht verfügbar.
                    </Text>
                </View>
            </ImageBackground>
        );
    }

    return (
        <ImageBackground source={backgroundImage} style={{ flex: 1 }}>
            <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
                <Text style={styles.title}>Freunde</Text>

                {/* SEARCH */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Freund hinzufügen</Text>

                    <TextInput
                        value={search}
                        onChangeText={handleSearch}
                        placeholder="Username suchen"
                        placeholderTextColor="#aaa"
                        style={styles.input}
                        autoCapitalize="none"
                    />

                    {searching && (
                        <ActivityIndicator style={{ marginTop: 10 }} color="#fff" />
                    )}

                    {searchResults.map((user) => {
                        const alreadySent = sentRequests.has(user.id);
                        const alreadyFriend = friends.some(
                            (f) => f.profile.id === user.id
                        );

                        return (
                            <View key={user.id} style={styles.searchRow}>
                                <Text style={styles.name}>{user.username}</Text>

                                <Pressable
                                    style={[
                                        styles.smallButton,
                                        (alreadySent || alreadyFriend) &&
                                            styles.smallButtonDisabled,
                                    ]}
                                    disabled={alreadySent || alreadyFriend}
                                    onPress={() => handleAddFriend(user.id)}
                                >
                                    <Text style={styles.buttonText}>
                                        {alreadyFriend
                                            ? "Befreundet"
                                            : alreadySent
                                                ? "Angefragt"
                                                : "Hinzufügen"}
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
                                <Text style={styles.name}>{r.profile.username}</Text>

                                <View style={{ flexDirection: "row", gap: 10 }}>
                                    <Pressable onPress={() => handleAccept(r.friendshipId)}>
                                        <Text style={styles.accept}>✔</Text>
                                    </Pressable>

                                    <Pressable onPress={() => handleDecline(r.friendshipId)}>
                                        <Text style={styles.decline}>✖</Text>
                                    </Pressable>
                                </View>
                            </View>
                        ))}
                    </>
                )}

                {/* FRIENDS */}
                <Text style={styles.sectionTitle}>Freunde</Text>

                {friends.length === 0 && (
                    <Text style={styles.status}>Noch keine Freunde hinzugefügt.</Text>
                )}

                {friends.map((f) => (
                    <View key={f.friendshipId} style={styles.cardRow}>
                        <View>
                            <Text style={styles.name}>{f.profile.username}</Text>
                            <Text style={styles.statusInline}>
                                {f.online ? "🟢 Online " : "⚪ Offline "}
                            </Text>
                        </View>

                        <Pressable onPress={() => handleRemoveFriend(f.friendshipId)}>
                            <Text style={styles.decline}>✖</Text>
                        </Pressable>
                    </View>
                ))}
            </ScrollView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
    },

    title: {
        fontSize: 26,
        fontWeight: "700",
        color: "#fff",
        marginBottom: 20,
        marginTop: 20,
        textAlign: "center",
    },

    sectionTitle: {
        fontSize: 16,
        color: "#d4d4d4",
        marginTop: 20,
        marginBottom: 10,
    },

    card: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 16,
    },

    cardRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",

        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 16,
        marginBottom: 10,
    },

    searchRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 12,
    },

    name: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },

    status: {
        color: "#d4d4d4",
        marginTop: 8,
        textAlign: "center",
        lineHeight: 20,
    },

    statusInline: {
        color: "#d4d4d4",
        marginTop: 4,
    },

    input: {
        backgroundColor: "rgba(255,255,255,0.12)",
        borderRadius: 10,
        padding: 10,
        color: "#fff",
        marginTop: 10,
    },

    smallButton: {
        backgroundColor: "#1f2937",
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
    },

    smallButtonDisabled: {
        opacity: 0.5,
    },

    buttonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 13,
    },

    accept: {
        fontSize: 22,
        color: "#22c55e",
    },

    decline: {
        fontSize: 22,
        color: "#ef4444",
    },
});
