import React from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View,
} from "react-native";

export default function CallbackPage() {
    return (
        <View style={styles.container}>
            <ActivityIndicator
                size="small"
                color="#D4AF37"
            />

            <Text style={styles.text}>
                Signing in...
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#080808",
        justifyContent: "center",
        alignItems: "center",
    },

    text: {
        color: "#777",
        fontSize: 13,
        marginTop: 14,
    },
});