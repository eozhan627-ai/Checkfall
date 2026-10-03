import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CLASSIFICATION_META, Classification } from "../../lib/analysis";

type Props = {
    classification: Classification;
    size?: number;
    /** White ring around the badge, for use on top of the board. */
    outlined?: boolean;
};

// Round coloured badge with the symbol of a move label ("!!", "?", "★" ...).
export default function ClassificationBadge({ classification, size = 22, outlined = false }: Props) {
    const meta = CLASSIFICATION_META[classification];
    const long = meta.icon.length > 1;

    return (
        <View
            style={[
                styles.badge,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: meta.color,
                },
                outlined && styles.outlined,
            ]}
        >
            <Text
                style={[
                    styles.icon,
                    { fontSize: size * (long ? 0.46 : 0.56), lineHeight: size * 0.98 },
                ]}
                allowFontScaling={false}
            >
                {meta.icon}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: { alignItems: "center", justifyContent: "center" },
    outlined: { borderWidth: 1.5, borderColor: "#FFFFFF" },
    icon: { color: "#FFFFFF", fontWeight: "900", textAlign: "center" },
});
