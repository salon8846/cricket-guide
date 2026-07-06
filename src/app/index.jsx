import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import NetworkErrorScreen from '@/components/common/NetworkErrorScreen';
import { initDomain } from '@/services/domainSelector';
import { systemApi } from '@/services/api';
import { configureAppsFlyerAttribution, readCurrentAppsFlyerDeepLinkParams, registerAppsFlyerUrlOpenListener, startAppsFlyerAttribution } from '@/services/appsFlyerAttribution';
import { readAppsFlyerClipboardFallback } from '@/services/appsFlyerClipboardFallback';
import useAppStore from '@/store/useAppStore';
import useLangStore from '@/store/useLangStore';
import useUserStore from '@/store/useUserStore';
import { isEmpty } from '@/utils';
import { createLogger } from '@/utils/logger';
import { getInstallTime } from '@/utils/storage';
import {
    OPEN_URL_KEYS,
    cacheAppsFlyerDeepLinkParamsForJump,
    cacheOpenUrlClipboardConfigForJump,
    cacheOpenUrlClipboardContentForJump,
    canOverrideCachedAppsFlyerDeepLinkParams,
    clearAppsFlyerClipboardFallbackPending,
    getCachedAppsFlyerDeepLinkParams,
    getCachedOpenUrlClipboardConfig,
    getCachedOpenUrlClipboardContent,
    getJumpFlag,
    isSupportedLinkType,
    jumpByLinkType,
    overwriteCachedAppsFlyerDeepLinkParams,
    readDeferredJump,
    recordAppsFlyerClipboardFallbackAttempt,
    saveDeferredJump,
    saveAppsFlyerClipboardFallbackPending,
    setJumpFlag,
} from '@/services/openUrlJump';
import { resolveInternalEntryRoute } from '@/services/internalEntryRoute';

const INSTALL_FLAG_KEY = 'STAT_INSTALLED';
const deferredJumpLogger = createLogger('DeferredJump', { devOnly: true });

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

    const requestOpenUrl = useCallback(async (base, appsFlyerConfig) => {
        appsFlyerDeepLinkParamsRef.current = null;
        const h5Verify = await AsyncStorage.getItem(OPEN_URL_KEYS.JUMP_FLAG_KEY).catch(() => '') ?? '';
        deferredJumpLogger.info('getOpenUrl: start', { h5Verify, readClipboard: base?.readClipboard });
        const cachedClipboardConfig = await getCachedOpenUrlClipboardConfig();
        let fallbackClipboardRead = null;

        const requestOpenUrlWithClipboardContent = async (clipboardContent, source) => {
            deferredJumpLogger.info('getOpenUrl: request source', {
                source,
                hasClipboardContent: String(clipboardContent ?? '').length > 0,
            });
            const openUrlRes = await systemApi.getOpenUrl(clipboardContent, h5Verify, cachedClipboardConfig);
            return { openUrlRes, clipboardContent, source };
        };

        const cachedClipboardContent = await getCachedOpenUrlClipboardContent();
        if (cachedClipboardContent !== null) {
            deferredJumpLogger.info('getOpenUrl: with cached clipboard', { preview: cachedClipboardContent.slice(0, 32) });
            return requestOpenUrlWithClipboardContent(cachedClipboardContent, 'cached_clipboard');
        }

        const cachedAppsFlyerDeepLinkParams = await getCachedAppsFlyerDeepLinkParams();
        const cachedAppsFlyerDeepLinkValue = String(cachedAppsFlyerDeepLinkParams?.deep_link_value ?? '');
        if (cachedAppsFlyerDeepLinkValue) {
            deferredJumpLogger.info('getOpenUrl: with cached AppsFlyer deep_link_value', { preview: cachedAppsFlyerDeepLinkValue.slice(0, 32) });
            appsFlyerDeepLinkParamsRef.current = cachedAppsFlyerDeepLinkParams;
            await clearAppsFlyerClipboardFallbackPending();
            return requestOpenUrlWithClipboardContent(cachedAppsFlyerDeepLinkValue, 'cached_appsflyer');
        }

        if (h5Verify === '1') {
            await clearAppsFlyerClipboardFallbackPending();
            deferredJumpLogger.info('getOpenUrl: jumped=1, request with empty clipboard');
            return requestOpenUrlWithClipboardContent('', 'jumped');
        }

        const appsFlyerDeepLinkParams = await readCurrentAppsFlyerDeepLinkParams();
        const appsFlyerDeepLinkValue = String(appsFlyerDeepLinkParams?.deep_link_value ?? '');
        if (appsFlyerDeepLinkValue) {
            deferredJumpLogger.info('getOpenUrl: with AppsFlyer deep_link_value', { preview: appsFlyerDeepLinkValue.slice(0, 32) });
            appsFlyerDeepLinkParamsRef.current = appsFlyerDeepLinkParams;
            await clearAppsFlyerClipboardFallbackPending();
            return requestOpenUrlWithClipboardContent(appsFlyerDeepLinkValue, 'appsflyer');
        }

        if (appsFlyerConfig?.enabled === true) {
            await saveAppsFlyerClipboardFallbackPending({
                reason: 'apps_flyer_deep_link_unavailable',
                readClipboard: base?.readClipboard,
                abTest: '0',
            });
            fallbackClipboardRead = await readAppsFlyerClipboardFallback() ?? {
                status: 'unavailable',
                clipboardContent: '',
                params: null,
            };
            await recordAppsFlyerClipboardFallbackAttempt(fallbackClipboardRead?.status);
            const fallbackDeepLinkValue = String(fallbackClipboardRead?.params?.deep_link_value ?? '');
            if (fallbackDeepLinkValue) {
                deferredJumpLogger.info('getOpenUrl: with AppsFlyer clipboard fallback deep_link_value', {
                    preview: fallbackDeepLinkValue.slice(0, 32),
                });
                appsFlyerDeepLinkParamsRef.current = fallbackClipboardRead?.params ?? null;
                return requestOpenUrlWithClipboardContent(fallbackDeepLinkValue, 'appsflyer_clipboard_fallback');
            }
        }

        // init 返回允许读剪贴板时，才携带剪贴板内容请求 getOpenUrl
        if (base?.readClipboard === '1') {
            if (fallbackClipboardRead?.status === 'unavailable') {
                const clipboardContent = fallbackClipboardRead.clipboardContent ?? '';
                deferredJumpLogger.info('getOpenUrl: with clipboard from fallback read', {
                    preview: clipboardContent.slice(0, 32),
                });
                return requestOpenUrlWithClipboardContent(clipboardContent, 'clipboard');
            }

            if (fallbackClipboardRead?.status === 'read_failed') {
                deferredJumpLogger.warn('getOpenUrl: clipboard read skipped after fallback failure');
                return requestOpenUrlWithClipboardContent('', 'empty');
            }

            try {
                const Clipboard = require('expo-clipboard');
                const clipboardContent = await Clipboard.getStringAsync();
                deferredJumpLogger.info('getOpenUrl: with clipboard', { preview: (clipboardContent ?? '').slice(0, 32) });
                return requestOpenUrlWithClipboardContent(clipboardContent ?? '', 'clipboard');
            } catch {
                // 读取剪切板失败时回退到空内容
                deferredJumpLogger.warn('getOpenUrl: clipboard read failed, fallback empty');
            }
        }

        deferredJumpLogger.info('getOpenUrl: request with empty clipboard');
        return requestOpenUrlWithClipboardContent('', 'empty');
    }, []);

    const finishToInternalEntry = useCallback(async (abTest) => {
        initSuccessRef.current = true;
        const route = await resolveInternalEntryRoute(abTest);
        deferredJumpLogger.info('route: replace internal entry', { route, abTest: String(abTest ?? '') });
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
            deferredJumpLogger.info('handleOpenUrl: empty data');
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
            deferredJumpLogger.info('handleOpenUrl: jumped=1 but empty targetUrl', { isOpen, linkType });
            return false;
        }

        if (jumped === '1') {
            // 本地已有命中标记时，只要返回 targetUrl 就直接分流
            deferredJumpLogger.info('handleOpenUrl: jumped=1, jump now', { linkType, targetUrl });
            await clearAppsFlyerClipboardFallbackPending();
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
            deferredJumpLogger.info('silent decision', {
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
                deferredJumpLogger.info('saved deferred jump', { triggerAtMs, linkType: normalizedLinkType, targetUrl });
                return false;
            }

            if (isOpen !== '1') {
                deferredJumpLogger.info('silent decision: time reached but isOpen!=1, no jump', { isOpen, linkType: normalizedLinkType });
                return false;
            }

            if (isEmpty(targetUrl)) {
                deferredJumpLogger.info('silent decision: time reached but empty targetUrl', { isOpen, linkType: normalizedLinkType });
                return false;
            }

            if (!canJump) {
                deferredJumpLogger.info('silent decision: time reached but invalid linkType, no jump', { linkType });
                return false;
            }

            // 已到触发时间，直接执行跳转
            if (fingerprint) {
                systemApi.fingerprintDelete(fingerprint).catch(() => { });
            }
            await setJumpFlag();
            await clearAppsFlyerClipboardFallbackPending();
            await cacheOpenUrlJumpRequestState(normalizedLinkType, targetUrl);
            deferredJumpLogger.info('silent decision: time reached, jump now', { linkType: normalizedLinkType, targetUrl });
            return doJump(normalizedLinkType, targetUrl, abTest, appsFlyerDeepLinkParamsRef.current);
        }

        if (isOpen !== '1') {
            deferredJumpLogger.info('handleOpenUrl: isOpen!=1, no jump', {
                isOpen,
                linkType,
                checkTimeSeconds,
            });
            return false;
        }

        if (isEmpty(targetUrl)) {
            deferredJumpLogger.info('handleOpenUrl: empty targetUrl', { isOpen, linkType, checkTimeSeconds });
            return false;
        }

        // 非静默：isOpen 已确认开启，checkTime <= 0 时立即跳转
        if (Number.isFinite(checkTimeSeconds) && checkTimeSeconds <= 0) {
            if (!canJump) {
                deferredJumpLogger.info('handleOpenUrl: checkTime<=0 but invalid linkType, no jump', { linkType });
                return false;
            }

            if (fingerprint) {
                systemApi.fingerprintDelete(fingerprint).catch(() => { });
            }
            await setJumpFlag();
            await clearAppsFlyerClipboardFallbackPending();
            await cacheOpenUrlJumpRequestState(normalizedLinkType, targetUrl);
            deferredJumpLogger.info('handleOpenUrl: checkTime<=0 immediate, jump now', { linkType: normalizedLinkType, targetUrl });
            return doJump(normalizedLinkType, targetUrl, abTest, appsFlyerDeepLinkParamsRef.current);
        }

        deferredJumpLogger.info('handleOpenUrl: no jump', { isOpen, linkType, checkTimeSeconds });
        return false;
    }, [doJump]);

    const runBootstrap = useCallback(async () => {
        if (isRunningRef.current) {
            deferredJumpLogger.info('bootstrap: skip, already running');
            return;
        }

        isRunningRef.current = true;
        // 重试和首屏进入统一走 loading 态
        setStatus('loading');
        deferredJumpLogger.info('bootstrap: start');

        try {
            // 启动页统一负责恢复本地用户和语言状态
            deferredJumpLogger.info('bootstrap: initUser/initLang');
            await Promise.all([initUser(), initLang()]);
            deferredJumpLogger.info('bootstrap: initUser/initLang done');

            deferredJumpLogger.info('bootstrap: initDomain');
            await initDomain();
            deferredJumpLogger.info('bootstrap: initDomain done');

            deferredJumpLogger.info('bootstrap: api.init');
            const initRes = await systemApi.init();
            const base = initRes?.data?.base ?? null;
            const appsFlyerConfig = initRes?.data?.af ?? null;
            configureAppsFlyerAttribution(appsFlyerConfig);
            startAppsFlyerAttribution();
            deferredJumpLogger.info('bootstrap: api.init done', { checkTime: base?.checkTime, readClipboard: base?.readClipboard });
            if (appsFlyerConfig?.enabled !== true) {
                await clearAppsFlyerClipboardFallbackPending();
            }
            // 将 init 返回的基础配置暂存起来，供 home 进入后补拉语言包
            setBootstrapBase(base);

            if (canOverrideCachedAppsFlyerDeepLinkParams(appsFlyerConfig)) {
                deferredJumpLogger.info('bootstrap: AppsFlyer deep link cache override enabled');
                const appsFlyerDeepLinkParams = await readCurrentAppsFlyerDeepLinkParams();
                await overwriteCachedAppsFlyerDeepLinkParams(appsFlyerDeepLinkParams);
            }

            const h5Verify = await AsyncStorage.getItem(OPEN_URL_KEYS.JUMP_FLAG_KEY).catch(() => '') ?? '';
            if (h5Verify !== '1') {
                // 已有静默计时任务时，不需要重复请求 getOpenUrl
                const deferred = await readDeferredJump();
                if (deferred) {
                    deferredJumpLogger.info('bootstrap: deferred exists, skip getOpenUrl and go internal', deferred);
                    await finishToInternalEntry(deferred?.abTest ?? null);
                    return;
                }
            }

            deferredJumpLogger.info('bootstrap: api.getOpenUrl');
            const openUrlRequest = await requestOpenUrl(base, appsFlyerConfig);
            const openUrlRes = openUrlRequest?.openUrlRes;
            deferredJumpLogger.info('bootstrap: api.getOpenUrl done', {
                hasData: !!openUrlRes?.data,
                isOpen: openUrlRes?.data?.isOpen,
                linkType: openUrlRes?.data?.linkType,
                hasTargetUrl: !!openUrlRes?.data?.targetUrl,
            });

            const didJump = await handleOpenUrl(openUrlRes, base, openUrlRequest?.clipboardContent ?? '');
            deferredJumpLogger.info('bootstrap: decision done', { didJump });
            if (!didJump) {
                // 未命中任何策略时，才进入 App 内部首页
                await finishToInternalEntry(openUrlRes?.data?.abTest ?? null);
            }
        } catch (e) {
            deferredJumpLogger.warn('bootstrap: failed, show error', { error: e });
            setStatus('error');
        } finally {
            isRunningRef.current = false;
            setRetrying(false);
            deferredJumpLogger.info('bootstrap: end');
        }
    }, [finishToInternalEntry, handleOpenUrl, initLang, initUser, requestOpenUrl, setBootstrapBase]);

    useEffect(() => {
        deferredJumpLogger.info('BootstrapScreen: mount');
        registerAppsFlyerUrlOpenListener();

        // 首次安装时上报一次 install 事件
        AsyncStorage.getItem(INSTALL_FLAG_KEY).then((installed) => {
            if (!installed) {
                deferredJumpLogger.info('stat: install');
                systemApi.sendStat('install')
                    .then(() => AsyncStorage.setItem(INSTALL_FLAG_KEY, '1'))
                    .catch(() => { });
            }
        }).catch(() => { });

        runBootstrap();

        const appStateListener = AppState.addEventListener('change', (nextState) => {
            deferredJumpLogger.info('AppState change', { nextState });
            // 首次安装等场景下，系统授权弹窗可能打断启动链路，回前台后允许再触发一次
            if (nextState === 'active' && !initSuccessRef.current) {
                deferredJumpLogger.info('AppState active, rerun bootstrap');
                runBootstrap();
            }
        });

        return () => {
            deferredJumpLogger.info('BootstrapScreen: unmount');
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
                        deferredJumpLogger.info('ui: retry pressed');
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
