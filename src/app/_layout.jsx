import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import useUserStore from '../store/useUserStore';
import useLangStore from '../store/useLangStore';
import { systemApi } from '../services/api';

/**
 * 根布局 - expo-router entry layout
 * 在此初始化全局状态（用户信息还原、主题等）
 */
export default function RootLayout() {
    const initUser = useUserStore((state) => state.initUser);
    const initLang = useLangStore((state) => state.initLang);
    const router = useRouter();
    const timerRef = useRef(null);

    const handleOpenUrl = (res) => {
        const data = res?.data;
        if (!data) return;
        const { status, linkType, url } = data;
        if (status !== '1' || !url) return;
        clearInterval(timerRef.current);

        if (linkType === '1') {
            router.push({
                pathname: '/webview',
                params: { url: encodeURIComponent(url) },
            });
        } else if (linkType === '2') {
            Linking.openURL(url).catch(() => { });
        }
    };

    useEffect(() => {
        // App 启动时恢复用户状态和语言设置
        initUser();
        initLang();

        systemApi.init()
            .then((res) => {
                const base = res?.data?.base;
                if (base) {
                    const { isOpen, linkType, targetUrl } = base;
                    if (isOpen === '1' && targetUrl) {
                        if (linkType === '1') {
                            router.push({
                                pathname: '/webview',
                                params: { url: encodeURIComponent(targetUrl) },
                            });
                        } else if (linkType === '2') {
                            Linking.openURL(targetUrl).catch(() => { });
                        }
                        return;
                    }
                }

                timerRef.current = setInterval(() => {
                    systemApi.getOpenUrl()
                        .then(handleOpenUrl)
                        .catch(() => { });
                }, 5000);
            })
            .catch(() => {
                timerRef.current = setInterval(() => {
                    systemApi.getOpenUrl()
                        .then(handleOpenUrl)
                        .catch(() => { });
                }, 5000);
            });

        return () => {
            clearInterval(timerRef.current);
        };
    }, []);

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
                contentStyle: {
                    backgroundColor: '#F5F7FA',
                },
            }}
        >
            <Stack.Screen name="index" options={{ title: '首页', headerShown: false }} />
            <Stack.Screen name="webview" options={{ title: '' }} />
        </Stack>
    );
}

