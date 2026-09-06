import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    ImageBackground,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View
} from "react-native";
import ProfileAvatar from "../components/ProfileAvatar";
import {
    AccountType,
    getCurrentAccount,
    updateAccount,
} from "../lib/account";
import { supabase } from "../lib/supabase";
export default function Profile() {
    const { width } = useWindowDimensions();
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
    const params = useLocalSearchParams();
    const externalName = params.name as string | undefined;
    const externalAvatar = params.avatar as string | undefined;
    const externalUserId = params.userId as string | undefined;
    const isForeignProfile = !!externalUserId;
    const backgroundImage = require("../assets/images/profilebackground.png");
    useEffect(() => {
        if (isForeignProfile) {
            setLoading(false);
            return;
        }
        (async () => {
            const acc = await getCurrentAccount();
            if (acc) {
                setAccount(acc);
                setUsername(acc.username);
                const storedHistory = await AsyncStorage.getItem("game_history");
                const history = storedHistory
                    ? JSON.parse(storedHistory)
                    : [];
                const onlineGames = history.filter(
                    (game: any) => game.mode === "online"
                );
                const wins = onlineGames.filter(
                    (game: any) => game.result === "win"
                ).length;
                setStats({
                    games: onlineGames.length,
                    wins,
                    puzzles: 0,
                    rating: acc.rating ?? 1000,
                });
            }
            setLoading(false);
        })();
    }, [isForeignProfile]);
    const changeAvatar = async () => {
        if (!account?.id) return;
        const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert(
                "Berechtigung benötigt",
                "Bitte erlaube den Zugriff auf deine Fotos."
            );
            return;
        }
        const result =
            await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });
        if (result.canceled) return;
        const asset = result.assets[0];
        const formData = new FormData();
        formData.append("userId", account.id);
        formData.append("avatar", {
            uri: asset.uri,
            type: asset.mimeType || "image/jpeg",
            name: asset.fileName || "avatar.jpg",
        } as any);
        try {
            const res = await fetch(
                "https://checkfall-server-clean-1.onrender.com/upload-avatar",
                {
                    method: "POST",
                    body: formData,
                }
            );
            const data = await res.json();
            if (!res.ok) {
                throw new Error(
                    data?.error || `Upload failed: ${res.status}`
                );
            }
            if (!data.url) {
                throw new Error("Server returned no avatar URL");
            }
            const updated = await updateAccount(account.id, {
                avatar: data.url,
            });
            if (updated) {
                setAccount(updated);
            }
        } catch (error) {
            console.log("AVATAR ERROR:", error);
            Alert.alert(
                "Fehler",
                "Das Profilbild konnte nicht gespeichert werden."
            );
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
    const logout = async () => {
        Alert.alert(
            "Abmelden",
            "Möchtest du dich wirklich abmelden?",
            [
                {
                    text: "Abbrechen",
                    style: "cancel",
                },
                {
                    text: "Abmelden",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            console.log("LOGOUT: starting...");
                            // Supabase-Session beenden
                            const { error } =
                                await supabase.auth.signOut();
                            if (error) {
                                console.error(
                                    "LOGOUT: Supabase signOut error:",
                                    error
                                );
                                throw error;
                            }
                            console.log(
                                "LOGOUT: Supabase session cleared"
                            );
                            // Lokales POVCheck-Konto löschen
                            await AsyncStorage.removeItem(
                                "@current_account"
                            );
                            console.log(
                                "LOGOUT: local account cleared"
                            );
                            // Zur Login-Seite
                            router.replace("/auth/login");
                        } catch (error) {
                            console.error(
                                "LOGOUT ERROR:",
                                error
                            );
                            Alert.alert(
                                "Fehler",
                                "Du konntest nicht abgemeldet werden."
                            );
                        }
                    },
                },
            ]
        );
    };
    if (loading) {
        return (
            <View style={styles.loading}>
                <Text style={styles.loadingText}>
                    Profil wird geladen...
                </Text>
            </View>
        );
    }
    const displayedName = isForeignProfile
        ? externalName || "Spieler"
        : account?.username || "Spieler";
    const displayedAvatar = isForeignProfile
        ? externalAvatar
        : account?.avatar;
    const avatarUri = displayedAvatar || "";
    return (
        <ImageBackground
            source={backgroundImage}
            style={styles.background}
            resizeMode="cover"
        >
            <View style={styles.darkOverlay} />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.container}
            >
                {/* HEADER */}
                <View style={styles.header}>
                    <Pressable
                        onPress={() => router.back()}
                        style={styles.backButton}
                    >
                        <Text style={styles.backText}>‹</Text>
                    </Pressable>
                    <Text style={styles.headerTitle}>
                        Profile
                    </Text>
                    <View style={{ width: 42 }} />
                </View>
                {/* PROFILE HERO */}
                <View style={styles.profileHero}>
                    <View style={styles.avatarContainer}>
                        <TouchableOpacity
                            disabled={isForeignProfile}
                            onPress={changeAvatar}
                        >
                            <ProfileAvatar
                                uri={avatarUri}
                                frame="silver"
                                size={150}
                            />
                        </TouchableOpacity>
                        {!isForeignProfile && (
                            <View style={styles.cameraBadge}>
                                <Text style={styles.cameraText}>
                                    ✎
                                </Text>
                            </View>
                        )}
                    </View>
                    {/* USERNAME */}
                    {isForeignProfile ? (
                        <Text style={styles.username}>
                            {displayedName}
                        </Text>
                    ) : editingName ? (
                        <View style={styles.editNameRow}>
                            <TextInput
                                value={username}
                                onChangeText={setUsername}
                                autoFocus
                                style={styles.usernameInput}
                                placeholder="Username"
                                placeholderTextColor="#777"
                            />
                            <Pressable
                                onPress={saveUsername}
                                style={styles.saveButton}
                            >
                                <Text style={styles.saveText}>
                                    ✓
                                </Text>
                            </Pressable>
                        </View>
                    ) : (
                        <Pressable
                            onPress={() => setEditingName(true)}
                        >
                            <Text style={styles.username}>
                                {displayedName}
                            </Text>
                        </Pressable>
                    )}
                </View>
                {/* STATS */}
                <View style={styles.statsContainer}>
                    <Stat
                        value={stats.games.toString()}
                        label="Games"
                    />
                    <View style={styles.statDivider} />
                    <Stat
                        value={stats.wins.toString()}
                        label="Wins"
                    />
                    <View style={styles.statDivider} />
                    <Stat
                        value={stats.puzzles.toString()}
                        label="Puzzles"
                    />
                </View>
                {/* CHESS RATING */}
                <View style={styles.ratingCard}>
                    <View>
                        <Text style={styles.smallLabel}>
                            Chess rating
                        </Text>
                        <Text style={styles.rating}>
                            {stats.rating.toString()}
                        </Text>
                    </View>
                    <View style={styles.ratingBadge}>
                        <Text style={styles.ratingBadgeText}>
                            ♔
                        </Text>
                    </View>
                </View>
                {/* ACCOUNT / ACTIONS */}
                {!isForeignProfile && (
                    <>
                        <Text style={styles.sectionTitle}>
                            Account
                        </Text>
                        <View style={styles.card}>
                            <ProfileAction
                                icon="◎"
                                title="Profilbild ändern"
                                subtitle="Wähle ein neues Profilbild"
                                onPress={changeAvatar}
                            />
                            <View style={styles.separator} />
                            <ProfileAction
                                icon="✎"
                                title="Username bearbeiten"
                                subtitle="Ändere deinen Anzeigenamen"
                                onPress={() =>
                                    setEditingName(true)
                                }
                            />
                        </View>
                        {/* LOGOUT */}
                        <Pressable
                            style={styles.logoutButton}
                            onPress={logout}
                        >
                            <Text style={styles.logoutText}>
                                Abmelden
                            </Text>
                        </Pressable>
                    </>
                )}
                {isForeignProfile && (
                    <>
                        <Text style={styles.sectionTitle}>
                            Player
                        </Text>
                        <View style={styles.card}>
                            <ProfileAction
                                icon="♟"
                                title="Schachprofil"
                                subtitle="Spielstatistiken und Rating"
                                onPress={() => { }}
                            />
                        </View>
                    </>
                )}
                <Text style={styles.version}>
                    POVCheck
                </Text>
            </ScrollView>
        </ImageBackground>
    );
}
function Stat({
    value,
    label,
}: {
    value: string;
    label: string;
}) {
    return (
        <View style={styles.stat}>
            <Text style={styles.statValue}>
                {value}
            </Text>
            <Text style={styles.statLabel}>
                {label}
            </Text>
        </View>
    );
}
function ProfileAction({
    icon,
    title,
    subtitle,
    onPress,
}: {
    icon: string;
    title: string;
    subtitle: string;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.action,
                pressed && { opacity: 0.65 },
            ]}
        >
            <View style={styles.actionIcon}>
                <Text style={styles.actionIconText}>
                    {icon}
                </Text>
            </View>
            <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>
                    {title}
                </Text>
                <Text style={styles.actionSubtitle}>
                    {subtitle}
                </Text>
            </View>
            <Text style={styles.chevron}>
                ›
            </Text>
        </Pressable>
    );
}
const styles = StyleSheet.create({
    background: {
        flex: 1,
        backgroundColor: "#16130F",
    },
    darkOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(22,19,15,0.62)",
    },
    loading: {
        flex: 1,
        backgroundColor: "#16130F",
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        color: "#aaa",
        fontSize: 15,
    },
    container: {
        paddingBottom: 60,
        alignItems: "center",
    },
    /* HEADER */
    header: {
        width: "100%",
        height: 70,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
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
    },
    /* HERO */
    profileHero: {
        alignItems: "center",
        paddingTop: 15,
        paddingBottom: 28,
    },
    avatarContainer: {
        position: "relative",
        marginBottom: 18,
    },
    cameraBadge: {
        position: "absolute",
        right: 0,
        bottom: 5,
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: "#7C9473",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 3,
        borderColor: "#16130F",
    },
    cameraText: {
        color: "#14201A",
        fontSize: 17,
        fontWeight: "700",
    },
    username: {
        color: "#F8F4EE",
        fontSize: 27,
        fontWeight: "700",
        letterSpacing: -0.4,
    },
    editNameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    usernameInput: {
        minWidth: 160,
        color: "#F8F4EE",
        fontSize: 24,
        fontWeight: "700",
        borderBottomWidth: 1,
        borderBottomColor: "#7C9473",
        paddingVertical: 4,
        textAlign: "center",
    },
    saveButton: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: "#7C9473",
        justifyContent: "center",
        alignItems: "center",
    },
    saveText: {
        color: "#14201A",
        fontSize: 20,
        fontWeight: "700",
    },
    /* STATS */
    statsContainer: {
        width: "90%",
        maxWidth: 430,
        minHeight: 95,
        borderRadius: 20,
        backgroundColor: "#201B16",
        borderWidth: 1,
        borderColor: "rgba(245,237,226,0.09)",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        marginBottom: 15,
    },
    stat: {
        flex: 1,
        alignItems: "center",
    },
    statValue: {
        color: "#F8F4EE",
        fontSize: 24,
        fontWeight: "700",
    },
    statLabel: {
        color: "rgba(239,232,222,0.5)",
        fontSize: 12,
        marginTop: 4,
    },
    statDivider: {
        width: 1,
        height: 38,
        backgroundColor: "rgba(245,237,226,0.09)",
    },
    /* RATING */
    ratingCard: {
        width: "90%",
        maxWidth: 430,
        borderRadius: 20,
        padding: 20,
        marginBottom: 30,
        backgroundColor: "#201B16",
        borderWidth: 1,
        borderColor: "rgba(245,237,226,0.09)",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    smallLabel: {
        color: "rgba(239,232,222,0.5)",
        fontSize: 12.5,
        marginBottom: 4,
    },
    rating: {
        color: "#F8F4EE",
        fontSize: 30,
        fontWeight: "700",
    },
    ratingBadge: {
        width: 54,
        height: 54,
        borderRadius: 17,
        backgroundColor: "rgba(124,148,115,0.14)",
        borderWidth: 1,
        borderColor: "rgba(124,148,115,0.3)",
        justifyContent: "center",
        alignItems: "center",
    },
    ratingBadgeText: {
        color: "#7C9473",
        fontSize: 26,
    },
    /* SECTIONS */
    sectionTitle: {
        width: "90%",
        maxWidth: 430,
        color: "rgba(245,239,230,0.85)",
        fontSize: 15,
        fontWeight: "600",
        marginBottom: 12,
    },
    card: {
        width: "90%",
        maxWidth: 430,
        borderRadius: 20,
        backgroundColor: "#201B16",
        borderWidth: 1,
        borderColor: "rgba(245,237,226,0.09)",
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    action: {
        minHeight: 72,
        flexDirection: "row",
        alignItems: "center",
    },
    actionIcon: {
        width: 42,
        height: 42,
        borderRadius: 13,
        backgroundColor: "rgba(124,148,115,0.14)",
        borderWidth: 1,
        borderColor: "rgba(124,148,115,0.24)",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 13,
    },
    actionIconText: {
        color: "#7C9473",
        fontSize: 18,
        fontWeight: "600",
    },
    actionContent: {
        flex: 1,
    },
    actionTitle: {
        color: "#F8F4EE",
        fontSize: 15,
        fontWeight: "600",
    },
    actionSubtitle: {
        color: "rgba(239,232,222,0.5)",
        fontSize: 12,
        marginTop: 3,
    },
    chevron: {
        color: "rgba(245,239,230,0.35)",
        fontSize: 25,
        fontWeight: "300",
    },
    separator: {
        height: 1,
        backgroundColor: "rgba(245,237,226,0.07)",
    },
    logoutButton: {
        width: "90%",
        maxWidth: 430,
        height: 50,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: "rgba(255,90,90,0.28)",
        backgroundColor: "rgba(255,60,60,0.08)",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 5,
    },
    logoutText: {
        color: "#ff6b6b",
        fontSize: 14,
        fontWeight: "600",
    },
    version: {
        marginTop: 30,
        color: "rgba(245,239,230,0.28)",
        fontSize: 11,
        letterSpacing: 1,
        fontWeight: "500",
    },
});
