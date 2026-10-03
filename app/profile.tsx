import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import ImageBackground from "../components/ui/ImageBackground";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ClanBadge, { LeaguePill } from "../components/clans/ClanBadge";
import ProfileAvatar from "../components/ProfileAvatar";
import VipBadge from "../components/VipBadge";
import { T } from "../components/ui/theme";
import {
    AccountType,
    getCurrentAccount,
    logoutAccount,
    updateAccount,
} from "../lib/account";
import { uploadAvatar } from "../lib/api";
import { startChallenge } from "../lib/challenges";
import { clanErrorText, joinClan, JOIN_TYPE_LABEL } from "../lib/clans";
import {
    acceptFriendRequest,
    getFriendshipStatusWith,
    getIncomingRequests,
    sendFriendRequest,
} from "../lib/friends";
import { log } from "../lib/log";
import { getPlayerCard, PlayerCard, presenceText } from "../lib/players";
import { getRewards, levelFromXp } from "../lib/puzzleRewards";
import { getSolvedPuzzleCount } from "../lib/puzzleStats";
import { getSocket } from "../lib/socket";
import { supabase } from "../lib/supabase";
import { tr } from "../lib/i18n";

const DONATION_URL = "https://paypal.me/businessacc263";

type FriendStatus = "none" | "pending_sent" | "pending_received" | "friends";

// Alert.alert without/with buttons does not work reliably on the web.
function showMessage(title: string, message: string) {
    if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
            window.alert(`${title}\n\n${message}`);
        }
        return;
    }
    Alert.alert(title, message);
}

export default function Profile() {
    const insets = useSafeAreaInsets();

    const [account, setAccount] = useState<AccountType | null>(null);
    const [username, setUsername] = useState("");
    const [editingName, setEditingName] = useState(false);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        games: 0,
        wins: 0,
        puzzles: 0,
        rating: 1000,
    });

    // Clan, online status and VIP tier (from the game server).
    const [card, setCard] = useState<PlayerCard | null>(null);
    // The viewer's own clan - decides whether "Join" is offered.
    const [viewerClanId, setViewerClanId] = useState<string | null>(null);
    const [viewer, setViewer] = useState<AccountType | null>(null);
    const [friendStatus, setFriendStatus] = useState<FriendStatus>("none");
    const [busy, setBusy] = useState<"friend" | "clan" | null>(null);
    const [joinNote, setJoinNote] = useState<string | null>(null);
    const [xp, setXp] = useState(0);

    const params = useLocalSearchParams();
    const externalName = params.name as string | undefined;
    const externalAvatar = params.avatar as string | undefined;
    const externalUserId = params.userId as string | undefined;
    const externalRating = params.rating as string | undefined;
    const isForeignProfile = !!externalUserId;

    const backgroundImage = require("../assets/images/profilebackground.jpg");
    const isVip =
        !isForeignProfile && !!account?.vipTier && account.vipTier !== "none";

    // Runs every time the screen opens, so e.g. newly solved puzzles count right away.
    useFocusEffect(
        useCallback(() => {
            let alive = true;

            if (isForeignProfile) {
                (async () => {
                    const me = await getCurrentAccount();
                    if (!alive) return;
                    setViewer(me);

                    const signedIn = !!me?.authId && !me.guest;

                    const [playerCard, status, myCard] = await Promise.all([
                        getPlayerCard(externalUserId as string),
                        signedIn ? getFriendshipStatusWith(externalUserId as string) : Promise.resolve("none" as FriendStatus),
                        signedIn ? getPlayerCard(me!.authId as string) : Promise.resolve(null),
                    ]);

                    if (!alive) return;

                    setCard(playerCard);
                    setFriendStatus(status);
                    setViewerClanId(myCard?.clan?.id ?? null);

                    setStats({
                        games: playerCard?.profile.games_played ?? 0,
                        wins: playerCard?.profile.wins ?? 0,
                        puzzles: playerCard?.profile.puzzles_solved ?? 0,
                        rating:
                            playerCard?.profile.rating ??
                            (externalRating ? Number(externalRating) || 1000 : 1000),
                    });
                    setLoading(false);
                })();

                return () => {
                    alive = false;
                };
            }

            (async () => {
                const acc = await getCurrentAccount();
                if (acc) {
                    setAccount(acc);
                    setViewer(acc);
                    setUsername((prev) => prev || acc.username);

                    const puzzles = await getSolvedPuzzleCount();
                    getRewards().then((r) => alive && setXp(r.xp));

                    // Guests: games and wins are counted from the history
                    // stored on this device.
                    const storedHistory = await AsyncStorage.getItem("game_history");
                    const history = storedHistory ? JSON.parse(storedHistory) : [];
                    const onlineGames = history.filter(
                        (game: any) => game.mode === "online"
                    );

                    let games = onlineGames.length;
                    let wins = onlineGames.filter(
                        (game: any) => game.result === "win"
                    ).length;

                    // Signed-in players: games and wins are counted by the
                    // game server, so they are the same on every device and
                    // cannot be edited from the app.
                    if (acc.authId && !acc.guest) {
                        const { data, error } = await supabase
                            .from("profiles")
                            .select("games_played, wins")
                            .eq("id", acc.authId)
                            .maybeSingle();

                        if (error) log("OWN STATS ERROR:", error);

                        if (data) {
                            games = data.games_played ?? 0;
                            wins = data.wins ?? 0;
                        }

                        // The puzzle count is still tracked on the device and
                        // shared so friends can see it.
                        const { error: puzzleError } = await supabase
                            .from("profiles")
                            .update({ puzzles_solved: puzzles })
                            .eq("id", acc.authId);

                        if (puzzleError) log("PUZZLE COUNT SYNC ERROR:", puzzleError);

                        // Clan (shown as a card below the statistics).
                        getPlayerCard(acc.authId).then((own) => alive && setCard(own));
                    }

                    if (!alive) return;

                    setStats({
                        games,
                        wins,
                        puzzles,
                        rating: acc.rating ?? 1000,
                    });
                }
                if (alive) setLoading(false);
            })();

            return () => {
                alive = false;
            };
        }, [isForeignProfile, externalRating, externalUserId])
    );

    // =============================
    // OTHER PLAYERS: FRIEND / CHALLENGE / CLAN
    // =============================
    const viewerSignedIn = !!viewer?.authId && !viewer.guest;

    const handleFriend = async () => {
        if (!externalUserId || busy) return;

        if (!viewerSignedIn) {
            showMessage(tr("Account required"), tr("Sign in to add friends."));
            return;
        }

        setBusy("friend");

        try {
            if (friendStatus === "none") {
                await sendFriendRequest(externalUserId);
                getSocket().emit("friend_request_sent", { targetAuthId: externalUserId });
                setFriendStatus("pending_sent");
            } else if (friendStatus === "pending_received") {
                const incoming = await getIncomingRequests();
                const request = incoming.find((entry) => entry.profile.id === externalUserId);

                if (request) {
                    await acceptFriendRequest(request.friendshipId);
                    getSocket().emit("friend_request_accepted", { targetAuthId: externalUserId });
                    setFriendStatus("friends");
                }
            }
        } catch (error: any) {
            showMessage(tr("Friends"), error?.message || tr("That did not work. Please try again."));
        }

        setBusy(null);
    };

    const handleChallenge = () => {
        if (!externalUserId) return;

        startChallenge({
            id: externalUserId,
            username: card?.profile.username || externalName || tr("Player"),
            avatar: card?.profile.avatar || externalAvatar || "",
            rating: stats.rating,
        });
    };

    const handleJoinClan = async () => {
        if (!card?.clan || busy) return;

        setBusy("clan");

        try {
            const result = await joinClan(getSocket(), card.clan.id);

            if (result.requested) {
                setJoinNote(tr("Request sent. The clan's leader or an admin decides."));
            } else {
                setViewerClanId(card.clan.id);
                setJoinNote(tr("You are now a member of this clan."));
            }
        } catch (error: any) {
            setJoinNote(clanErrorText(error?.message));
        }

        setBusy(null);
    };

    const changeAvatar = async () => {
        if (!account?.id) return;

        // The server stores the picture under the signed-in user's id, so
        // guests cannot upload one.
        if (account.guest || !account.authId) {
            showMessage(
                tr("Account required"),
                tr("Sign in to set a profile picture.")
            );
            return;
        }

        const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== "granted") {
            showMessage(
                tr("Permission required"),
                tr("Please allow access to your photos.")
            );
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (result.canceled) return;

        const asset = result.assets[0];
        const formData = new FormData();

        if (Platform.OS === "web") {
            // Auf Web ist asset.uri eine blob:/data:-URL. Ein Objekt mit
            // {uri,type,name} wie auf Native wird hier nicht akzeptiert,
            // deshalb die echte Datei als Blob anhängen.
            const blob = await (await fetch(asset.uri)).blob();
            formData.append(
                "avatar",
                blob,
                asset.fileName || "avatar.jpg"
            );
        } else {
            formData.append("avatar", {
                uri: asset.uri,
                type: asset.mimeType || "image/jpeg",
                name: asset.fileName || "avatar.jpg",
            } as any);
        }

        try {
            const url = await uploadAvatar(formData);

            const updated = await updateAccount(account.id, {
                avatar: url,
            });
            if (updated) {
                setAccount(updated);
            }
        } catch (error) {
            log("AVATAR ERROR:", error);
            showMessage(
                tr("Error"),
                tr("The profile picture could not be saved.")
            );
        }
    };

    const openDonation = async () => {
        try {
            const supported = await Linking.canOpenURL(DONATION_URL);
            if (supported) {
                await Linking.openURL(DONATION_URL);
            } else {
                showMessage(tr("Error"), tr("The link could not be opened."));
            }
        } catch (error) {
            log("DONATION LINK ERROR:", error);
            showMessage(tr("Error"), tr("The link could not be opened."));
        }
    };

    const saveUsername = async () => {
        if (!account || !username.trim()) return;

        const updated = await updateAccount(account.id, {
            username: username.trim(),
        });
        if (updated) {
            setAccount(updated);
        }
        setEditingName(false);
    };

    // =============================
    // LOGOUT
    // =============================
    const performLogout = async () => {
        try {
            // beendet die Supabase-Session und entfernt @current_account
            await logoutAccount();
        } catch (error) {
            console.error("LOGOUT ERROR:", error);
        }

        if (Platform.OS === "web" && typeof window !== "undefined") {
            // Harter Reload, damit kein alter Zustand im Speicher bleibt
            window.location.replace("/auth/login");
        } else {
            router.replace("/auth/login");
        }
    };

    const logout = () => {
        // Alert.alert mit Buttons zeigt auf Web/iPad-Safari nichts an,
        // deshalb dort window.confirm.
        if (Platform.OS === "web") {
            if (
                typeof window !== "undefined" &&
                window.confirm(tr("Do you really want to sign out?"))
            ) {
                performLogout();
            }
            return;
        }

        Alert.alert(tr("Sign out"), tr("Do you really want to sign out?"), [
            { text: tr("Cancel"), style: "cancel" },
            {
                text: tr("Sign out"),
                style: "destructive",
                onPress: performLogout,
            },
        ]);
    };

    if (loading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator color={T.text} />
            </View>
        );
    }

    const displayedName = isForeignProfile
        ? card?.profile.username || externalName || tr("Player")
        : account?.username || tr("Player");
    const avatarUri =
        (isForeignProfile ? card?.profile.avatar || externalAvatar : account?.avatar) || "";

    const tier = isForeignProfile ? card?.profile.vip_tier ?? "none" : account?.vipTier ?? "none";
    const frame = tier === "diamond" ? "diamond" : tier === "gold" ? "gold" : "silver";

    const winRate = stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : null;
    const { level, progress: levelProgress } = levelFromXp(xp);

    const clan = card?.clan ?? null;
    const sameClan = !!clan && viewerClanId === clan.id;
    const canChallenge = isForeignProfile && viewerSignedIn && (friendStatus === "friends" || sameClan);
    const available = !!card?.online && !card.inGame;

    const viewerRating = viewer?.rating ?? 1000;
    const joinBlocked = !clan
        ? null
        : clan.member_count >= clan.max_members
            ? tr("Clan is full")
            : clan.join_type === "closed"
                ? tr("Invite only")
                : viewerRating < clan.min_rating
                    ? tr("Needs {0} Elo", clan.min_rating)
                    : null;

    const friendLabel =
        friendStatus === "friends"
            ? tr("Friends")
            : friendStatus === "pending_sent"
                ? tr("Request sent")
                : friendStatus === "pending_received"
                    ? tr("Accept request")
                    : tr("Add friend");

    const openClan = () => {
        if (!clan) return;
        router.push({ pathname: "/clans", params: { clanId: clan.id } } as any);
    };

    return (
        <ImageBackground
            source={backgroundImage}
            style={styles.background}
            resizeMode="cover"
        >
            <View style={styles.scrim} />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 40 }]}
                keyboardShouldPersistTaps="handled"
            >
                {/* HEADER */}
                <View style={styles.header}>
                    <Pressable
                        onPress={() => router.back()}
                        style={styles.backButton}
                        accessibilityLabel={tr("Back")}
                        hitSlop={8}
                    >
                        <Ionicons name="chevron-back" size={20} color={T.text} />
                    </Pressable>
                    <Text style={styles.headerTitle}>{isForeignProfile ? tr("Player") : tr("Profile")}</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* HERO */}
                <View style={styles.hero}>
                    <TouchableOpacity
                        disabled={isForeignProfile}
                        onPress={changeAvatar}
                        accessibilityLabel={isForeignProfile ? undefined : tr("Change profile picture")}
                    >
                        <ProfileAvatar uri={avatarUri} frame={frame} size={132} />
                        {!isForeignProfile && (
                            <View style={styles.cameraBadge}>
                                <Ionicons name="camera" size={14} color="#FFFFFF" />
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* NAME */}
                    {isForeignProfile ? (
                        <Text style={[styles.username, { marginTop: 34 }]}>{displayedName}</Text>
                    ) : editingName ? (
                        <View style={styles.editNameRow}>
                            <TextInput
                                value={username}
                                onChangeText={setUsername}
                                autoFocus
                                maxLength={20}
                                style={styles.usernameInput}
                                placeholder={tr("Username")}
                                placeholderTextColor="#777"
                                onSubmitEditing={saveUsername}
                            />
                            <Pressable onPress={saveUsername} style={styles.saveButton} accessibilityLabel={tr("Save name")}>
                                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                            </Pressable>
                        </View>
                    ) : (
                        <Pressable onPress={() => setEditingName(true)} style={styles.nameRow} hitSlop={6}>
                            <Text style={styles.username}>{displayedName}</Text>
                            <Ionicons name="pencil" size={15} color={T.textFaint} />
                        </Pressable>
                    )}

                    <View style={styles.pills}>
                        {tier !== "none" && <VipBadge tier={tier as "silver" | "gold" | "diamond"} />}

                        {isForeignProfile && card && (
                            <View style={styles.statusPill}>
                                <View
                                    style={[
                                        styles.statusDot,
                                        { backgroundColor: card.inGame ? "#E8B93E" : card.online ? "#4ADE80" : "#6B7580" },
                                    ]}
                                />
                                <Text style={styles.statusText}>
                                    {presenceText({ ...card, lastSeenAt: card.profile.last_seen_at })}
                                </Text>
                            </View>
                        )}

                        {clan && (
                            <Pressable onPress={openClan} style={styles.clanPill} hitSlop={4}>
                                <Text style={styles.clanPillText} numberOfLines={1}>
                                    {clan.tag ? `[${clan.tag}] ` : ""}
                                    {clan.name}
                                </Text>
                            </Pressable>
                        )}
                    </View>
                </View>

                {/* ACTIONS FOR ANOTHER PLAYER */}
                {isForeignProfile && (
                    <View style={styles.actionRow}>
                        <Pressable
                            onPress={handleFriend}
                            disabled={busy === "friend" || friendStatus === "friends" || friendStatus === "pending_sent"}
                            style={({ pressed }) => [
                                styles.actionButton,
                                friendStatus === "none" || friendStatus === "pending_received" ? styles.actionPrimary : styles.actionDone,
                                pressed && styles.pressed,
                            ]}
                        >
                            <Ionicons
                                name={friendStatus === "friends" ? "checkmark-circle" : friendStatus === "pending_sent" ? "time-outline" : "person-add"}
                                size={16}
                                color="#FFFFFF"
                            />
                            <Text style={styles.actionButtonText}>{friendLabel}</Text>
                        </Pressable>

                        {canChallenge && (
                            <Pressable
                                onPress={handleChallenge}
                                disabled={!available}
                                style={({ pressed }) => [
                                    styles.actionButton,
                                    styles.actionSecondary,
                                    !available && styles.disabled,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <Ionicons name="flash" size={16} color={T.text} />
                                <Text style={styles.actionButtonText}>
                                    {card?.inGame ? tr("In a game") : card?.online ? tr("Challenge") : tr("Offline")}
                                </Text>
                            </Pressable>
                        )}
                    </View>
                )}

                {isForeignProfile && viewerSignedIn && !canChallenge && (
                    <Text style={styles.hint}>{tr("Become friends or join the same clan to challenge this player.")}</Text>
                )}

                {/* RATING */}
                <View style={styles.ratingCard}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.smallLabel}>{tr("CHESS RATING")}</Text>
                        <Text style={styles.rating}>{stats.rating}</Text>
                    </View>

                    {!isForeignProfile && (
                        <View style={styles.levelBox}>
                            <Text style={styles.levelText}>{tr("Level")} {level}</Text>
                            <View style={styles.levelTrack}>
                                <View style={[styles.levelFill, { width: `${Math.max(4, levelProgress * 100)}%` }]} />
                            </View>
                            <Text style={styles.levelXp}>{xp} {tr("XP")}</Text>
                        </View>
                    )}
                </View>

                {/* STATS */}
                <View style={styles.statsGrid}>
                    <Stat value={String(stats.games)} label={tr("Games")} />
                    <Stat value={String(stats.wins)} label={tr("Wins")} />
                    <Stat value={winRate === null ? "–" : `${winRate}%`} label={tr("Win rate")} />
                    <Stat value={String(stats.puzzles)} label={tr("Puzzles")} />
                </View>

                {/* CLAN */}
                {clan ? (
                    <Pressable onPress={openClan} style={({ pressed }) => [styles.card, styles.clanCard, pressed && styles.pressed]}>
                        <View style={styles.clanTop}>
                            <ClanBadge badge={clan.badge} color={clan.badge_color} size={50} />

                            <View style={{ flex: 1 }}>
                                <Text style={styles.clanName} numberOfLines={1}>
                                    {clan.name}
                                    {clan.tag ? <Text style={styles.clanTag}>  [{clan.tag}]</Text> : null}
                                </Text>
                                <View style={styles.clanMeta}>
                                    <LeaguePill league={clan.league} />
                                    <Text style={styles.clanMetaText}>
                                        {clan.member_count}/{clan.max_members} · {clan.clan_rating} {tr("Elo")}
                                    </Text>
                                </View>
                            </View>

                            <Ionicons name="chevron-forward" size={18} color={T.textFaint} />
                        </View>

                        {isForeignProfile && viewerSignedIn && !viewerClanId && (
                            <Pressable
                                onPress={handleJoinClan}
                                disabled={!!joinBlocked || busy === "clan" || !!joinNote}
                                style={({ pressed }) => [
                                    styles.joinButton,
                                    (!!joinBlocked || !!joinNote) && styles.disabled,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <Text style={styles.joinButtonText}>
                                    {joinBlocked ?? (clan.join_type === "request" ? tr("Ask to join this clan") : tr("Join this clan"))}
                                </Text>
                            </Pressable>
                        )}

                        {isForeignProfile && sameClan && !joinNote && (
                            <Text style={styles.clanNote}>{tr("You are in the same clan.")}</Text>
                        )}
                        {joinNote && <Text style={styles.clanNote}>{joinNote}</Text>}
                        {isForeignProfile && !viewerClanId && !joinNote && (
                            <Text style={styles.clanNote}>{JOIN_TYPE_LABEL[clan.join_type]}</Text>
                        )}
                    </Pressable>
                ) : (
                    !isForeignProfile &&
                    !account?.guest && (
                        <Pressable onPress={() => router.push("/clans")} style={({ pressed }) => [styles.card, styles.clanCard, pressed && styles.pressed]}>
                            <View style={styles.clanTop}>
                                <View style={styles.emptyClanIcon}>
                                    <Ionicons name="shield-outline" size={22} color={T.accent} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.clanName}>{tr("No clan yet")}</Text>
                                    <Text style={styles.clanMetaText}>{tr("Join a clan or found your own")}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={T.textFaint} />
                            </View>
                        </Pressable>
                    )
                )}

                {/* OWN ACCOUNT */}
                {!isForeignProfile && (
                    <>
                        <View style={styles.card}>
                            <ProfileAction
                                icon="diamond-outline"
                                title={isVip ? tr("Manage VIP subscription") : tr("Go Premium")}
                                subtitle={isVip ? tr("Change or cancel your plan") : tr("Analysis, coach, clans and more")}
                                onPress={() => router.push("/vip")}
                            />
                            <View style={styles.separator} />
                            <ProfileAction
                                icon="time-outline"
                                title={tr("Your games")}
                                subtitle={tr("History and game reviews")}
                                onPress={() => router.push("/Spielverlauf")}
                            />
                            <View style={styles.separator} />
                            <ProfileAction
                                icon="heart-outline"
                                title={tr("Support POVCheck")}
                                subtitle={tr("Help keep the app running")}
                                onPress={openDonation}
                            />
                        </View>

                        <Pressable style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]} onPress={logout}>
                            <Text style={styles.logoutText}>{tr("Sign out")}</Text>
                        </Pressable>
                    </>
                )}
            </ScrollView>
        </ImageBackground>
    );
}

function Stat({ value, label }: { value: string; label: string }) {
    return (
        <View style={styles.stat}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

function ProfileAction({
    icon,
    title,
    subtitle,
    onPress,
}: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    title: string;
    subtitle: string;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.65 }]}
        >
            <View style={styles.actionIcon}>
                <Ionicons name={icon} size={18} color="#EDF0F3" />
            </View>
            <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{title}</Text>
                <Text style={styles.actionSubtitle}>{subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={T.textFaint} />
        </Pressable>
    );
}

const CARD = {
    backgroundColor: "#1B2027",
    borderWidth: 1,
    borderColor: "rgba(237, 240, 243, 0.08)",
} as const;

const styles = StyleSheet.create({
    background: { flex: 1, backgroundColor: "#12151B" },
    // Darker towards the content so text stays readable on any picture.
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10, 12, 16, 0.62)" },
    loading: { flex: 1, backgroundColor: "#12151B", justifyContent: "center", alignItems: "center" },
    container: { paddingHorizontal: 20 },
    pressed: { opacity: 0.72 },
    disabled: { opacity: 0.45 },

    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
    backButton: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", ...CARD },
    headerTitle: { color: "rgba(237, 240, 243, 0.8)", fontSize: 15, fontWeight: "600" },

    hero: { alignItems: "center", paddingTop: 40, paddingBottom: 22 },
    cameraBadge: {
        position: "absolute",
        right: 8,
        bottom: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#5B8DB8",
        borderWidth: 2,
        borderColor: "#12151B",
    },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 34 },
    username: { color: "#F5F7F9", fontSize: 27, fontWeight: "700", letterSpacing: -0.5 },
    editNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 30 },
    usernameInput: {
        minWidth: 170,
        color: "#F5F7F9",
        fontSize: 23,
        fontWeight: "700",
        borderBottomWidth: 1,
        borderBottomColor: "#5B8DB8",
        paddingVertical: 4,
        textAlign: "center",
    },
    saveButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#5B8DB8", alignItems: "center", justifyContent: "center" },

    pills: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 12 },
    statusPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: "rgba(237, 240, 243, 0.06)",
        borderWidth: 1,
        borderColor: "rgba(237, 240, 243, 0.08)",
    },
    statusDot: { width: 7, height: 7, borderRadius: 3.5 },
    statusText: { color: "rgba(237, 240, 243, 0.7)", fontSize: 12, fontWeight: "600" },
    clanPill: {
        maxWidth: 220,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: "rgba(91, 141, 184, 0.16)",
        borderWidth: 1,
        borderColor: "rgba(91, 141, 184, 0.45)",
    },
    clanPillText: { color: "#CFE0EF", fontSize: 12, fontWeight: "700" },

    actionRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
    actionButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 13,
        borderRadius: 14,
    },
    actionPrimary: { backgroundColor: "#5B8DB8" },
    actionDone: { backgroundColor: "rgba(237, 240, 243, 0.08)" },
    actionSecondary: { ...CARD },
    actionButtonText: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "700" },
    hint: { color: T.textFaint, fontSize: 12.5, textAlign: "center", marginBottom: 14, marginTop: -4 },

    ratingCard: {
        ...CARD,
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 18,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
        borderColor: "rgba(91, 141, 184, 0.22)",
    },
    smallLabel: { color: "rgba(237, 240, 243, 0.45)", fontSize: 11, fontWeight: "700", letterSpacing: 1.1, marginBottom: 2 },
    rating: { color: "#F5F7F9", fontSize: 38, fontWeight: "700", letterSpacing: -1, fontVariant: ["tabular-nums"] },
    levelBox: { width: 120, alignItems: "flex-end" },
    levelText: { color: "#D4AF37", fontSize: 13, fontWeight: "700", marginBottom: 6 },
    levelTrack: { alignSelf: "stretch", height: 5, borderRadius: 3, backgroundColor: "rgba(237, 240, 243, 0.1)", overflow: "hidden" },
    levelFill: { height: 5, borderRadius: 3, backgroundColor: "#D4AF37" },
    levelXp: { color: T.textFaint, fontSize: 11.5, marginTop: 5 },

    statsGrid: { flexDirection: "row", gap: 8, marginBottom: 12 },
    stat: { flex: 1, ...CARD, borderRadius: 16, paddingVertical: 14, alignItems: "center" },
    statValue: { color: "#F5F7F9", fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] },
    statLabel: { color: "rgba(237, 240, 243, 0.5)", fontSize: 11.5, marginTop: 3 },

    card: { ...CARD, borderRadius: 20, paddingHorizontal: 16, marginBottom: 12 },
    clanCard: { paddingVertical: 14 },
    clanTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    clanName: { color: "#F2F4F6", fontSize: 16.5, fontWeight: "700" },
    clanTag: { color: T.textFaint, fontSize: 13, fontWeight: "600" },
    clanMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 },
    clanMetaText: { color: "rgba(237, 240, 243, 0.5)", fontSize: 12.5 },
    clanNote: { color: T.textFaint, fontSize: 12.5, marginTop: 10 },
    emptyClanIcon: {
        width: 50,
        height: 50,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(91, 141, 184, 0.14)",
    },
    joinButton: { marginTop: 14, paddingVertical: 12, borderRadius: 13, alignItems: "center", backgroundColor: "#5B8DB8" },
    joinButtonText: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "700" },

    action: { minHeight: 66, flexDirection: "row", alignItems: "center" },
    actionIcon: {
        width: 36,
        height: 36,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 13,
        backgroundColor: "rgba(237, 240, 243, 0.06)",
    },
    actionContent: { flex: 1 },
    actionTitle: { color: "#F2F4F6", fontSize: 15, fontWeight: "600" },
    actionSubtitle: { color: "rgba(237, 240, 243, 0.5)", fontSize: 12.5, marginTop: 2 },
    separator: { height: 1, backgroundColor: "rgba(237, 240, 243, 0.06)" },

    logoutButton: {
        height: 50,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: "rgba(217, 83, 79, 0.35)",
        backgroundColor: "rgba(217, 83, 79, 0.08)",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 4,
    },
    logoutText: { color: "#E5746F", fontSize: 14.5, fontWeight: "600" },
});
