import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import ImageBackground from "../../components/ui/ImageBackground";
import ClanBadge, { LeaguePill } from "../../components/clans/ClanBadge";
import ClanCard from "../../components/clans/ClanCard";
import Avatar from "../../components/ui/Avatar";
import { T } from "../../components/ui/theme";
import { AccountType, getCurrentAccount } from "../../lib/account";
import { startChallenge } from "../../lib/challenges";
import {
    cancelJoinRequest,
    CLAN_BADGE_COLORS,
    CLAN_BADGES,
    clanErrorText,
    ClanInviteType,
    ClanJoinRequestType,
    ClanJoinType,
    ClanMemberType,
    ClanMessageType,
    ClanRank,
    ClanType,
    createClan,
    demoteAdmin,
    getClanData,
    getClanPresence,
    getMyClan,
    getMyInvites,
    getMyJoinRequests,
    getSuggestedClans,
    inviteToClan,
    JOIN_TYPE_HINT,
    JOIN_TYPE_LABEL,
    joinClan,
    kickMember,
    CLAN_LEAGUES,
    LEAGUE_COLORS,
    leaveClan,
    listClans,
    onClanInviteReceived,
    onClanJoinRequestAnswered,
    onClanJoinRequestReceived,
    onClanLeaderChanged,
    onClanMemberDemoted,
    onClanMemberJoined,
    onClanMemberLeft,
    onClanMemberPromoted,
    onClanMessage,
    onClanPresence,
    onClanUpdated,
    onKickedFromClan,
    promoteMember,
    respondJoinRequest,
    respondToInvite,
    sendClanMessage,
    transferLeadership,
    updateClanSettings,
} from "../../lib/clans";
import { log } from "../../lib/log";
import { getSocket } from "../../lib/socket";
import { tr } from "../../lib/i18n";

const backgroundImage = require("../../assets/images/background.jpg");

const JOIN_TYPES: ClanJoinType[] = ["open", "request", "closed"];
const MIN_RATINGS = [0, 800, 1000, 1200, 1400, 1600, 1800];

type Tab = "members" | "chat" | "manage";

// Alert.alert with buttons does not work on the web build.
function confirm(title: string, message: string, actionLabel: string, onConfirm: () => void) {
    if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) onConfirm();
        return;
    }

    Alert.alert(title, message, [
        { text: tr("Cancel"), style: "cancel" },
        { text: actionLabel, style: "destructive", onPress: onConfirm },
    ]);
}

function notify(title: string, message: string) {
    if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.alert(`${title}\n\n${message}`);
        return;
    }
    Alert.alert(title, message);
}

function timeAgo(iso?: string | null): string | null {
    if (!iso) return null;

    const diff = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(diff) || diff < 0) return null;

    const minutes = Math.floor(diff / 60000);
    if (minutes < 2) return tr("just now");
    if (minutes < 60) return tr("{0} min ago", minutes);

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return tr("{0} h ago", hours);

    const days = Math.floor(hours / 24);
    return days === 1 ? tr("yesterday") : tr("{0} days ago", days);
}

const RANK_LABEL: Record<ClanRank, string> = { get leader() { return tr("Leader"); }, get admin() { return tr("Admin"); }, get member() { return tr("Member"); } };
const rankOrder = (rank: ClanRank) => (rank === "leader" ? 0 : rank === "admin" ? 1 : 2);

function memberStatus(member: ClanMemberType): { text: string; kind: "online" | "ingame" | "offline" } {
    if (member.inGame) return { text: tr("In a game"), kind: "ingame" };
    if (member.online) return { text: tr("Online"), kind: "online" };

    const seen = timeAgo(member.profiles?.last_seen_at);
    return { text: seen ? tr("Last seen {0}", seen) : tr("Offline"), kind: "offline" };
}

// =============================
// SETTINGS FORM (create + edit)
// =============================

type SettingsDraft = {
    name: string;
    tag: string;
    description: string;
    joinType: ClanJoinType;
    minRating: number;
    badge: string;
    badgeColor: string;
};

const EMPTY_DRAFT: SettingsDraft = {
    name: "",
    tag: "",
    description: "",
    joinType: "open",
    minRating: 0,
    badge: "knight",
    badgeColor: CLAN_BADGE_COLORS[0],
};

function SettingsForm({
    draft,
    onChange,
    withName,
}: {
    draft: SettingsDraft;
    onChange: (next: SettingsDraft) => void;
    withName: boolean;
}) {
    const set = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => onChange({ ...draft, [key]: value });

    return (
        <View>
            <View style={styles.formPreview}>
                <ClanBadge badge={draft.badge} color={draft.badgeColor} size={64} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.formPreviewName} numberOfLines={1}>
                        {draft.name.trim() || tr("Your clan")}
                        {draft.tag.trim() ? `  [${draft.tag.trim().toUpperCase()}]` : ""}
                    </Text>
                    <Text style={styles.formPreviewMeta}>
                        {JOIN_TYPE_LABEL[draft.joinType]}
                        {draft.minRating > 0 ? tr(" · from {0} Elo", draft.minRating) : ""}
                    </Text>
                </View>
            </View>

            {withName && (
                <>
                    <Text style={styles.label}>{tr("Name")}</Text>
                    <TextInput
                        value={draft.name}
                        onChangeText={(v) => set("name", v)}
                        placeholder={tr("Clan name")}
                        placeholderTextColor={T.textFaint}
                        style={styles.input}
                        maxLength={40}
                    />
                </>
            )}

            <Text style={styles.label}>{tr("Tag (up to 8 letters, optional)")}</Text>
            <TextInput
                value={draft.tag}
                onChangeText={(v) => set("tag", v.replace(/[^a-zA-Z0-9]/g, ""))}
                placeholder={tr("TAG")}
                placeholderTextColor={T.textFaint}
                style={styles.input}
                maxLength={8}
                autoCapitalize="characters"
            />

            <Text style={styles.label}>{tr("Description")}</Text>
            <TextInput
                value={draft.description}
                onChangeText={(v) => set("description", v)}
                placeholder={tr("What is your clan about?")}
                placeholderTextColor={T.textFaint}
                style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
                maxLength={300}
                multiline
            />

            <Text style={styles.label}>{tr("Who can join")}</Text>
            <View style={styles.segment}>
                {JOIN_TYPES.map((type) => (
                    <Pressable
                        key={type}
                        onPress={() => set("joinType", type)}
                        style={[styles.segmentItem, draft.joinType === type && styles.segmentItemActive]}
                    >
                        <Text style={[styles.segmentText, draft.joinType === type && styles.segmentTextActive]}>
                            {type === "open" ? tr("Open") : type === "request" ? tr("On request") : tr("Invite only")}
                        </Text>
                    </Pressable>
                ))}
            </View>
            <Text style={styles.hint}>{JOIN_TYPE_HINT[draft.joinType]}</Text>

            <Text style={styles.label}>{tr("Minimum rating")}</Text>
            <View style={styles.chipRow}>
                {MIN_RATINGS.map((value) => (
                    <Pressable
                        key={value}
                        onPress={() => set("minRating", value)}
                        style={[styles.chip, draft.minRating === value && styles.chipActive]}
                    >
                        <Text style={[styles.chipText, draft.minRating === value && styles.chipTextActive]}>
                            {value === 0 ? tr("None") : value}
                        </Text>
                    </Pressable>
                ))}
            </View>

            <Text style={styles.label}>{tr("Emblem")}</Text>
            <View style={styles.chipRow}>
                {Object.keys(CLAN_BADGES).map((key) => (
                    <Pressable
                        key={key}
                        onPress={() => set("badge", key)}
                        style={[styles.emblemChoice, draft.badge === key && { borderColor: draft.badgeColor, backgroundColor: `${draft.badgeColor}26` }]}
                    >
                        <Text style={{ fontSize: 22, color: draft.badge === key ? draft.badgeColor : T.textDim }} allowFontScaling={false}>
                            {CLAN_BADGES[key]}
                        </Text>
                    </Pressable>
                ))}
            </View>

            <View style={[styles.chipRow, { marginTop: 10 }]}>
                {CLAN_BADGE_COLORS.map((color) => (
                    <Pressable
                        key={color}
                        onPress={() => set("badgeColor", color)}
                        style={[styles.colorChoice, { backgroundColor: color }, draft.badgeColor === color && styles.colorChoiceActive]}
                    />
                ))}
            </View>
        </View>
    );
}

// =============================
// SCREEN
// =============================

export default function ClansScreen() {
    const socket = getSocket();

    const [account, setAccount] = useState<AccountType | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Discover (not in a clan)
    const [suggested, setSuggested] = useState<ClanType[]>([]);
    const [topClans, setTopClans] = useState<ClanType[]>([]);
    const [search, setSearch] = useState("");
    const [searchResults, setSearchResults] = useState<ClanType[] | null>(null);
    const [invites, setInvites] = useState<ClanInviteType[]>([]);
    const [myRequests, setMyRequests] = useState<{ id: string; clan: ClanType }[]>([]);
    const [preview, setPreview] = useState<{ clan: ClanType; members: ClanMemberType[]; requested: boolean } | null>(null);
    const [previewBusy, setPreviewBusy] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [createDraft, setCreateDraft] = useState<SettingsDraft>(EMPTY_DRAFT);
    const [createBusy, setCreateBusy] = useState(false);

    // In a clan
    const [myClan, setMyClan] = useState<ClanType | null>(null);
    const [myRank, setMyRank] = useState<ClanRank | null>(null);
    const [members, setMembers] = useState<ClanMemberType[]>([]);
    const [messages, setMessages] = useState<ClanMessageType[]>([]);
    const [requests, setRequests] = useState<ClanJoinRequestType[]>([]);
    const [tab, setTab] = useState<Tab>("members");
    const [chatInput, setChatInput] = useState("");
    const [unread, setUnread] = useState(0);
    const [inviteUsername, setInviteUsername] = useState("");
    const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(EMPTY_DRAFT);
    const [settingsBusy, setSettingsBusy] = useState(false);
    const [selectedMember, setSelectedMember] = useState<ClanMemberType | null>(null);
    const [infoOpen, setInfoOpen] = useState(false);

    // Another screen (a player's profile) can ask for a clan to be shown.
    const params = useLocalSearchParams<{ clanId?: string }>();
    const requestedClanId = typeof params.clanId === "string" ? params.clanId : null;
    const requestedShown = useRef(false);

    const scrollRef = useRef<ScrollView>(null);
    const tabRef = useRef<Tab>("members");
    tabRef.current = tab;

    const myId = account?.authId ?? null;
    const isGuest = !account || account.guest || !account.authId;
    const isStaff = myRank === "leader" || myRank === "admin";

    // =============================
    // LADEN
    // =============================

    const loadDiscover = useCallback(async () => {
        const [suggestedRes, topRes] = await Promise.all([
            getSuggestedClans(socket).catch(() => ({ clans: [] as ClanType[] })),
            listClans(socket).catch(() => ({ clans: [] as ClanType[] })),
        ]);

        setSuggested(suggestedRes.clans);
        setTopClans(topRes.clans);
    }, [socket]);

    const applyClanData = useCallback((data: Awaited<ReturnType<typeof getClanData>>) => {
        setMyClan(data.clan);
        setMyRank(data.myRank);
        setMembers(data.members);
        setMessages(data.messages);
        setRequests(data.requests);
        setSettingsDraft({
            name: data.clan.name,
            tag: data.clan.tag ?? "",
            description: data.clan.description ?? "",
            joinType: data.clan.join_type,
            minRating: data.clan.min_rating,
            badge: data.clan.badge,
            badgeColor: data.clan.badge_color,
        });
    }, []);

    const loadClan = useCallback(
        async (clanId: string) => {
            applyClanData(await getClanData(socket, clanId));
        },
        [socket, applyClanData]
    );

    const leaveLocally = useCallback(async () => {
        setMyClan(null);
        setMyRank(null);
        setMembers([]);
        setMessages([]);
        setRequests([]);
        setTab("members");
        await loadDiscover();
    }, [loadDiscover]);

    const bootstrap = useCallback(async () => {
        setLoading(true);
        setLoadError(null);

        const acc = await getCurrentAccount();
        setAccount(acc);

        const signedIn = !!acc && !acc.guest && !!acc.authId;

        try {
            if (signedIn) {
                getMyInvites(socket)
                    .then((res) => setInvites(res.invites))
                    .catch(() => undefined);
                getMyJoinRequests(socket)
                    .then((res) => setMyRequests(res.requests))
                    .catch(() => undefined);

                const { clan } = await getMyClan(socket);

                if (clan) {
                    await loadClan(clan.id);
                    setLoading(false);
                    return;
                }
            }

            await loadDiscover();
        } catch (error: any) {
            log("CLAN BOOTSTRAP ERROR:", error);
            setLoadError(clanErrorText(error?.message));
        }

        setLoading(false);
    }, [socket, loadClan, loadDiscover]);

    useEffect(() => {
        bootstrap();
    }, [bootstrap]);

    // Opened from a profile: show that clan once everything is loaded.
    useEffect(() => {
        if (loading || !requestedClanId || requestedShown.current) return;
        requestedShown.current = true;

        if (myClan?.id === requestedClanId) {
            setInfoOpen(true);
            return;
        }

        getClanData(socket, requestedClanId)
            .then((data) =>
                setPreview({ clan: data.clan, members: data.members, requested: data.myRequestPending })
            )
            .catch((error: any) => notify(tr("Clan"), clanErrorText(error?.message)));
    }, [loading, requestedClanId, myClan, socket]);

    // Search with a short delay while typing.
    useEffect(() => {
        const term = search.trim();

        if (term.length < 2) {
            setSearchResults(null);
            return;
        }

        const timer = setTimeout(() => {
            listClans(socket, term)
                .then((res) => setSearchResults(res.clans))
                .catch(() => setSearchResults([]));
        }, 300);

        return () => clearTimeout(timer);
    }, [search, socket]);

    // Who is online / in a game: refreshed regularly while the clan is open.
    useEffect(() => {
        if (!myClan) return;

        const refresh = () => {
            getClanPresence(socket, myClan.id)
                .then(({ online, inGame }) =>
                    setMembers((prev) =>
                        prev.map((m) => ({ ...m, online: online.includes(m.user_id), inGame: inGame.includes(m.user_id) }))
                    )
                )
                .catch(() => undefined);
        };

        const id = setInterval(refresh, 15000);
        return () => clearInterval(id);
    }, [myClan?.id, socket]);

    // =============================
    // REALTIME
    // =============================

    useEffect(() => {
        const clanId = myClan?.id ?? null;

        const offs = [
            onClanMessage(socket, (msg) => {
                if (!clanId || msg.clan_id !== clanId) return;
                setMessages((prev) => [...prev, msg].slice(-100));

                if (tabRef.current === "chat") {
                    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
                } else if (msg.type === "chat") {
                    setUnread((n) => n + 1);
                }
            }),
            // Joins and leaves change the roster, the clan rating and the
            // league - simplest to load the clan again.
            onClanMemberJoined(socket, () => {
                if (clanId) loadClan(clanId).catch(() => undefined);
            }),
            onClanMemberLeft(socket, (data) => {
                if (!clanId) return;
                if (data.userId === myId) return; // handled by kicked / leave
                loadClan(clanId).catch(() => undefined);
            }),
            onClanMemberPromoted(socket, (data) => {
                setMembers((prev) => prev.map((m) => (m.user_id === data.userId ? { ...m, rank: "admin" } : m)));
                if (data.userId === myId) setMyRank("admin");
            }),
            onClanMemberDemoted(socket, (data) => {
                setMembers((prev) => prev.map((m) => (m.user_id === data.userId ? { ...m, rank: "member" } : m)));
                if (data.userId === myId) {
                    setMyRank("member");
                    setTab((t) => (t === "manage" ? "members" : t));
                }
            }),
            onClanLeaderChanged(socket, () => {
                if (clanId) loadClan(clanId).catch(() => undefined);
            }),
            onClanPresence(socket, (data) => {
                setMembers((prev) =>
                    prev.map((m) =>
                        m.user_id === data.userId
                            ? {
                                  ...m,
                                  online: data.online,
                                  inGame: data.inGame,
                                  profiles: { ...m.profiles, last_seen_at: data.lastSeenAt ?? m.profiles.last_seen_at },
                              }
                            : m
                    )
                );
            }),
            onClanUpdated(socket, (data) => {
                if (clanId && data.clan.id === clanId) setMyClan(data.clan);
            }),
            onClanJoinRequestReceived(socket, (data) => {
                if (!clanId || data.clanId !== clanId) return;
                setRequests((prev) => (prev.some((r) => r.id === data.request.id) ? prev : [...prev, data.request]));
            }),
            onClanInviteReceived(socket, () => {
                getMyInvites(socket)
                    .then((res) => setInvites(res.invites))
                    .catch(() => undefined);
            }),
            onClanJoinRequestAnswered(socket, (data) => {
                if (data.accepted) bootstrap();
                else setMyRequests((prev) => prev.filter((r) => r.clan.id !== data.clanId));
            }),
            onKickedFromClan(socket, (data) => {
                if (clanId && data.clanId === clanId) {
                    notify(tr("Clan"), tr("You were removed from the clan."));
                    leaveLocally();
                }
            }),
        ];

        return () => offs.forEach((off) => off());
    }, [socket, myClan?.id, myId, loadClan, leaveLocally, bootstrap]);

    // =============================
    // AKTIONEN
    // =============================

    async function openPreview(clan: ClanType) {
        setPreview({ clan, members: [], requested: myRequests.some((r) => r.clan.id === clan.id) });

        try {
            const data = await getClanData(socket, clan.id);
            setPreview({ clan: data.clan, members: data.members, requested: data.myRequestPending });
        } catch (error: any) {
            log("CLAN PREVIEW ERROR:", error);
        }
    }

    async function handleJoin(clan: ClanType) {
        setPreviewBusy(true);

        try {
            const res = await joinClan(socket, clan.id);

            if (res.requested) {
                setPreview((p) => (p ? { ...p, requested: true } : p));
                setMyRequests((prev) => [...prev.filter((r) => r.clan.id !== clan.id), { id: clan.id, clan }]);
            } else {
                setPreview(null);
                await loadClan(clan.id);
            }
        } catch (error: any) {
            notify(tr("Not possible"), clanErrorText(error?.message));
        } finally {
            setPreviewBusy(false);
        }
    }

    async function handleCancelRequest(clanId: string) {
        try {
            await cancelJoinRequest(socket, clanId);
            setMyRequests((prev) => prev.filter((r) => r.clan.id !== clanId));
            setPreview((p) => (p && p.clan.id === clanId ? { ...p, requested: false } : p));
        } catch (error: any) {
            notify(tr("Error"), clanErrorText(error?.message));
        }
    }

    async function handleCreate() {
        if (!createDraft.name.trim() || createBusy) return;

        setCreateBusy(true);

        try {
            const { clan } = await createClan(socket, {
                name: createDraft.name.trim(),
                tag: createDraft.tag.trim() || undefined,
                description: createDraft.description.trim() || undefined,
                joinType: createDraft.joinType,
                minRating: createDraft.minRating,
                badge: createDraft.badge,
                badgeColor: createDraft.badgeColor,
            });

            setCreateOpen(false);
            setCreateDraft(EMPTY_DRAFT);
            await loadClan(clan.id);
        } catch (error: any) {
            notify(tr("Error"), clanErrorText(error?.message));
        } finally {
            setCreateBusy(false);
        }
    }

    async function handleRespondInvite(invite: ClanInviteType, accept: boolean) {
        try {
            const result = await respondToInvite(socket, invite.id, accept);
            setInvites((prev) => prev.filter((i) => i.id !== invite.id));

            if (accept && result.clanId) await loadClan(result.clanId);
        } catch (error: any) {
            notify(tr("Error"), clanErrorText(error?.message));
        }
    }

    function handleLeave() {
        if (!myClan) return;

        const lastMember = members.length <= 1;

        confirm(
            tr("Leave clan"),
            lastMember
                ? tr("You are the last member. \"{0}\" will be deleted.", myClan.name)
                : myRank === "leader"
                    ? tr("If you leave, the longest-serving admin (or member) becomes the leader of \"{0}\".", myClan.name)
                    : tr("Do you really want to leave \"{0}\"?", myClan.name),
            tr("Leave"),
            async () => {
                try {
                    await leaveClan(socket, myClan.id);
                    await leaveLocally();
                } catch (error: any) {
                    notify(tr("Error"), clanErrorText(error?.message));
                }
            }
        );
    }

    async function handleSendMessage() {
        if (!myClan || !chatInput.trim()) return;

        const text = chatInput.trim();
        setChatInput("");

        try {
            await sendClanMessage(socket, myClan.id, text);
        } catch (error: any) {
            setChatInput(text);
            notify(tr("Error"), clanErrorText(error?.message));
        }
    }

    async function handleInvite() {
        if (!myClan || !inviteUsername.trim()) return;

        const name = inviteUsername.trim();

        try {
            await inviteToClan(socket, myClan.id, name);
            setInviteUsername("");
            notify(tr("Invitation sent"), tr("{0} was invited.", name));
        } catch (error: any) {
            notify(tr("Error"), clanErrorText(error?.message));
        }
    }

    async function handleRequest(request: ClanJoinRequestType, accept: boolean) {
        try {
            await respondJoinRequest(socket, request.id, accept);
            setRequests((prev) => prev.filter((r) => r.id !== request.id));
        } catch (error: any) {
            notify(tr("Error"), clanErrorText(error?.message));
        }
    }

    async function handleSaveSettings() {
        if (!myClan || settingsBusy) return;

        setSettingsBusy(true);

        try {
            const { clan } = await updateClanSettings(socket, myClan.id, {
                description: settingsDraft.description.trim() || null,
                tag: settingsDraft.tag.trim() || null,
                joinType: settingsDraft.joinType,
                minRating: settingsDraft.minRating,
                badge: settingsDraft.badge,
                badgeColor: settingsDraft.badgeColor,
            });

            setMyClan(clan);
            notify(tr("Saved"), tr("The clan settings were updated."));
        } catch (error: any) {
            notify(tr("Error"), clanErrorText(error?.message));
        } finally {
            setSettingsBusy(false);
        }
    }

    async function memberAction(action: "promote" | "demote" | "kick" | "leader", member: ClanMemberType) {
        if (!myClan) return;

        const name = member.profiles?.username || tr("this member");
        setSelectedMember(null);

        const run = async () => {
            try {
                if (action === "promote") await promoteMember(socket, myClan.id, member.user_id);
                if (action === "demote") await demoteAdmin(socket, myClan.id, member.user_id);
                if (action === "kick") await kickMember(socket, myClan.id, member.user_id);
                if (action === "leader") await transferLeadership(socket, myClan.id, member.user_id);
            } catch (error: any) {
                notify(tr("Error"), clanErrorText(error?.message));
            }
        };

        if (action === "kick") confirm(tr("Remove member"), tr("Really remove {0} from the clan?", name), tr("Remove"), run);
        else if (action === "leader") confirm(tr("Hand over leadership"), tr("{0} becomes the leader and you become an admin.", name), tr("Hand over"), run);
        else run();
    }

    function challenge(member: ClanMemberType) {
        setSelectedMember(null);
        startChallenge({
            id: member.user_id,
            username: member.profiles?.username || tr("Player"),
            avatar: member.profiles?.avatar,
            rating: member.profiles?.rating,
        });
    }

    function openProfile(member: ClanMemberType) {
        setSelectedMember(null);
        router.push({
            pathname: "/profile",
            params: {
                userId: member.user_id,
                name: member.profiles?.username || "",
                avatar: member.profiles?.avatar || "",
                rating: member.profiles?.rating != null ? String(member.profiles.rating) : "",
            },
        });
    }

    // =============================
    // ABGELEITETE WERTE
    // =============================

    const sortedMembers = useMemo(
        () =>
            members.slice().sort((a, b) => {
                const presence = Number(b.online) - Number(a.online);
                if (presence !== 0) return presence;
                const rank = rankOrder(a.rank) - rankOrder(b.rank);
                if (rank !== 0) return rank;
                return (b.profiles?.rating ?? 0) - (a.profiles?.rating ?? 0);
            }),
        [members]
    );

    const onlineCount = members.filter((m) => m.online).length;

    // =============================
    // RENDER
    // =============================

    const header = (
        <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
                <Text style={styles.backText}>‹</Text>
            </Pressable>
            <Text style={styles.headerTitle}>{myClan ? tr("My Clan") : tr("Clans")}</Text>
            <View style={{ width: 42 }} />
        </View>
    );

    if (loading) {
        return (
            <ImageBackground source={backgroundImage} style={styles.flex} resizeMode="cover">
                <View style={styles.scrim} />
                <View style={styles.page}>
                    {header}
                    <View style={styles.centered}>
                        <ActivityIndicator color={T.text} size="large" />
                    </View>
                </View>
            </ImageBackground>
        );
    }

    // ---------- Clan-Zeile für Mitglieder ----------
    const memberRow = (member: ClanMemberType, interactive: boolean) => {
        const status = memberStatus(member);
        const isMe = member.user_id === myId;

        return (
            <Pressable
                key={member.user_id}
                disabled={!interactive}
                onPress={() => setSelectedMember(member)}
                style={({ pressed }) => [styles.memberRow, pressed && { opacity: 0.85 }]}
            >
                <Avatar name={member.profiles?.username || "?"} uri={member.profiles?.avatar} size={44} status={status.kind} />

                <View style={{ flex: 1 }}>
                    <View style={styles.memberNameRow}>
                        <Text style={styles.memberName} numberOfLines={1}>
                            {member.profiles?.username || tr("Player")}
                        </Text>
                        {isMe && <Text style={styles.youText}>{tr("you")}</Text>}
                        {member.rank !== "member" && (
                            <View style={[styles.rankChip, member.rank === "leader" && styles.rankChipLeader]}>
                                <Text style={[styles.rankChipText, member.rank === "leader" && { color: T.gold }]}>
                                    {RANK_LABEL[member.rank]}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text
                        style={[
                            styles.memberStatus,
                            status.kind === "online" && { color: "#4ADE80" },
                            status.kind === "ingame" && { color: "#F5B544" },
                        ]}
                    >
                        {status.text}
                    </Text>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.memberRating}>{member.profiles?.rating ?? "–"}</Text>
                    <Text style={styles.memberRatingLabel}>{tr("ELO")}</Text>
                </View>

                {interactive && !isMe && member.online && !member.inGame && (
                    <Pressable onPress={() => challenge(member)} style={styles.challengeButton} hitSlop={6}>
                        <Text style={styles.challengeButtonText}>{tr("Play")}</Text>
                    </Pressable>
                )}
            </Pressable>
        );
    };

    // ---------- Kopf eines Clans ----------
    const clanHero = (clan: ClanType, online?: number) => {
        const leagueColor = LEAGUE_COLORS[clan.league] ?? T.accent;

        // The own clan's header opens the clan information.
        const own = online !== undefined;

        return (
            <Pressable
                style={({ pressed }) => [styles.hero, own && pressed && { opacity: 0.85 }]}
                disabled={!own}
                onPress={() => setInfoOpen(true)}
                accessibilityRole={own ? "button" : undefined}
                accessibilityLabel={own ? tr("Clan information") : undefined}
            >
                {own && (
                    <View style={styles.heroInfo}>
                        <Text style={styles.heroInfoText}>i</Text>
                    </View>
                )}
                <View style={styles.heroTop}>
                    <ClanBadge badge={clan.badge} color={clan.badge_color} size={68} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.heroName} numberOfLines={2}>
                            {clan.name}
                            {clan.tag ? <Text style={styles.heroTag}>  [{clan.tag}]</Text> : null}
                        </Text>
                        <View style={styles.heroPills}>
                            <LeaguePill league={clan.league} />
                            <View style={styles.typePill}>
                                <Text style={styles.typePillText}>{JOIN_TYPE_LABEL[clan.join_type]}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {clan.description ? <Text style={styles.heroDescription}>{clan.description}</Text> : null}

                <View style={styles.statRow}>
                    <View style={styles.stat}>
                        <Text style={styles.statValue}>{clan.clan_rating}</Text>
                        <Text style={styles.statLabel}>{tr("Clan Elo")}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.stat}>
                        <Text style={styles.statValue}>
                            {clan.member_count}
                            <Text style={styles.statValueDim}>/{clan.max_members}</Text>
                        </Text>
                        <Text style={styles.statLabel}>{tr("Members")}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.stat}>
                        {online !== undefined ? (
                            <>
                                <Text style={[styles.statValue, online > 0 && { color: "#4ADE80" }]}>{online}</Text>
                                <Text style={styles.statLabel}>{tr("Online")}</Text>
                            </>
                        ) : (
                            <>
                                <Text style={styles.statValue}>{clan.min_rating > 0 ? clan.min_rating : "–"}</Text>
                                <Text style={styles.statLabel}>{tr("Min. Elo")}</Text>
                            </>
                        )}
                    </View>
                </View>

                <View style={styles.leagueBlock}>
                    <View style={styles.leagueLabels}>
                        <Text style={[styles.leagueName, { color: leagueColor }]}>{clan.league} {tr("League")}</Text>
                        <Text style={styles.leagueNext}>
                            {clan.next_league && clan.next_league_at
                                ? tr("{0} Elo to {1}", Math.max(0, clan.next_league_at - clan.clan_rating), clan.next_league)
                                : tr("Highest league")}
                        </Text>
                    </View>
                    <View style={styles.leagueTrack}>
                        <View style={[styles.leagueFill, { width: `${Math.round(clan.league_progress * 100)}%`, backgroundColor: leagueColor }]} />
                    </View>
                </View>
            </Pressable>
        );
    };

    // ---------- Preview of a clan (shown from the lists and from profiles) ----------
    const previewModal = (
            <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
                <View style={styles.modalBackdrop}>
                    {preview && (
                        <View style={styles.modalCard}>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {clanHero(preview.clan)}

                                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>{tr("Members")}</Text>
                                {preview.members.length === 0 ? (
                                    <ActivityIndicator color={T.text} style={{ marginVertical: 16 }} />
                                ) : (
                                    preview.members
                                        .slice()
                                        .sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank) || (b.profiles?.rating ?? 0) - (a.profiles?.rating ?? 0))
                                        .slice(0, 8)
                                        .map((member) => memberRow(member, false))
                                )}
                                {preview.members.length > 8 && (
                                    <Text style={styles.sectionHint}>{tr("and")} {preview.members.length - 8} {tr("more")}</Text>
                                )}
                            </ScrollView>

                            <View style={styles.modalActions}>
                                <Pressable onPress={() => setPreview(null)} style={styles.secondaryButton}>
                                    <Text style={styles.secondaryButtonText}>{tr("Close")}</Text>
                                </Pressable>

                                {!isGuest && myClan && (
                                    <View style={[styles.primaryButton, styles.modalPrimary, { backgroundColor: T.raised, opacity: 0.7 }]}>
                                        <Text style={styles.primaryButtonText}>
                                            {myClan.id === preview.clan.id ? tr("Your clan") : tr("Leave your clan to join")}
                                        </Text>
                                    </View>
                                )}

                                {!isGuest &&
                                    !myClan &&
                                    (preview.requested ? (
                                        <Pressable onPress={() => handleCancelRequest(preview.clan.id)} style={[styles.primaryButton, styles.modalPrimary, { backgroundColor: T.raised }]}>
                                            <Text style={styles.primaryButtonText}>{tr("Cancel request")}</Text>
                                        </Pressable>
                                    ) : (
                                        <Pressable
                                            onPress={() => handleJoin(preview.clan)}
                                            disabled={
                                                previewBusy ||
                                                preview.clan.join_type === "closed" ||
                                                preview.clan.member_count >= preview.clan.max_members ||
                                                (account?.rating ?? 1000) < preview.clan.min_rating
                                            }
                                            style={[
                                                styles.primaryButton,
                                                styles.modalPrimary,
                                                (preview.clan.join_type === "closed" ||
                                                    preview.clan.member_count >= preview.clan.max_members ||
                                                    (account?.rating ?? 1000) < preview.clan.min_rating) && { opacity: 0.45 },
                                            ]}
                                        >
                                            <Text style={styles.primaryButtonText}>
                                                {preview.clan.member_count >= preview.clan.max_members
                                                    ? tr("Clan is full")
                                                    : preview.clan.join_type === "closed"
                                                        ? tr("Invite only")
                                                        : (account?.rating ?? 1000) < preview.clan.min_rating
                                                            ? tr("Needs {0} Elo", preview.clan.min_rating)
                                                            : preview.clan.join_type === "request"
                                                                ? tr("Ask to join")
                                                                : tr("Join clan")}
                                            </Text>
                                        </Pressable>
                                    ))}
                            </View>
                        </View>
                    )}
                </View>
            </Modal>
    );

    // ---------- Information about the own clan ----------
    const infoModal = myClan && (
        <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
            <View style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={styles.infoHead}>
                            <ClanBadge badge={myClan.badge} color={myClan.badge_color} size={56} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.heroName}>
                                    {myClan.name}
                                    {myClan.tag ? <Text style={styles.heroTag}>  [{myClan.tag}]</Text> : null}
                                </Text>
                                <Text style={styles.infoSub}>
                                    {myRank === "leader" ? tr("You lead this clan") : myRank === "admin" ? tr("You are an admin") : tr("You are a member")}
                                </Text>
                            </View>
                        </View>

                        {myClan.description ? <Text style={styles.heroDescription}>{myClan.description}</Text> : null}

                        <View style={styles.infoTable}>
                            {(
                                [
                                    ["Leader", members.find((m) => m.rank === "leader")?.profiles?.username ?? "–"],
                                    ["Founded", new Date(myClan.created_at).toLocaleDateString()],
                                    ["Members", `${myClan.member_count} of ${myClan.max_members}`],
                                    ["Joining", JOIN_TYPE_LABEL[myClan.join_type]],
                                    ["Minimum rating", myClan.min_rating > 0 ? tr("{0} Elo", myClan.min_rating) : tr("None")],
                                    ["Clan rating", `${myClan.clan_rating} Elo`],
                                ] as [string, string][]
                            ).map(([label, value], index) => (
                                <View key={label} style={[styles.infoRow, index > 0 && styles.infoRowDivider]}>
                                    <Text style={styles.infoLabel}>{label}</Text>
                                    <Text style={styles.infoValue}>{value}</Text>
                                </View>
                            ))}
                        </View>

                        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>{tr("Leagues")}</Text>
                        <Text style={styles.sectionHint}>
                            {tr("The clan rating is the average rating of the ten strongest members.")}
                        </Text>

                        {CLAN_LEAGUES.slice()
                            .reverse()
                            .map((league) => {
                                const current = league.name === myClan.league;
                                const color = LEAGUE_COLORS[league.name] ?? T.accent;

                                return (
                                    <View key={league.name} style={[styles.leagueRow, current && { borderColor: color, backgroundColor: color + "1A" }]}>
                                        <View style={[styles.leagueDot, { backgroundColor: color }]} />
                                        <Text style={[styles.leagueRowName, current && { color }]}>{league.name}</Text>
                                        <Text style={styles.leagueRowMin}>
                                            {current ? tr("You are here · ") : ""}
                                            {league.min > 0 ? tr("from {0} Elo", league.min) : tr("Start")}
                                        </Text>
                                    </View>
                                );
                            })}
                    </ScrollView>

                    <View style={styles.modalActions}>
                        <Pressable onPress={() => setInfoOpen(false)} style={[styles.secondaryButton, { flex: 1 }]}>
                            <Text style={styles.secondaryButtonText}>{tr("Close")}</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );

    // =============================
    // IN A CLAN
    // =============================

    if (myClan) {
        return (
            <ImageBackground source={backgroundImage} style={styles.flex} resizeMode="cover">
                <View style={styles.scrim} />

                <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                    {header}

                    <ScrollView
                        ref={scrollRef}
                        style={styles.flex}
                        contentContainerStyle={styles.content}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {clanHero(myClan, onlineCount)}

                        <View style={styles.tabs}>
                            {(["members", "chat", ...(isStaff ? (["manage"] as Tab[]) : [])] as Tab[]).map((key) => (
                                <Pressable
                                    key={key}
                                    onPress={() => {
                                        setTab(key);
                                        if (key === "chat") {
                                            setUnread(0);
                                            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 60);
                                        }
                                    }}
                                    style={[styles.tab, tab === key && styles.tabActive]}
                                >
                                    <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
                                        {key === "members" ? tr("Members") : key === "chat" ? tr("Chat") : tr("Manage")}
                                    </Text>
                                    {key === "chat" && unread > 0 && (
                                        <View style={styles.tabBadge}>
                                            <Text style={styles.tabBadgeText}>{unread > 9 ? "9+" : unread}</Text>
                                        </View>
                                    )}
                                    {key === "manage" && requests.length > 0 && (
                                        <View style={styles.tabBadge}>
                                            <Text style={styles.tabBadgeText}>{requests.length}</Text>
                                        </View>
                                    )}
                                </Pressable>
                            ))}
                        </View>

                        {tab === "members" && (
                            <>
                                <Text style={styles.sectionHint}>
                                    {onlineCount} {tr("of")} {members.length} {tr("online · tap a member for more")}
                                </Text>
                                {sortedMembers.map((member) => memberRow(member, true))}

                                <Pressable onPress={handleLeave} style={styles.leaveButton}>
                                    <Text style={styles.leaveButtonText}>{tr("Leave clan")}</Text>
                                </Pressable>
                            </>
                        )}

                        {tab === "chat" && (
                            <View style={styles.chatBox}>
                                {messages.length === 0 && <Text style={styles.emptyText}>{tr("No messages yet. Say hello!")}</Text>}

                                {messages.map((msg) => {
                                    if (msg.type === "system") {
                                        return (
                                            <Text key={msg.id} style={styles.systemMessage}>
                                                {msg.message}
                                            </Text>
                                        );
                                    }

                                    const mine = msg.sender_id === myId;

                                    return (
                                        <View key={msg.id} style={[styles.bubbleRow, mine && { justifyContent: "flex-end" }]}>
                                            {!mine && <Avatar name={msg.sender_username || "?"} size={28} />}
                                            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                                                {!mine && <Text style={styles.bubbleSender}>{msg.sender_username}</Text>}
                                                <Text style={styles.bubbleText}>{msg.message}</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {tab === "manage" && isStaff && (
                            <>
                                <View style={styles.card}>
                                    <Text style={styles.cardTitle}>{tr("Join requests")}</Text>
                                    {requests.length === 0 ? (
                                        <Text style={styles.emptyText}>{tr("No open requests.")}</Text>
                                    ) : (
                                        requests.map((request) => (
                                            <View key={request.id} style={styles.requestRow}>
                                                <Avatar name={request.profile.username} uri={request.profile.avatar} size={38} />
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.memberName}>{request.profile.username}</Text>
                                                    <Text style={styles.memberStatus}>{request.profile.rating ?? "–"} {tr("Elo")}</Text>
                                                </View>
                                                <Pressable onPress={() => handleRequest(request, false)} style={styles.smallDecline}>
                                                    <Text style={styles.smallDeclineText}>✕</Text>
                                                </Pressable>
                                                <Pressable onPress={() => handleRequest(request, true)} style={styles.smallAccept}>
                                                    <Text style={styles.smallAcceptText}>{tr("Accept")}</Text>
                                                </Pressable>
                                            </View>
                                        ))
                                    )}
                                </View>

                                <View style={styles.card}>
                                    <Text style={styles.cardTitle}>{tr("Invite a player")}</Text>
                                    <View style={styles.inlineRow}>
                                        <TextInput
                                            value={inviteUsername}
                                            onChangeText={setInviteUsername}
                                            placeholder={tr("Username")}
                                            placeholderTextColor={T.textFaint}
                                            style={[styles.input, { flex: 1, marginTop: 0 }]}
                                            maxLength={60}
                                            autoCapitalize="none"
                                        />
                                        <Pressable onPress={handleInvite} style={styles.inlineButton}>
                                            <Text style={styles.inlineButtonText}>{tr("Invite")}</Text>
                                        </Pressable>
                                    </View>
                                </View>

                                <View style={styles.card}>
                                    <Text style={styles.cardTitle}>{tr("Clan settings")}</Text>
                                    <SettingsForm draft={settingsDraft} onChange={setSettingsDraft} withName={false} />
                                    <Pressable
                                        onPress={handleSaveSettings}
                                        disabled={settingsBusy}
                                        style={[styles.primaryButton, settingsBusy && { opacity: 0.6 }]}
                                    >
                                        <Text style={styles.primaryButtonText}>{settingsBusy ? tr("Saving…") : tr("Save settings")}</Text>
                                    </Pressable>
                                </View>
                            </>
                        )}
                    </ScrollView>

                    {tab === "chat" && (
                        <View style={styles.chatInputBar}>
                            <TextInput
                                value={chatInput}
                                onChangeText={setChatInput}
                                placeholder={tr("Write a message…")}
                                placeholderTextColor={T.textFaint}
                                style={[styles.input, { flex: 1, marginTop: 0 }]}
                                maxLength={300}
                                onSubmitEditing={handleSendMessage}
                                returnKeyType="send"
                            />
                            <Pressable
                                onPress={handleSendMessage}
                                disabled={!chatInput.trim()}
                                style={[styles.inlineButton, !chatInput.trim() && { opacity: 0.5 }]}
                            >
                                <Text style={styles.inlineButtonText}>{tr("Send")}</Text>
                            </Pressable>
                        </View>
                    )}
                </KeyboardAvoidingView>

                {/* Aktionen für ein Mitglied */}
                {infoModal}
                {previewModal}

                <Modal visible={!!selectedMember} transparent animationType="fade" onRequestClose={() => setSelectedMember(null)}>
                    <Pressable style={styles.sheetBackdrop} onPress={() => setSelectedMember(null)}>
                        {selectedMember && (
                            <Pressable style={styles.sheet} onPress={() => undefined}>
                                <View style={styles.sheetHeader}>
                                    <Avatar
                                        name={selectedMember.profiles?.username || "?"}
                                        uri={selectedMember.profiles?.avatar}
                                        size={52}
                                        status={memberStatus(selectedMember).kind}
                                    />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sheetName}>{selectedMember.profiles?.username}</Text>
                                        <Text style={styles.memberStatus}>
                                            {RANK_LABEL[selectedMember.rank]} · {selectedMember.profiles?.rating ?? "–"} {tr("Elo ·")}{" "}
                                            {memberStatus(selectedMember).text}
                                        </Text>
                                    </View>
                                </View>

                                {selectedMember.user_id !== myId && (
                                    <Pressable
                                        onPress={() => challenge(selectedMember)}
                                        disabled={!selectedMember.online || selectedMember.inGame}
                                        style={[styles.sheetPrimary, (!selectedMember.online || selectedMember.inGame) && { opacity: 0.4 }]}
                                    >
                                        <Text style={styles.sheetPrimaryText}>
                                            {selectedMember.inGame
                                                ? tr("In a game right now")
                                                : selectedMember.online
                                                    ? tr("Challenge to a friendly game")
                                                    : tr("Offline - cannot be challenged")}
                                        </Text>
                                    </Pressable>
                                )}

                                <Pressable onPress={() => openProfile(selectedMember)} style={styles.sheetItem}>
                                    <Text style={styles.sheetItemText}>{tr("View profile")}</Text>
                                </Pressable>

                                {myRank === "leader" && selectedMember.rank === "member" && (
                                    <Pressable onPress={() => memberAction("promote", selectedMember)} style={styles.sheetItem}>
                                        <Text style={styles.sheetItemText}>{tr("Make admin")}</Text>
                                    </Pressable>
                                )}
                                {myRank === "leader" && selectedMember.rank === "admin" && (
                                    <Pressable onPress={() => memberAction("demote", selectedMember)} style={styles.sheetItem}>
                                        <Text style={styles.sheetItemText}>{tr("Remove admin rank")}</Text>
                                    </Pressable>
                                )}
                                {myRank === "leader" && selectedMember.user_id !== myId && (
                                    <Pressable onPress={() => memberAction("leader", selectedMember)} style={styles.sheetItem}>
                                        <Text style={styles.sheetItemText}>{tr("Make leader")}</Text>
                                    </Pressable>
                                )}
                                {isStaff &&
                                    selectedMember.user_id !== myId &&
                                    selectedMember.rank !== "leader" &&
                                    !(myRank === "admin" && selectedMember.rank === "admin") && (
                                        <Pressable onPress={() => memberAction("kick", selectedMember)} style={styles.sheetItem}>
                                            <Text style={[styles.sheetItemText, { color: "#F08A86" }]}>{tr("Remove from clan")}</Text>
                                        </Pressable>
                                    )}

                                <Pressable onPress={() => setSelectedMember(null)} style={[styles.sheetItem, { borderBottomWidth: 0 }]}>
                                    <Text style={[styles.sheetItemText, { color: T.textDim }]}>{tr("Close")}</Text>
                                </Pressable>
                            </Pressable>
                        )}
                    </Pressable>
                </Modal>
            </ImageBackground>
        );
    }

    // =============================
    // DISCOVER (not in a clan)
    // =============================

    const listed = searchResults ?? topClans;

    return (
        <ImageBackground source={backgroundImage} style={styles.flex} resizeMode="cover">
            <View style={styles.scrim} />

            <View style={styles.page}>
                {header}

                <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <Text style={styles.pageTitle}>{tr("Find your clan")}</Text>
                    <Text style={styles.pageSubtitle}>{tr("Play friendly games, chat and climb the leagues together.")}</Text>

                    {loadError && (
                        <Pressable onPress={bootstrap} style={styles.errorCard}>
                            <Text style={styles.errorText}>{loadError}</Text>
                            <Text style={styles.errorRetry}>{tr("Tap to try again")}</Text>
                        </Pressable>
                    )}

                    {isGuest && (
                        <View style={styles.noticeCard}>
                            <Text style={styles.noticeText}>{tr("Sign in with an account to join or create a clan.")}</Text>
                        </View>
                    )}

                    {invites.length > 0 && (
                        <View style={[styles.card, { borderColor: T.accentBorder }]}>
                            <Text style={styles.cardTitle}>{tr("Invitations")}</Text>
                            {invites.map((invite) => (
                                <View key={invite.id} style={styles.requestRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.memberName}>
                                            {invite.clans?.name || tr("Clan")}
                                            {invite.clans?.tag ? ` [${invite.clans.tag}]` : ""}
                                        </Text>
                                        <Text style={styles.memberStatus}>{tr("invited you to join")}</Text>
                                    </View>
                                    <Pressable onPress={() => handleRespondInvite(invite, false)} style={styles.smallDecline}>
                                        <Text style={styles.smallDeclineText}>✕</Text>
                                    </Pressable>
                                    <Pressable onPress={() => handleRespondInvite(invite, true)} style={styles.smallAccept}>
                                        <Text style={styles.smallAcceptText}>{tr("Join")}</Text>
                                    </Pressable>
                                </View>
                            ))}
                        </View>
                    )}

                    {myRequests.length > 0 && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>{tr("Waiting for an answer")}</Text>
                            {myRequests.map((request) => (
                                <View key={request.clan.id} style={styles.requestRow}>
                                    <ClanBadge badge={request.clan.badge} color={request.clan.badge_color} size={36} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.memberName}>{request.clan.name}</Text>
                                        <Text style={styles.memberStatus}>{tr("Request sent")}</Text>
                                    </View>
                                    <Pressable onPress={() => handleCancelRequest(request.clan.id)} style={styles.smallDecline}>
                                        <Text style={[styles.smallDeclineText, { fontSize: 12.5 }]}>{tr("Cancel")}</Text>
                                    </Pressable>
                                </View>
                            ))}
                        </View>
                    )}

                    <View style={styles.searchRow}>
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder={tr("Search by name or tag")}
                            placeholderTextColor={T.textFaint}
                            style={[styles.input, { flex: 1, marginTop: 0 }]}
                            autoCapitalize="none"
                        />
                    </View>

                    {!searchResults && suggested.length > 0 && (
                        <>
                            <Text style={styles.sectionTitle}>{tr("Suggested for you")}</Text>
                            <Text style={styles.sectionHint}>{tr("Clans close to your rating that you can join right now.")}</Text>
                            {suggested.map((clan) => (
                                <ClanCard key={clan.id} clan={clan} onPress={() => openPreview(clan)} />
                            ))}
                        </>
                    )}

                    <Text style={styles.sectionTitle}>{searchResults ? tr("Search results") : tr("Top clans")}</Text>
                    {listed.length === 0 && (
                        <Text style={styles.emptyText}>
                            {searchResults ? tr("No clan found with that name.") : tr("No clans yet - be the first to found one.")}
                        </Text>
                    )}
                    {listed.map((clan, index) => (
                        <ClanCard key={clan.id} clan={clan} rank={searchResults ? undefined : clan.rank ?? index + 1} onPress={() => openPreview(clan)} />
                    ))}

                    {!isGuest && (
                        <Pressable onPress={() => setCreateOpen(true)} style={[styles.primaryButton, { marginTop: 18 }]}>
                            <Text style={styles.primaryButtonText}>{tr("Found your own clan")}</Text>
                        </Pressable>
                    )}
                </ScrollView>
            </View>

            {previewModal}

            {/* Clan gründen */}
            <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
                <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                    <View style={styles.modalCard}>
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <Text style={styles.modalTitle}>{tr("Found a clan")}</Text>
                            <SettingsForm draft={createDraft} onChange={setCreateDraft} withName />
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <Pressable onPress={() => setCreateOpen(false)} style={styles.secondaryButton}>
                                <Text style={styles.secondaryButtonText}>{tr("Cancel")}</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleCreate}
                                disabled={createBusy || createDraft.name.trim().length < 3}
                                style={[styles.primaryButton, styles.modalPrimary, (createBusy || createDraft.name.trim().length < 3) && { opacity: 0.45 }]}
                            >
                                <Text style={styles.primaryButtonText}>{createBusy ? tr("Creating…") : tr("Create clan")}</Text>
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,12,16,0.62)" },
    page: { flex: 1, paddingTop: 44 },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    content: { paddingHorizontal: 16, paddingBottom: 48 },

    header: { height: 62, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: T.cardSolid, borderWidth: 1, borderColor: T.border, justifyContent: "center", alignItems: "center" },
    backText: { color: T.text, fontSize: 30, lineHeight: 32, fontWeight: "300" },
    headerTitle: { color: T.text, fontSize: 16, fontWeight: "700" },

    pageTitle: { color: T.text, fontSize: 26, fontWeight: "800", marginTop: 4 },
    pageSubtitle: { color: T.textDim, fontSize: 14, marginTop: 4, marginBottom: 16, lineHeight: 20 },
    sectionTitle: { color: T.text, fontSize: 17, fontWeight: "800", marginTop: 20, marginBottom: 10 },
    sectionHint: { color: T.textFaint, fontSize: 12.5, marginBottom: 10, marginTop: -4 },
    emptyText: { color: T.textDim, fontSize: 13.5, paddingVertical: 8 },

    card: { backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 16, marginTop: 12 },
    cardTitle: { color: T.text, fontSize: 15.5, fontWeight: "800", marginBottom: 8 },
    noticeCard: { backgroundColor: T.accentSoft, borderRadius: 14, borderWidth: 1, borderColor: T.accentBorder, padding: 12, marginBottom: 4 },
    noticeText: { color: "#BFD9EF", fontSize: 13.5, lineHeight: 19 },
    errorCard: { backgroundColor: T.redSoft, borderRadius: 14, borderWidth: 1, borderColor: "rgba(217,83,79,0.4)", padding: 12, marginBottom: 8 },
    errorText: { color: "#F2B5B2", fontSize: 13.5 },
    errorRetry: { color: "#F2B5B2", fontSize: 12, fontWeight: "700", marginTop: 4 },
    searchRow: { flexDirection: "row", marginTop: 14 },

    // Hero
    hero: { backgroundColor: T.card, borderRadius: 22, borderWidth: 1, borderColor: T.border, padding: 16 },
    heroTop: { flexDirection: "row", alignItems: "center", gap: 14 },
    heroName: { color: T.text, fontSize: 21, fontWeight: "800" },
    heroTag: { color: T.textFaint, fontSize: 14, fontWeight: "700" },
    heroPills: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" },
    typePill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(237,240,243,0.07)", borderWidth: 1, borderColor: T.border },
    typePillText: { color: T.textDim, fontSize: 11.5, fontWeight: "700" },
    heroDescription: { color: T.textDim, fontSize: 13.5, lineHeight: 19.5, marginTop: 12 },
    statRow: { flexDirection: "row", alignItems: "center", marginTop: 14, backgroundColor: "rgba(237,240,243,0.04)", borderRadius: 14, paddingVertical: 10 },
    stat: { flex: 1, alignItems: "center" },
    statDivider: { width: 1, height: 26, backgroundColor: T.border },
    statValue: { color: T.text, fontSize: 19, fontWeight: "800", fontVariant: ["tabular-nums"] },
    statValueDim: { color: T.textFaint, fontSize: 13, fontWeight: "700" },
    statLabel: { color: T.textFaint, fontSize: 10.5, fontWeight: "700", marginTop: 1, letterSpacing: 0.3 },
    leagueBlock: { marginTop: 14 },
    leagueLabels: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 },
    leagueName: { fontSize: 13, fontWeight: "800" },
    leagueNext: { color: T.textFaint, fontSize: 11.5, fontWeight: "600" },
    leagueTrack: { height: 7, borderRadius: 4, backgroundColor: "rgba(237,240,243,0.08)", overflow: "hidden" },
    leagueFill: { height: "100%", borderRadius: 4 },

    // Tabs
    tabs: { flexDirection: "row", backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 4, marginTop: 14, marginBottom: 14, gap: 4 },
    tab: { flex: 1, flexDirection: "row", gap: 6, paddingVertical: 10, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    tabActive: { backgroundColor: T.accent },
    tabText: { color: T.textDim, fontSize: 13.5, fontWeight: "700" },
    tabTextActive: { color: "#FFFFFF" },
    tabBadge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: "#D9534F", alignItems: "center", justifyContent: "center" },
    tabBadgeText: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "800" },

    // Members
    memberRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border, padding: 11, marginBottom: 8 },
    memberNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    memberName: { color: T.text, fontSize: 15, fontWeight: "700", flexShrink: 1 },
    youText: { color: T.textFaint, fontSize: 11.5, fontWeight: "700" },
    rankChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: T.accentSoft },
    rankChipLeader: { backgroundColor: T.goldSoft },
    rankChipText: { color: "#9CC3E6", fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
    memberStatus: { color: T.textFaint, fontSize: 12, marginTop: 2 },
    memberRating: { color: T.text, fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] },
    memberRatingLabel: { color: T.textFaint, fontSize: 8.5, fontWeight: "800", letterSpacing: 0.6 },
    challengeButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: T.accent },
    challengeButtonText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "800" },
    leaveButton: { marginTop: 14, paddingVertical: 13, borderRadius: 13, borderWidth: 1, borderColor: "rgba(217,83,79,0.4)", backgroundColor: T.redSoft, alignItems: "center" },
    leaveButtonText: { color: "#F08A86", fontSize: 14, fontWeight: "700" },

    // Chat
    chatBox: { backgroundColor: "rgba(10,12,16,0.55)", borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 12, minHeight: 220 },
    systemMessage: { color: T.textFaint, fontSize: 11.5, textAlign: "center", marginVertical: 6 },
    bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginVertical: 3 },
    bubble: { maxWidth: "78%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
    bubbleOther: { backgroundColor: T.raised, borderBottomLeftRadius: 5 },
    bubbleMine: { backgroundColor: "#3F6E99", borderBottomRightRadius: 5 },
    bubbleSender: { color: "#9CC3E6", fontSize: 11.5, fontWeight: "800", marginBottom: 2 },
    bubbleText: { color: T.text, fontSize: 14, lineHeight: 19.5 },
    chatInputBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 22, backgroundColor: "rgba(11,13,17,0.94)", borderTopWidth: 1, borderTopColor: T.border },

    // Rows with actions
    requestRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
    smallAccept: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: T.accent },
    smallAcceptText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
    smallDecline: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: "rgba(237,240,243,0.07)" },
    smallDeclineText: { color: T.textDim, fontSize: 13, fontWeight: "800" },
    inlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    inlineButton: { paddingHorizontal: 16, height: 44, borderRadius: 12, backgroundColor: T.accent, alignItems: "center", justifyContent: "center" },
    inlineButtonText: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "800" },

    // Form
    formPreview: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "rgba(237,240,243,0.04)", borderRadius: 16, padding: 12, marginBottom: 4 },
    formPreviewName: { color: T.text, fontSize: 17, fontWeight: "800" },
    formPreviewMeta: { color: T.textDim, fontSize: 12.5, marginTop: 3 },
    label: { color: T.textDim, fontSize: 12.5, fontWeight: "700", marginTop: 14, marginBottom: 6 },
    hint: { color: T.textFaint, fontSize: 12, marginTop: 6, lineHeight: 17 },
    input: { backgroundColor: T.raised, borderRadius: 12, borderWidth: 1, borderColor: T.border, paddingHorizontal: 12, paddingVertical: 11, color: T.text, fontSize: 14, marginTop: 0 },
    segment: { flexDirection: "row", backgroundColor: T.raised, borderRadius: 12, borderWidth: 1, borderColor: T.border, padding: 3, gap: 3 },
    segmentItem: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
    segmentItemActive: { backgroundColor: T.accent },
    segmentText: { color: T.textDim, fontSize: 12.5, fontWeight: "700" },
    segmentTextActive: { color: "#FFFFFF" },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border },
    chipActive: { backgroundColor: T.accentSoft, borderColor: T.accent },
    chipText: { color: T.textDim, fontSize: 12.5, fontWeight: "700", fontVariant: ["tabular-nums"] },
    chipTextActive: { color: "#BFD9EF" },
    emblemChoice: { width: 44, height: 44, borderRadius: 12, backgroundColor: T.raised, borderWidth: 1.5, borderColor: T.border, alignItems: "center", justifyContent: "center" },
    colorChoice: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "transparent" },
    colorChoiceActive: { borderColor: "#FFFFFF" },

    primaryButton: { backgroundColor: T.accent, paddingVertical: 14, borderRadius: 14, alignItems: "center", marginTop: 16 },
    primaryButtonText: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "800" },
    secondaryButton: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14, backgroundColor: "rgba(237,240,243,0.07)", alignItems: "center" },
    secondaryButtonText: { color: T.text, fontSize: 14.5, fontWeight: "700" },

    heroInfo: {
        position: "absolute",
        top: 12,
        right: 12,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(237,240,243,0.08)",
        zIndex: 2,
    },
    heroInfoText: { color: T.textDim, fontSize: 13, fontWeight: "800", fontStyle: "italic" },
    infoHead: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 10, marginTop: 4 },
    infoSub: { color: T.textDim, fontSize: 13, marginTop: 3 },
    infoTable: { backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border, paddingHorizontal: 14, marginTop: 12 },
    infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, gap: 12 },
    infoRowDivider: { borderTopWidth: 1, borderTopColor: T.border },
    infoLabel: { color: T.textDim, fontSize: 13.5 },
    infoValue: { color: T.text, fontSize: 14, fontWeight: "700", flexShrink: 1, textAlign: "right" },
    leagueRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: T.border,
        marginBottom: 6,
    },
    leagueDot: { width: 10, height: 10, borderRadius: 5 },
    leagueRowName: { color: T.text, fontSize: 14.5, fontWeight: "700", flex: 1 },
    leagueRowMin: { color: T.textDim, fontSize: 12.5 },

    // Modals
    modalBackdrop: { flex: 1, backgroundColor: "rgba(4,6,9,0.8)", justifyContent: "center", padding: 14 },
    modalCard: { maxHeight: "88%", backgroundColor: T.bg, borderRadius: 24, borderWidth: 1, borderColor: T.borderStrong, padding: 14 },
    modalTitle: { color: T.text, fontSize: 20, fontWeight: "800", marginBottom: 12, marginTop: 4, marginLeft: 2 },
    modalActions: { flexDirection: "row", gap: 10, marginTop: 12 },
    modalPrimary: { flex: 1, marginTop: 0 },

    sheetBackdrop: { flex: 1, backgroundColor: "rgba(4,6,9,0.72)", justifyContent: "flex-end" },
    sheet: { backgroundColor: T.cardSolid, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: T.borderStrong, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 28 },
    sheetHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
    sheetName: { color: T.text, fontSize: 18, fontWeight: "800" },
    sheetPrimary: { backgroundColor: T.accent, paddingVertical: 14, borderRadius: 14, alignItems: "center", marginBottom: 6 },
    sheetPrimaryText: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "800" },
    sheetItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border },
    sheetItemText: { color: T.text, fontSize: 15, fontWeight: "600" },
});
