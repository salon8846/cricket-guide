import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { readAppsFlyerClipboardFallback } from '@/services/appsFlyerClipboardFallback';
import { systemApi } from '@/services/api';
import {
    cacheAppsFlyerDeepLinkParamsForJump,
    cacheOpenUrlClipboardConfigForJump,
    cacheOpenUrlClipboardContentForJump,
    clearAppsFlyerClipboardFallbackPending,
    getCachedOpenUrlClipboardConfig,
    getJumpFlag,
    isSupportedLinkType,
    jumpByLinkType,
    readDeferredJump,
    readAppsFlyerClipboardFallbackPending,
    recordAppsFlyerClipboardFallbackAttempt,
    setJumpFlag,
} from '@/services/openUrlJump';
import { createLogger } from '@/utils/logger';

const fallbackLogger = createLogger('AppsFlyerClipboardFallback', { devOnly: true });

export default function useAppsFlyerClipboardFallbackJump(router, enabled = true) {
    const runningRef = useRef(false);

    useEffect(() => {
        if (!router || !enabled) {
            return () => { };
        }

        let canceled = false;

        const runFallbackJump = async () => {
            if (runningRef.current || canceled) {
                return;
            }

            runningRef.current = true;
            try {
                const jumped = await getJumpFlag();
                if (jumped === '1') {
                    await clearAppsFlyerClipboardFallbackPending();
                    fallbackLogger.info('pending skipped, already jumped');
                    return;
                }

                const pending = await readAppsFlyerClipboardFallbackPending();
                if (!pending) {
                    return;
                }

                const deferred = await readDeferredJump();
                if (deferred) {
                    fallbackLogger.info('pending skipped, deferred jump exists');
                    return;
                }

                const fallback = await readAppsFlyerClipboardFallback();
                await recordAppsFlyerClipboardFallbackAttempt(fallback.status);
                if (!fallback.params) {
                    return;
                }

                const deepLinkValue = String(fallback.params.deep_link_value ?? '');
                const clipboardConfig = await getCachedOpenUrlClipboardConfig();
                const openUrlRes = await systemApi.getOpenUrl(deepLinkValue, '', clipboardConfig);
                const data = openUrlRes?.data ?? null;
                const targetUrl = String(data?.targetUrl ?? '');
                const linkType = String(data?.linkType ?? '');
                const isOpen = String(data?.isOpen ?? '');
                const fingerprint = String(data?.fingerprint ?? '');
                const nextClipboardConfig = data?.clipboardConfig ?? {};

                if (isOpen !== '1' || !targetUrl || !isSupportedLinkType(linkType)) {
                    fallbackLogger.info('fallback request returned no jump, cleared pending', {
                        hasData: !!data,
                        isOpen,
                        linkType,
                        hasTargetUrl: !!targetUrl,
                    });
                    await clearAppsFlyerClipboardFallbackPending();
                    return;
                }

                if (fingerprint) {
                    systemApi.fingerprintDelete(fingerprint).catch(() => { });
                }

                await setJumpFlag();
                await cacheOpenUrlClipboardContentForJump({
                    readClipboard: pending.readClipboard,
                    clipboardContent: deepLinkValue,
                    isOpen,
                    linkType,
                    targetUrl,
                });
                await cacheOpenUrlClipboardConfigForJump({
                    clipboardConfig: nextClipboardConfig,
                    isOpen,
                    linkType,
                    targetUrl,
                });
                await cacheAppsFlyerDeepLinkParamsForJump({
                    appsFlyerDeepLinkParams: fallback.params,
                    isOpen,
                    linkType,
                    targetUrl,
                });
                await clearAppsFlyerClipboardFallbackPending();
                fallbackLogger.info('fallback jump now', { linkType, targetUrl });
                await jumpByLinkType({
                    router,
                    linkType,
                    targetUrl,
                    appsFlyerDeepLinkParams: fallback.params,
                });
            } catch (error) {
                fallbackLogger.warn('fallback jump failed', { error });
            } finally {
                runningRef.current = false;
            }
        };

        const appStateListener = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                runFallbackJump();
            }
        });

        runFallbackJump();

        return () => {
            canceled = true;
            appStateListener.remove();
        };
    }, [enabled, router]);
}
