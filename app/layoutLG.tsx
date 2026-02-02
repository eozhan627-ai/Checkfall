import { StyleSheet, View } from "react-native";

export default function LayoutLG({ children }: { children: React.ReactNode }) {
    return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#020617",
        padding: 16,
    },
});