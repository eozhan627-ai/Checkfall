import { StyleSheet, View } from "react-native";
import Board from "./Board";
import LayoutLG from "./layoutLG";

export default function IndexLG() {
    return (
        <LayoutLG>
            <View style={styles.center}>
                <Board />
            </View>
        </LayoutLG>

    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
});