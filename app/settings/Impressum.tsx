
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function Impressum() {
    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Impressum</Text>


            <Text style={styles.subtitle}>Unternehmensname: Solid Pixel (GbR)
            </Text>
            {/* Person 1 */}
            <View style={styles.section}>
                <Text style={styles.subtitle}>Inhaber:</Text>
                <Text style={styles.text}>Name: Enes Kazim Özhan</Text>
                <Text style={styles.text}>Adresse: Von-der-Marck-Str.16, 58511 Lüdenscheid</Text>
                <Text style={styles.text}>E-Mail: checkfall744@gmail.com</Text>

            </View>




            <Text style={styles.footer}>
                Hinweis: Inhalte dieser App sind urheberrechtlich geschützt.

            </Text>

            <View style={styles.bottomSpacer} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: "#f9f9f9",
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 16,
        textAlign: "center",
    },
    section: {
        marginBottom: 24,
    },
    subtitle: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 8,
    },
    text: {
        fontSize: 14,
        marginBottom: 4,
        lineHeight: 20,
    },
    bottomSpacer: {
        height: 40, // Abstand zum Boden
    },
    footer: {
        marginTop: 20,
        fontSize: 14,
        color: "#555",
    },

});