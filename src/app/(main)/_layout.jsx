import { Stack } from 'expo-router';
import useBootstrapTranslations from '@/hooks/useBootstrapTranslations';

/**
 * 业务页面布局
 *
 * 约定：
 * - 这里只承载业务路由壳与通用 UI（header 样式等）
 * - 启动策略与静默跳转检测不应放在业务组内（见 `src/app/index.jsx` 与 `src/app/_layout.jsx`）
 */
export default function MainLayout() {
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
            <Stack.Screen name="home" options={{ title: '首页' }} />
        </Stack>
    );
}
