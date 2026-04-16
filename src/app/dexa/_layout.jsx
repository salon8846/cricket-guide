import { Stack } from 'expo-router';
import useBootstrapTranslations from '../../hooks/useBootstrapTranslations';

/**
 * B 模块路由壳（与 main 模块解耦）
 */
export default function BModuleLayout() {
    useBootstrapTranslations();

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: '#FFFFFF',
                },
                headerTintColor: '#1A1A2E',
                headerTitleStyle: {
                    fontWeight: '600',
                },
                headerShadowVisible: false,
                headerBackTitle: '',
                headerBackTitleVisible: false,
                contentStyle: {
                    backgroundColor: '#F5F7FA',
                },
            }}
        >
            <Stack.Screen name="index" options={{ title: 'B模块' }} />
        </Stack>
    );
}
