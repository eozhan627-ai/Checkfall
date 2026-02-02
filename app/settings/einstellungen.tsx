import React, { StyleSheet, Text, View } from "react-native";

export default function einstellungenScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Einstellungen</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontSize: 20,
        fontWeight: 'bold',
    },
});