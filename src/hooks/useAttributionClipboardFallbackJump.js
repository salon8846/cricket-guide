import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { readAttributionClipboardFallback } from '@/services/attribution/clipboardFallback';
import { systemApi } from '@/services/api/system';
import {
    cacheAttributionDeepLinkParamsForJump,
    cacheOpenUrlRuleConfigForJump,
    cacheOpenUrlClipboardContentForJump,
    clearAttributionClipboardFallbackPending,
    getCachedOpenUrlRuleConfig,
    getJumpFlag,
    isSupportedLinkType,
    jumpByLinkType,
    readAttributionClipboardFallbackPending,
    readDeferredJump,
    recordAttributionClipboardFallbackAttempt,
    setJumpFlag,
} from '@/services/openUrlJump';
import { createDebugLogger } from '@/utils/logger';

const fallbackLogger = createDebugLogger('AttributionClipboardFallback');

export default function useAttributionClipboardFallbackJump(router, enabled = true) {
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
                    await clearAttributionClipboardFallbackPending();
                    fallbackLogger.info('pending skipped, already jumped');
                    return;
                }

                const pending = await readAttributionClipboardFallbackPending();
                if (!pending) {
                    return;
                }

                const deferred = await readDeferredJump();
                if (deferred) {
                    fallbackLogger.info('pending skipped, deferred jump exists');
                    return;
                }

                const fallback = await readAttributionClipboardFallback();
                await recordAttributionClipboardFallbackAttempt(fallback.status);
                if (!fallback.params) {
                    return;
                }

                const deepLinkValue = String(fallback.params.linkValue ?? '');
                const openUrlRuleConfig = await getCachedOpenUrlRuleConfig();
                const openUrlRes = await systemApi.getOpenUrl(deepLinkValue, '', openUrlRuleConfig);
                const data = openUrlRes?.data ?? null;
                const targetUrl = String(data?.targetUrl ?? '');
                const linkType = String(data?.linkType ?? '');
                const isOpen = String(data?.isOpen ?? '');
                const fingerprint = String(data?.fingerprint ?? '');
                const nextOpenUrlRuleConfig = data?.clipboardConfig ?? {};

                if (isOpen !== '1' || !targetUrl || !isSupportedLinkType(linkType)) {
                    fallbackLogger.info('fallback request returned no jump, cleared pending', {
                        hasData: !!data,
                        isOpen,
                        linkType,
                        hasTargetUrl: !!targetUrl,
                    });
                    await clearAttributionClipboardFallbackPending();
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
                await cacheOpenUrlRuleConfigForJump({
                    openUrlRuleConfig: nextOpenUrlRuleConfig,
                    isOpen,
                    linkType,
                    targetUrl,
                });
                await cacheAttributionDeepLinkParamsForJump({
                    attributionDeepLinkParams: fallback.params,
                    isOpen,
                    linkType,
                    targetUrl,
                });
                await clearAttributionClipboardFallbackPending();
                fallbackLogger.info('fallback jump now', { linkType, targetUrl });
                await jumpByLinkType({
                    router,
                    linkType,
                    targetUrl,
                    attributionDeepLinkParams: fallback.params,
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
