import { Stack } from 'expo-router';

export default function LearnLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'lime' }
            }}
        />
    );
}