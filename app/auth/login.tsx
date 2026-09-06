import { makeRedirectUri } from "expo-auth-session";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, {
    useEffect,
    useRef,
    useState,
} from "react";
import {
    Alert,
    Animated,
    BackHandler,
    ImageBackground,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import {
    createGuestAccount,
    getAccountByAuthId,
    getCurrentAccount,
    saveAccount,
} from "../../lib/account";
import { supabase } from "../../lib/supabase";
WebBrowser.maybeCompleteAuthSession();
export default function LoginPage() {
    const router = useRouter();
    const [error, setError] =
        useState<string | null>(null);
    const [loading, setLoading] =
        useState(true);
    const [googleLoading, setGoogleLoading] =
        useState(false);
    const [termsVisible, setTermsVisible] =
        useState(false);
    const [termsAccepted, setTermsAccepted] =
        useState(false);
    const [termsForGuest, setTermsForGuest] =
        useState(false);
    const backgroundImage = require(
        "../../assets/images/loginbackground.png"
    );
    // =============================
    // ANIMATIONS
    // =============================
    const appear = useRef(
        new Animated.Value(0)
    ).current;
    const scale = useRef(
        new Animated.Value(0.96)
    ).current;
    const float = useRef(
        new Animated.Value(0)
    ).current;
    const shake = useRef(
        new Animated.Value(0)
    ).current;
    // =============================
    // START
    // =============================
    useEffect(() => {
        checkCurrentAccount();
    }, []);
    // =============================
    // ANDROID BACK
    // =============================
    useEffect(() => {
        const subscription =
            BackHandler.addEventListener(
                "hardwareBackPress",
                () => {
                    // Auf der Login-Seite nicht
                    // zurück in einen alten
                    // eingeloggten Screen gehen.
                    return true;
                }
            );
        return () => {
            subscription.remove();
        };
    }, []);
    // =============================
    // CHECK CURRENT ACCOUNT
    // =============================
    async function checkCurrentAccount() {
        try {
            console.log(
                "LOGIN: checking local account..."
            );
            const acc =
                await getCurrentAccount();
            console.log(
                "LOGIN: local account =",
                acc
            );
            if (acc) {
                console.log(
                    "LOGIN: existing account → /"
                );
                router.replace("/");
                return;
            }
            console.log(
                "LOGIN: no local account"
            );
            setLoading(false);
        } catch (e) {
            console.error(
                "ACCOUNT CHECK ERROR:",
                e
            );
            setLoading(false);
        }
    }
    // =============================
    // ANIMATION
    // =============================
    useEffect(() => {
        Animated.parallel([
            Animated.timing(appear, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.timing(scale, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
        ]).start(() => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(float, {
                        toValue: 1,
                        duration: 2200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(float, {
                        toValue: 0,
                        duration: 2200,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        });
    }, []);
    // =============================
    // SHAKE
    // =============================
    function triggerShake() {
        shake.setValue(0);
        Animated.sequence([
            Animated.timing(shake, {
                toValue: 1,
                duration: 50,
                useNativeDriver: true,
            }),
            Animated.timing(shake, {
                toValue: -1,
                duration: 50,
                useNativeDriver: true,
            }),
            Animated.timing(shake, {
                toValue: 0,
                duration: 50,
                useNativeDriver: true,
            }),
        ]).start();
    }
    function resetError() {
        if (error) {
            setError(null);
        }
    }
    // =============================
    // TERMS
    // =============================
    function openTerms() {
        setTermsForGuest(false);
        setTermsVisible(true);
    }

    function openGuestTerms() {
        setTermsForGuest(true);
        setTermsVisible(true);
    }

    function acceptTerms() {
        setTermsAccepted(true);
        setTermsVisible(false);
        // Erst nach Zustimmung Google Login starten.
        handleGoogleLogin();
    }
    function acceptGuestTerms() {
        setTermsAccepted(true);
        setTermsVisible(false);
        // Erst nach Zustimmung Guest Login starten.
        handleGuest();
    }
    // =============================
    // GOOGLE LOGIN
    // =============================
    async function handleGoogleLogin() {
        try {
            resetError();
            setGoogleLoading(true);
            console.log(
                "================================="
            );
            console.log(
                "GOOGLE LOGIN START"
            );
            console.log(
                "================================="
            );
            // ---------------------------------
            // REDIRECT URL
            // ---------------------------------
            const redirectTo =
                makeRedirectUri({
                    scheme: "povcheck",
                    path: "/auth/callback",
                    isTripleSlashed: false,
                });
            console.log(
                "GOOGLE REDIRECT:",
                redirectTo
            );
            // ---------------------------------
            // REQUEST OAUTH URL
            // ---------------------------------
            const {
                data,
                error: oauthError,
            } =
                await supabase.auth.signInWithOAuth(
                    {
                        provider: "google",
                        options: {
                            redirectTo,
                            skipBrowserRedirect:
                                true,
                        },
                    }
                );
            console.log(
                "GOOGLE: signInWithOAuth finished"
            );
            console.log(
                "GOOGLE OAUTH ERROR:",
                oauthError
            );
            if (oauthError) {
                throw oauthError;
            }
            if (!data?.url) {
                throw new Error(
                    "No Google authentication URL received."
                );
            }
            // ---------------------------------
            // OPEN GOOGLE
            // ---------------------------------
            const result =
                await WebBrowser.openAuthSessionAsync(
                    data.url,
                    redirectTo
                );
            // ---------------------------------
            // RESULT
            // ---------------------------------
            console.log(
                "GOOGLE RESULT:",
                result
            );
            if (
                result.type !== "success" ||
                typeof result.url !== "string"
            ) {
                console.log(
                    "GOOGLE: authentication cancelled."
                );
                setGoogleLoading(false);
                return;
            }
            const callbackUrl =
                result.url;
            console.log(
                "GOOGLE CALLBACK RECEIVED"
            );
            // ---------------------------------
            // HASH
            // ---------------------------------
            const hashIndex =
                callbackUrl.indexOf("#");
            if (hashIndex === -1) {
                throw new Error(
                    "Google authentication returned without authentication tokens."
                );
            }
            const hash =
                callbackUrl.substring(
                    hashIndex + 1
                );
            const hashParams =
                new URLSearchParams(hash);
            const accessToken =
                hashParams.get(
                    "access_token"
                );
            const refreshToken =
                hashParams.get(
                    "refresh_token"
                );
            console.log(
                "GOOGLE ACCESS TOKEN:",
                accessToken
                    ? "FOUND"
                    : "MISSING"
            );
            console.log(
                "GOOGLE REFRESH TOKEN:",
                refreshToken
                    ? "FOUND"
                    : "MISSING"
            );
            // ---------------------------------
            // TOKEN CHECK
            // ---------------------------------
            if (
                !accessToken ||
                !refreshToken
            ) {
                const callbackError =
                    hashParams.get(
                        "error_description"
                    ) ||
                    hashParams.get(
                        "error"
                    );
                throw new Error(
                    callbackError ||
                    "Google authentication did not return valid session tokens."
                );
            }
            // ---------------------------------
            // SET SUPABASE SESSION
            // ---------------------------------
            const {
                data: sessionData,
                error: sessionError,
            } =
                await supabase.auth.setSession(
                    {
                        access_token:
                            accessToken,
                        refresh_token:
                            refreshToken,
                    }
                );
            console.log(
                "GOOGLE SESSION:",
                sessionData.session
                    ? "SESSION CREATED"
                    : "NO SESSION"
            );
            if (sessionError) {
                throw sessionError;
            }
            // ---------------------------------
            // GET USER
            // ---------------------------------
            const {
                data: userData,
                error: userError,
            } =
                await supabase.auth.getUser();
            if (userError) {
                throw userError;
            }
            const user =
                userData.user;
            if (!user) {
                throw new Error(
                    "Google login completed, but no user was found."
                );
            }
            console.log(
                "GOOGLE USER ID:",
                user.id
            );
            console.log(
                "GOOGLE USER EMAIL:",
                user.email
            );
            // =================================
            // 1. LOCAL ACCOUNT CHECK
            // =================================
            console.log(
                "GOOGLE: checking local account..."
            );
            const existingLocalAccount =
                await getAccountByAuthId(
                    user.id
                );
            if (existingLocalAccount) {
                console.log(
                    "GOOGLE: LOCAL ACCOUNT FOUND"
                );
                await saveAccount({
                    username:
                        existingLocalAccount.username,
                    guest: false,
                    authId: user.id,
                    avatar:
                        existingLocalAccount.avatar,
                    rating:
                        existingLocalAccount.rating ??
                        1000,
                });
                setGoogleLoading(false);
                router.replace("/");
                return;
            }
            // =================================
            // 2. SUPABASE PROFILE CHECK
            // =================================
            //
            // Wichtig für neues Gerät:
            //
            // AsyncStorage ist auf Gerät B leer.
            // Das Profil existiert aber bereits
            // zentral in Supabase.
            //
            // Deshalb prüfen wir jetzt
            // profiles.id = user.id.
            // =================================
            console.log(
                "GOOGLE: checking Supabase profile..."
            );
            const {
                data: profile,
                error: profileError,
            } =
                await supabase
                    .from("profiles")
                    .select(
                        "id, username, rating, avatar"
                    )
                    .eq("id", user.id)
                    .maybeSingle();
            if (profileError) {
                throw profileError;
            }
            // =================================
            // 3. EXISTING SUPABASE PROFILE
            // =================================
            if (profile) {
                console.log(
                    "GOOGLE: SUPABASE PROFILE FOUND"
                );
                console.log(
                    "GOOGLE: USERNAME:",
                    profile.username
                );
                console.log(
                    "GOOGLE: restoring profile locally..."
                );
                // Profil vom Server auf dieses
                // Gerät übertragen.
                await saveAccount({
                    username:
                        profile.username,
                    guest: false,
                    authId: user.id,
                    avatar:
                        profile.avatar ??
                        undefined,
                    rating:
                        typeof profile.rating ===
                            "number"
                            ? profile.rating
                            : 1000,
                });
                console.log(
                    "GOOGLE: profile restored"
                );
                console.log(
                    "GOOGLE: going directly to app"
                );
                setGoogleLoading(false);
                router.replace("/");
                return;
            }
            // =================================
            // 4. REALLY NEW ACCOUNT
            // =================================
            console.log(
                "GOOGLE: NO LOCAL ACCOUNT"
            );
            console.log(
                "GOOGLE: NO SUPABASE PROFILE"
            );
            console.log(
                "GOOGLE: first login → onboarding"
            );
            // Noch NICHT saveAccount().
            //
            // Der Username wird erst im
            // Onboarding festgelegt.
            setGoogleLoading(false);
            router.replace(
                "/auth/onboarding"
            );
        } catch (e: any) {
            console.error(
                "================================="
            );
            console.error(
                "GOOGLE LOGIN ERROR:",
                e
            );
            console.error(
                "================================="
            );
            setGoogleLoading(false);
            setError(
                e?.message ||
                "Google login failed."
            );
            triggerShake();
        }
    }
    // =============================
    // GUEST
    // =============================
    async function handleGuest() {
        try {
            resetError();

            console.log("GUEST LOGIN START");

            const account = await createGuestAccount();

            console.log(
                "GUEST CREATED:",
                account.username
            );

            console.log(
                "GUEST → SKILL LEVEL"
            );

            router.replace("/auth/skillLevel");
        } catch (e) {
            console.error(
                "GUEST LOGIN ERROR:",
                e
            );

            Alert.alert(
                "Error",
                "Could not continue as guest."
            );
        }
    }
    // =============================
    // LOADING
    // =============================
    if (loading) {
        return (
            <View style={styles.loading}>
                <Text
                    style={
                        styles.loadingText
                    }
                >
                    Loading...
                </Text>
            </View>
        );
    }
    // =============================
    // UI
    // =============================
    return (
        <ImageBackground
            source={backgroundImage}
            style={styles.bg}
            resizeMode="cover"
        >
            <View style={styles.overlay} />
            <View style={styles.root}>
                <Animated.View
                    style={{
                        opacity: appear,
                        transform: [
                            {
                                scale,
                            },
                        ],
                        width: "100%",
                        alignItems:
                            "center",
                    }}
                >
                    <Animated.View
                        style={{
                            transform: [
                                {
                                    translateY:
                                        float.interpolate(
                                            {
                                                inputRange:
                                                    [
                                                        0,
                                                        1,
                                                    ],
                                                outputRange:
                                                    [
                                                        0,
                                                        -6,
                                                    ],
                                            }
                                        ),
                                },
                            ],
                        }}
                    >
                        <Animated.View
                            style={{
                                transform: [
                                    {
                                        translateX:
                                            shake.interpolate(
                                                {
                                                    inputRange:
                                                        [
                                                            -1,
                                                            1,
                                                        ],
                                                    outputRange:
                                                        [
                                                            -8,
                                                            8,
                                                        ],
                                                }
                                            ),
                                    },
                                ],
                                width: "100%",
                                alignItems:
                                    "center",
                            }}
                        >
                            <BlurView
                                intensity={35}
                                tint="dark"
                                style={
                                    styles.card
                                }
                            >
                                {/* LOGO */}
                                <Text
                                    style={
                                        styles.logo
                                    }
                                >
                                    POV
                                    <Text
                                        style={
                                            styles.logoAccent
                                        }
                                    >
                                        Check
                                    </Text>
                                </Text>
                                <Text
                                    style={
                                        styles.subtitle
                                    }
                                >
                                    Play. Learn. Improve.
                                </Text>
                                {/* GOOGLE */}
                                <Pressable
                                    style={[
                                        styles.googleButton,
                                        googleLoading &&
                                        styles.disabled,
                                    ]}
                                    onPress={
                                        openTerms
                                    }
                                    disabled={
                                        googleLoading
                                    }
                                >
                                    <Text
                                        style={
                                            styles.googleIcon
                                        }
                                    >
                                        G
                                    </Text>
                                    <Text
                                        style={
                                            styles.googleText
                                        }
                                    >
                                        {googleLoading
                                            ? "Connecting..."
                                            : "Continue with Google"}
                                    </Text>
                                </Pressable>
                                {/* ERROR */}
                                {error && (
                                    <Text
                                        style={
                                            styles.error
                                        }
                                    >
                                        {error}
                                    </Text>
                                )}
                                {/* DIVIDER */}
                                <View
                                    style={
                                        styles.dividerRow
                                    }
                                >
                                    <View
                                        style={
                                            styles.divider
                                        }
                                    />
                                    <Text
                                        style={
                                            styles.orText
                                        }
                                    >
                                        or
                                    </Text>
                                    <View
                                        style={
                                            styles.divider
                                        }
                                    />
                                </View>
                                {/* GUEST */}
                                <Pressable
                                    style={
                                        styles.guestButton}
                                    onPress={
                                        openGuestTerms
                                    }
                                >
                                    <Text
                                        style={
                                            styles.guestText
                                        }
                                    >
                                        Continue as guest
                                    </Text>
                                </Pressable>
                                {/* TERMS */}
                                <View style={styles.termsContainer}>
                                    <Text style={styles.terms}>
                                        By continuing, you agree to our
                                    </Text>

                                    <Pressable onPress={openTerms}>
                                        <Text style={styles.termsLink}>
                                            Terms of Service  </Text>
                                    </Pressable>

                                    <Text style={styles.terms}>
                                        and
                                    </Text>

                                    <Pressable onPress={openTerms}>
                                        <Text style={styles.termsLink}>
                                            Privacy Policy. </Text>
                                    </Pressable>
                                </View>
                            </BlurView>
                        </Animated.View>
                    </Animated.View>
                </Animated.View>
            </View>
            {/* ================================= */}
            {/* TERMS MODAL */}
            {/* ================================= */}
            <Modal
                visible={termsVisible}
                transparent
                animationType="fade"
                onRequestClose={() =>
                    setTermsVisible(false)
                }
            >
                <View
                    style={
                        styles.modalOverlay
                    }
                >
                    <View
                        style={
                            styles.termsModal
                        }
                    >
                        <Text
                            style={
                                styles.modalTitle
                            }
                        >
                            Welcome to POVCheck
                        </Text>
                        <Text
                            style={
                                styles.modalSubtitle
                            }
                        >
                            Before continuing, please
                            review and accept our Terms
                            of Service and Privacy Policy.
                        </Text>
                        <Pressable
                            style={
                                styles.modalDocument
                            }
                            onPress={() =>
                                router.push(
                                    "/terms"
                                )
                            }
                        >
                            <Text
                                style={
                                    styles.modalDocumentTitle
                                }
                            >
                                Terms of Service
                            </Text>
                            <Text
                                style={
                                    styles.modalDocumentArrow
                                }
                            >
                                ›
                            </Text>
                        </Pressable>
                        <Pressable
                            style={
                                styles.modalDocument
                            }
                            onPress={() =>
                                router.push(
                                    "/privacypolicy"
                                )
                            }
                        >
                            <Text
                                style={
                                    styles.modalDocumentTitle
                                }
                            >
                                Privacy Policy
                            </Text>
                            <Text
                                style={
                                    styles.modalDocumentArrow
                                }
                            >
                                ›
                            </Text>
                        </Pressable>
                        <Pressable
                            style={
                                styles.acceptButton
                            }
                            onPress={
                                termsForGuest
                                    ? acceptGuestTerms
                                    : acceptTerms
                            }
                        >
                            <Text
                                style={
                                    styles.acceptText
                                }
                            >
                                Agree & Continue
                            </Text>
                        </Pressable>
                        <Pressable
                            style={
                                styles.cancelButton
                            }
                            onPress={() =>
                                setTermsVisible(
                                    false
                                )
                            }
                        >
                            <Text
                                style={
                                    styles.cancelText
                                }
                            >
                                Cancel
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </ImageBackground>
    );
}
// =============================
// STYLES
// =============================
const styles = StyleSheet.create({
    bg: {
        flex: 1,
        width: "100%",
        height: "100%",
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor:
            "rgba(0,0,0,0.55)",
    },
    root: {
        flex: 1,
        justifyContent:
            "center",
        alignItems:
            "center",
        paddingHorizontal: 20,
    },
    card: {
        width: "100%",
        maxWidth: 380,
        borderRadius: 22,
        paddingHorizontal: 28,
        paddingVertical: 34,
        overflow: "hidden",
        borderWidth: 1,
        borderColor:
            "rgba(255,255,255,0.15)",
    },
    logo: {
        fontSize: 31,
        fontWeight: "700",
        color: "#fff",
        textAlign: "center",
        letterSpacing: -1,
    },
    logoAccent: {
        color: "#8FAE7C",
    },
    subtitle: {
        fontSize: 14,
        color: "#aaa",
        textAlign: "center",
        marginTop: 6,
        marginBottom: 28,
    },
    googleButton: {
        height: 52,
        borderRadius: 13,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        marginBottom: 12,
    },
    googleIcon: {
        fontSize: 18,
        fontWeight: "900",
        color: "#4285F4",
        marginRight: 10,
    },
    googleText: {
        color: "#111",
        fontSize: 14,
        fontWeight: "800",
    },
    disabled: {
        opacity: 0.6,
    },
    dividerRow: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 8,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor:
            "rgba(255,255,255,0.10)",
    },
    orText: {
        color: "#777",
        fontSize: 12.5,
        fontWeight: "500",
        marginHorizontal: 12,
    },
    guestButton: {
        height: 45,
        alignItems: "center",
        justifyContent: "center",
    },
    guestText: {
        color: "#888",
        fontSize: 13,
        fontWeight: "600",
    },
    error: {
        color: "#ff5b5b",
        fontSize: 12,
        textAlign: "center",
        marginTop: 4,
        marginBottom: 8,
        fontWeight: "600",
    },
    terms: {
        color: "#666",
        fontSize: 11,
        lineHeight: 15,
        textAlign: "center",
        marginTop: 20,
        marginRight: 4,
    },
    termsLink: {
        color: "#aaa",
        fontSize: 11,
        lineHeight: 15,
        textDecorationLine:
            "underline",
        marginRight: 4,
    },
    termsContainer: {
        marginTop: 20,
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
    },
    loading: {
        flex: 1,
        backgroundColor: "#000",
        justifyContent:
            "center",
        alignItems:
            "center",
    },
    loadingText: {
        color: "#fff",
    },
    // =============================
    // TERMS MODAL
    // =============================
    modalOverlay: {
        flex: 1,
        backgroundColor:
            "rgba(0,0,0,0.72)",
        justifyContent:
            "center",
        alignItems:
            "center",
        paddingHorizontal: 22,
    },
    termsModal: {
        width: "100%",
        maxWidth: 390,
        borderRadius: 24,
        padding: 24,
        backgroundColor: "#111",
        borderWidth: 1,
        borderColor:
            "rgba(255,255,255,0.12)",
    },
    modalTitle: {
        color: "#fff",
        fontSize: 23,
        fontWeight: "700",
        marginBottom: 8,
    },
    modalSubtitle: {
        color: "#888",
        fontSize: 13,
        lineHeight: 20,
        marginBottom: 20,
    },
    modalDocument: {
        height: 58,
        borderRadius: 15,
        backgroundColor:
            "rgba(255,255,255,0.055)",
        borderWidth: 1,
        borderColor:
            "rgba(255,255,255,0.08)",
        flexDirection: "row",
        alignItems: "center",
        justifyContent:
            "space-between",
        paddingHorizontal: 17,
        marginBottom: 10,
    },
    modalDocumentTitle: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "700",
    },
    modalDocumentArrow: {
        color: "#8FAE7C",
        fontSize: 25,
    },
    acceptButton: {
        height: 52,
        borderRadius: 15,
        backgroundColor: "#8FAE7C",
        alignItems: "center",
        justifyContent:
            "center",
        marginTop: 12,
    },
    acceptText: {
        color: "#14201A",
        fontSize: 14,
        fontWeight: "700",
    },
    cancelButton: {
        height: 45,
        alignItems: "center",
        justifyContent:
            "center",
    },
    cancelText: {
        color: "#777",
        fontSize: 13,
        fontWeight: "700",
    },
});
