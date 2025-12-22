import { Tabs } from 'expo-router';

export default function TabLayout() {
    return (
        <Tabs>
            <Tabs.Screen
                name="index"
                options={{
                    headerShown: false,
                    tabBarLabel: 'Home',
                }}
            />
            <Tabs.Screen
                name="learn"
                options={{
                    title: 'Learn',
                }}
            />
            <Tabs.Screen
                name="more"
                options={{
                    title: 'More',
                }}
            />
        </Tabs>
    );
}
