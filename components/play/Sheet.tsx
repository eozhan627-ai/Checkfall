import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "../ui/theme";
import { tr } from "../../lib/i18n";

type Props = {
    visible: boolean;
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: React.ReactNode;
    /** Buttons that stay visible below the scrolling content. */
    footer?: React.ReactNode;
};

/** Panel that slides up from the bottom; tapping the dark area closes it. */
export default function Sheet({ visible, title, subtitle, onClose, children, footer }: Props) {
    const insets = useSafeAreaInsets();

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <View style={styles.root}>
                <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={tr("Close")} />

                <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
                    <View style={styles.handle} />

                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.title}>{title}</Text>
                            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                        </View>
                        <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
                            <Text style={styles.closeText}>✕</Text>
                        </Pressable>
                    </View>

                    <ScrollView
                        style={styles.scroll}
                        contentContainerStyle={styles.content}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {children}
                    </ScrollView>

                    {footer ? <View style={styles.footer}>{footer}</View> : null}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end" },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(4,6,9,0.72)" },
    panel: {
        maxHeight: "88%",
        backgroundColor: "#14181E",
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: T.borderStrong,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(237,240,243,0.18)", marginBottom: 14 },
    header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
    title: { color: T.text, fontSize: 21, fontWeight: "700", letterSpacing: -0.4 },
    subtitle: { color: T.textDim, fontSize: 13.5, marginTop: 4, lineHeight: 19 },
    close: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(237,240,243,0.07)",
        marginLeft: 12,
    },
    closeText: { color: T.textDim, fontSize: 14, fontWeight: "700" },
    scroll: { flexGrow: 0 },
    content: { paddingBottom: 8 },
    footer: { paddingTop: 14 },
});
