import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function MainLayout() {
    return (
        <>
            <StatusBar style="light" />
            <Stack
                screenOptions={{
                    headerShown: true,
                    animation: 'slide_from_right',
                    headerStyle: {
                        backgroundColor: '#3961FB',
                    },
                    headerTintColor: '#FFFFFF',
                    headerTitleAlign: 'center',
                    headerTitleStyle: {
                        color: '#FFFFFF',
                        fontSize: 18,
                        fontWeight: '700',
                    },
                    contentStyle: {
                        backgroundColor: '#F4F5F8',
                    },
                }}
            />
        </>
    );
}
