import { Stack, usePathname, useRouter } from 'expo-router';
import useDeferredOpenUrlJump from '../hooks/useDeferredOpenUrlJump';

/**
 * 根布局 - 路由壳 + 策略挂载点（不做首次决策）
 *
 * 分层约定：
 * - 首次决策只在 `src/app/index.jsx`：init + getOpenUrl 产出“立即跳/静默跳/不跳”。
 * - 静默到点检测属于“执行层”，挂在根 layout 里，但用 pathname 做门禁：
 *   - 启动页 `/` 不执行（避免干扰启动链路）
 *   - `/webview` 不执行（避免 webview 被到点逻辑重载/打断）
 */
export default function RootLayout() {
    const router = useRouter();
    const pathname = usePathname();
    const enableDeferredCheck = pathname !== '/' && !pathname.startsWith('/webview');

    useDeferredOpenUrlJump(router, enableDeferredCheck);

    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
            <Stack.Screen name="(main)" options={{ headerShown: false, animation: 'none' }} />
            <Stack.Screen name="webview" options={{ title: '', headerTitle: () => null, animation: 'none' }} />
        </Stack>
    );
}
