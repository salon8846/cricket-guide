import { Redirect, Stack } from 'expo-router';
import { DEFAULT_ENTRY_ROUTE, HAS_AB_TEST_MODULE } from '@/constants/entryRouting';

/**
 * B 模块路由壳（与 main 模块解耦）
 */
export default function BModuleLayout() {
    if (!HAS_AB_TEST_MODULE) {
        return <Redirect href={DEFAULT_ENTRY_ROUTE} />;
    }

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
