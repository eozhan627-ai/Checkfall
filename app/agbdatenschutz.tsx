import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function AGBDatenschutzPage() {
    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>AGB & Privacy Policy</Text>

            {/* AGB */}
            <Text style={styles.sectionTitle}>Terms and Conditions (AGB)</Text>

            <Text style={styles.text}>
                1. Scope of Application{"\n"}
                These General Terms and Conditions apply to the use of the app
                „Checkfall“. By using the app, you agree to these AGB. If you do not agree, please do not use the app.
            </Text>

            <Text style={styles.text}>
                2. Usage of the App{"\n"}
                Checkfall is designed for playing and learning chess. The use of the app
                is voluntary and at your own risk. There is no claim for specific
                features or availability.
            </Text>

            <Text style={styles.text}>
                3. Liability{"\n"}
                The provider is only liable for damages caused by intentional or gross
                negligence. No liability is assumed for data loss,
                game states or technical issues.
            </Text>

            <Text style={styles.text}>
                4. Change of AGB{"\n"}
                The provider reserves the right to change these AGB at any time. Changes
                will be published within the app.
            </Text>

            <Text style={styles.text}>
                5. Contact {"\n"}
                For questions about the app or these AGB, please contact us at:{"\n"}
                checkfall744@gmail.com
            </Text>

            {/* Datenschutzerklärung */}
            <Text style={styles.sectionTitle}>Privacy Policy</Text>

            <Text style={styles.text}>
                1. Controller{"\n"}
                The controller for data processing is:{"\n"}
                Enes Kazim Özhan{"\n"}  
                Projekt: Checkfall{"\n"}
                E-Mail: checkfall744@gmail.com
            </Text>

            <Text style={styles.text}>
                2. Data Collection and Processing{"\n"}
                The Checkfall app can be used without registration. No personal data such as name, address or payment information is collected.
            </Text>

            <Text style={styles.text}>
                3. Local Data{"\n"}
                Game states, settings or progress are stored exclusively
                locally on the end device. These data do not leave the device
                and are not transmitted to servers.
            </Text>

            <Text style={styles.text}>
                4. Purpose of Data Processing{"\n"}
                The processing is carried out exclusively for the provision of the

                App-Funktionen und zur Sicherstellung eines reibungslosen Betriebs.
            </Text>

            <Text style={styles.text}>
                5. Data Sharing{"\n"}
                There is no sharing of data with third parties. No analytics, tracking, or advertising services are used.
            </Text>

            <Text style={styles.text}>
                6. Rights of Users{"\n"}
                Users have the right to request information, correction, or deletion of their
                data. Requests can be submitted at any time via email.  
            </Text>

            <Text style={styles.text}>
                7. Changes to the Privacy Policy{"\n"}
                This Privacy Policy may be adjusted as the app evolves.
                The current version is always available within the app.
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