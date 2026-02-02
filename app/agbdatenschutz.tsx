import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function AGBDatenschutzPage() {
    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>AGB & Datenschutzerklärung</Text>

            {/* AGB */}
            <Text style={styles.sectionTitle}>Allgemeine Geschäftsbedingungen (AGB)</Text>

            <Text style={styles.text}>
                1. Geltungsbereich{"\n"}
                Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der App
                „Checkfall“. Mit der Nutzung der App erklärst du dich mit diesen AGB
                einverstanden.
            </Text>

            <Text style={styles.text}>
                2. Nutzung der App{"\n"}
                Checkfall dient dem Spielen und Lernen von Schach. Die Nutzung erfolgt
                freiwillig und auf eigene Verantwortung. Ein Anspruch auf bestimmte
                Funktionen oder Verfügbarkeit besteht nicht.
            </Text>

            <Text style={styles.text}>
                3. Haftung{"\n"}
                Der Anbieter haftet nur für Schäden, die durch vorsätzliches oder grob
                fahrlässiges Verhalten verursacht wurden. Für Datenverluste,
                Spielstände oder technische Störungen wird keine Haftung übernommen.
            </Text>

            <Text style={styles.text}>
                4. Änderungen der AGB{"\n"}
                Der Anbieter behält sich vor, diese AGB jederzeit zu ändern. Änderungen
                werden innerhalb der App veröffentlicht.
            </Text>

            <Text style={styles.text}>
                5. Kontakt{"\n"}
                Bei Fragen zur App oder zu diesen AGB kontaktiere uns bitte unter:{"\n"}
                checkfall744@gmail.com
            </Text>

            {/* Datenschutzerklärung */}
            <Text style={styles.sectionTitle}>Datenschutzerklärung</Text>

            <Text style={styles.text}>
                1. Verantwortlicher{"\n"}
                Verantwortlich für die Datenverarbeitung ist:{"\n"}
                Enes Kazim Özhan{"\n"}
                Projekt: Checkfall{"\n"}
                E-Mail: checkfall744@gmail.com
            </Text>

            <Text style={styles.text}>
                2. Erhebung und Verarbeitung von Daten{"\n"}
                Die App Checkfall kann ohne Registrierung genutzt werden. Es werden
                keine personenbezogenen Daten wie Name, Adresse oder Zahlungsdaten
                erhoben.
            </Text>

            <Text style={styles.text}>
                3. Lokale Daten{"\n"}
                Spielstände, Einstellungen oder Fortschritte werden ausschließlich
                lokal auf dem Endgerät gespeichert. Diese Daten verlassen das Gerät
                nicht und werden nicht an Server übertragen.
            </Text>

            <Text style={styles.text}>
                4. Zweck der Verarbeitung{"\n"}
                Die Verarbeitung erfolgt ausschließlich zur Bereitstellung der
                App-Funktionen und zur Sicherstellung eines reibungslosen Betriebs.
            </Text>

            <Text style={styles.text}>
                5. Weitergabe an Dritte{"\n"}
                Es findet keine Weitergabe von Daten an Dritte statt. Es werden keine
                Analyse-, Tracking- oder Werbedienste eingesetzt.
            </Text>

            <Text style={styles.text}>
                6. Rechte der Nutzer{"\n"}
                Nutzer haben das Recht auf Auskunft, Berichtigung oder Löschung ihrer
                Daten. Anfragen können jederzeit per E-Mail gestellt werden.
            </Text>

            <Text style={styles.text}>
                7. Änderungen der Datenschutzerklärung{"\n"}
                Diese Datenschutzerklärung kann bei Weiterentwicklung der App
                angepasst werden. Die aktuelle Version ist jederzeit in der App
                abrufbar.
            </Text>

            <View style={styles.bottomSpacer} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: "#f0f0f0" },
    title: { fontSize: 24, fontWeight: "bold", marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: "600", marginTop: 20, marginBottom: 8 },
    text: { fontSize: 14, lineHeight: 22, marginBottom: 12, paddingBottom: 4 },
    bottomSpacer: { height: 40 },
});