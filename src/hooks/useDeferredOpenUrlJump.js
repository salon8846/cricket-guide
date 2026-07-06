import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { systemApi } from '@/services/api';
import { createLogger } from '@/utils/logger';
import {
    cacheAppsFlyerDeepLinkParamsForJump,
    cacheOpenUrlClipboardConfigForJump,
    cacheOpenUrlClipboardContentForJump,
    clearDeferredJump,
    getCachedAppsFlyerDeepLinkParams,
    getCachedOpenUrlClipboardConfig,
    getCachedOpenUrlClipboardContent,
    getJumpFlag,
    isSupportedLinkType,
    jumpByLinkType,
    readDeferredJump,
    setJumpFlag,
} from '@/services/openUrlJump';

const MAX_TIMEOUT_MS = 2147483647;
const deferredJumpLogger = createLogger('DeferredJump', { devOnly: true });

/**
 * 静默计时到点检测
 *
 * 说明：
 * - 这里不负责“是否需要立即跳转/开始计时”的决策，决策由启动页 `src/app/index.jsx` 的首次 getOpenUrl 完成。
 * - 这里仅负责读取 `OPEN_URL_DEFERRED_JUMP`，并在到点后复查 getOpenUrl，按最新结果决定是否跳转。
 *   - 到点时会再请求一次 getOpenUrl 获取最新 isOpen/targetUrl/linkType。
 *   - 到点复查时会优先复用已缓存的 clipboardContent。
 *   - 只有最新 isOpen === '1' 且 targetUrl/linkType 有效时才跳转。
 *
 * 为什么要有 enabled：
 * - 这个检测不应该在 `/`(启动页) 或 `/webview` 内运行，避免打断启动链路或导致 webview 重载。
 */
export default function useDeferredOpenUrlJump(router, enabled = true) {
    const deferredTimerRef = useRef(null);

    useEffect(() => {
        if (!router || !enabled) {
            return () => { };
        }

        let canceled = false;
        deferredJumpLogger.info('deferred: enabled');
        // 注意：JS timer 在后台可能会被系统挂起，因此同时监听 AppState active 进行复核。

        const clearTimer = () => {
            if (deferredTimerRef.current) {
                clearTimeout(deferredTimerRef.current);
                deferredTimerRef.current = null;
            }
        };

        const runDeferredJump = async () => {
            const jumped = await getJumpFlag();
            if (jumped === '1') {
                await clearDeferredJump();
                deferredJumpLogger.info('deferred: jumped=1, cleared deferred');
                return;
            }

            const deferred = await readDeferredJump();
            if (!deferred) {
                deferredJumpLogger.info('deferred: none');
                return;
            }

            const { triggerAtMs, fingerprint, readClipboard } = deferred;

            const remaining = triggerAtMs - Date.now();
            deferredJumpLogger.info('deferred: check', {
                nowMs: Date.now(),
                triggerAtMs,
                remainingMs: remaining,
            });

            if (remaining <= 0) {
                deferredJumpLogger.info('deferred: time reached, refresh openUrl');

                const h5Verify = (await getJumpFlag()) ?? '';
                const cachedClipboardConfig = await getCachedOpenUrlClipboardConfig();
                const cachedClipboardContent = await getCachedOpenUrlClipboardContent();
                const cachedAppsFlyerDeepLinkParams = await getCachedAppsFlyerDeepLinkParams();
                const cachedAppsFlyerDeepLinkValue = String(cachedAppsFlyerDeepLinkParams?.deep_link_value ?? '');
                const clipboardContent = cachedClipboardContent ?? cachedAppsFlyerDeepLinkValue ?? '';
                const appsFlyerDeepLinkParamsForJump = cachedClipboardContent === null && cachedAppsFlyerDeepLinkValue
                    ? cachedAppsFlyerDeepLinkParams
                    : null;
                deferredJumpLogger.info('deferred: refresh clipboard', {
                    hasCache: cachedClipboardContent !== null,
                    hasAppsFlyerCache: cachedAppsFlyerDeepLinkParams !== null,
                    preview: clipboardContent.slice(0, 32),
                });

                let openUrlRes = null;
                try {
                    openUrlRes = await systemApi.getOpenUrl(clipboardContent, h5Verify, cachedClipboardConfig);
                } catch (e) {
                    // 保留 deferred，等待下次 AppState active 再尝试
                    deferredJumpLogger.warn('deferred: getOpenUrl refresh failed', e);
                    return;
                }

                const data = openUrlRes?.data ?? null;
                const nextTargetUrl = String(data?.targetUrl ?? '');
                const nextLinkType = String(data?.linkType ?? '');
                const nextFingerprint = String(data?.fingerprint ?? '');
                const nextIsOpen = String(data?.isOpen ?? '');
                const nextClipboardConfig = data?.clipboardConfig ?? {};

                if (nextIsOpen !== '1' || !nextTargetUrl || !isSupportedLinkType(nextLinkType)) {
                    deferredJumpLogger.warn('deferred: refresh returned no jump, cleared deferred', {
                        hasData: !!data,
                        isOpen: nextIsOpen,
                        linkType: nextLinkType,
                        hasTargetUrl: !!nextTargetUrl,
                    });
                    await clearDeferredJump();
                    return;
                }

                if (fingerprint) {
                    systemApi.fingerprintDelete(fingerprint).catch(() => { });
                }
                if (nextFingerprint) {
                    systemApi.fingerprintDelete(nextFingerprint).catch(() => { });
                }

                await setJumpFlag();
                await cacheOpenUrlClipboardContentForJump({
                    readClipboard,
                    clipboardContent,
                    isOpen: nextIsOpen,
                    linkType: nextLinkType,
                    targetUrl: nextTargetUrl,
                });
                await cacheOpenUrlClipboardConfigForJump({
                    clipboardConfig: nextClipboardConfig,
                    isOpen: nextIsOpen,
                    linkType: nextLinkType,
                    targetUrl: nextTargetUrl,
                });
                await cacheAppsFlyerDeepLinkParamsForJump({
                    appsFlyerDeepLinkParams: appsFlyerDeepLinkParamsForJump,
                    isOpen: nextIsOpen,
                    linkType: nextLinkType,
                    targetUrl: nextTargetUrl,
                });
                await clearDeferredJump();
                deferredJumpLogger.info('deferred: refreshed, jump now', { linkType: nextLinkType, targetUrl: nextTargetUrl });
                await jumpByLinkType({
                    router,
                    linkType: nextLinkType,
                    targetUrl: nextTargetUrl,
                    appsFlyerDeepLinkParams: appsFlyerDeepLinkParamsForJump,
                });
                return;
            }

            clearTimer();
            const delay = Math.min(remaining, MAX_TIMEOUT_MS);
            deferredJumpLogger.info('deferred: scheduled', { delayMs: delay });
            deferredTimerRef.current = setTimeout(() => {
                if (canceled) {
                    return;
                }
                runDeferredJump().catch((e) => deferredJumpLogger.warn('deferred: trigger failed', e));
            }, delay);
        };

        const appStateListener = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                deferredJumpLogger.info('deferred: AppState active, re-check');
                runDeferredJump().catch((e) => deferredJumpLogger.warn('deferred: active check failed', e));
            }
        });

        runDeferredJump().catch((e) => deferredJumpLogger.warn('deferred: init failed', e));

        return () => {
            canceled = true;
            clearTimer();
            appStateListener.remove();
            deferredJumpLogger.info('deferred: disabled');
        };
    }, [enabled, router]);
}
