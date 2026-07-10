import { systemApi } from '@/services/api';
import { readAttributionClipboardFallback } from '@/services/attribution/clipboardFallback';
import {
    canUseAttributionClipboardFallback,
    readCurrentAttributionDeepLinkParams,
} from '@/services/attribution/reporter';
import {
    clearAttributionClipboardFallbackPending,
    getCachedAttributionDeepLinkParams,
    getCachedOpenUrlRuleConfig,
    getCachedOpenUrlClipboardContent,
    getJumpFlag,
    recordAttributionClipboardFallbackAttempt,
    saveAttributionClipboardFallbackPending,
} from '@/services/openUrlJump';
import { createDebugLogger } from '@/utils/logger';

const logger = createDebugLogger('DeferredJump');

const readOpenUrlVerifyFlag = async () => {
    const jumpFlag = await getJumpFlag();
    if (jumpFlag === null) {
        return '';
    }

    return String(jumpFlag);
};

export const requestBootstrapOpenUrl = async ({ base, attributionConfig }) => {
    const h5Verify = await readOpenUrlVerifyFlag();
    logger.info('getOpenUrl: start', { h5Verify, readClipboard: base.readClipboard });
    const cachedOpenUrlRuleConfig = await getCachedOpenUrlRuleConfig();
    let fallbackClipboardRead = null;
    let activeAttributionDeepLinkParams = null;

    const requestOpenUrlWithClipboardContent = async (clipboardContent, source) => {
        logger.info('getOpenUrl: request source', {
            source,
            hasClipboardContent: String(clipboardContent ?? '').length > 0,
        });
        const openUrlRes = await systemApi.getOpenUrl(clipboardContent, h5Verify, cachedOpenUrlRuleConfig);
        return {
            openUrlRes,
            clipboardContent,
            attributionDeepLinkParams: activeAttributionDeepLinkParams,
        };
    };

    const cachedClipboardContent = await getCachedOpenUrlClipboardContent();
    if (cachedClipboardContent !== null) {
        logger.info('getOpenUrl: with cached clipboard', { preview: cachedClipboardContent.slice(0, 32) });
        return requestOpenUrlWithClipboardContent(cachedClipboardContent, 'cached_clipboard');
    }

    const cachedAttributionDeepLinkParams = await getCachedAttributionDeepLinkParams();
    const cachedAttributionDeepLinkValue = String(cachedAttributionDeepLinkParams?.linkValue ?? '');
    if (cachedAttributionDeepLinkValue) {
        logger.info('getOpenUrl: with cached attribution link value', { preview: cachedAttributionDeepLinkValue.slice(0, 32) });
        activeAttributionDeepLinkParams = cachedAttributionDeepLinkParams;
        await clearAttributionClipboardFallbackPending();
        return requestOpenUrlWithClipboardContent(cachedAttributionDeepLinkValue, 'cached_attribution');
    }

    if (h5Verify === '1') {
        await clearAttributionClipboardFallbackPending();
        logger.info('getOpenUrl: jumped=1, request with empty clipboard');
        return requestOpenUrlWithClipboardContent('', 'jumped');
    }

    const attributionDeepLinkParams = await readCurrentAttributionDeepLinkParams();
    const attributionDeepLinkValue = String(attributionDeepLinkParams?.linkValue ?? '');
    if (attributionDeepLinkValue) {
        logger.info('getOpenUrl: with attribution link value', { preview: attributionDeepLinkValue.slice(0, 32) });
        activeAttributionDeepLinkParams = attributionDeepLinkParams;
        await clearAttributionClipboardFallbackPending();
        return requestOpenUrlWithClipboardContent(attributionDeepLinkValue, 'attribution');
    }

    if (canUseAttributionClipboardFallback(attributionConfig)) {
        await saveAttributionClipboardFallbackPending({
            reason: 'attribution_link_unavailable',
            readClipboard: base.readClipboard,
            abTest: '0',
        });
        fallbackClipboardRead = await readAttributionClipboardFallback();
        await recordAttributionClipboardFallbackAttempt(fallbackClipboardRead?.status);
        const fallbackDeepLinkValue = String(fallbackClipboardRead?.params?.linkValue ?? '');
        if (fallbackDeepLinkValue) {
            logger.info('getOpenUrl: with attribution clipboard fallback link value', {
                preview: fallbackDeepLinkValue.slice(0, 32),
            });
            activeAttributionDeepLinkParams = fallbackClipboardRead?.params ?? null;
            return requestOpenUrlWithClipboardContent(fallbackDeepLinkValue, 'attribution_clipboard_fallback');
        }
    }

    // init 返回允许读剪贴板时，才携带剪贴板内容请求 getOpenUrl
    if (base.readClipboard === '1') {
        if (fallbackClipboardRead?.status === 'unavailable') {
            const clipboardContent = fallbackClipboardRead.clipboardContent ?? '';
            logger.info('getOpenUrl: with clipboard from fallback read', {
                preview: clipboardContent.slice(0, 32),
            });
            return requestOpenUrlWithClipboardContent(clipboardContent, 'clipboard');
        }

        if (fallbackClipboardRead?.status === 'read_failed') {
            logger.warn('getOpenUrl: clipboard read skipped after fallback failure');
            return requestOpenUrlWithClipboardContent('', 'empty');
        }

        try {
            const Clipboard = require('expo-clipboard');
            const clipboardContent = await Clipboard.getStringAsync();
            logger.info('getOpenUrl: with clipboard', { preview: (clipboardContent ?? '').slice(0, 32) });
            return requestOpenUrlWithClipboardContent(clipboardContent ?? '', 'clipboard');
        } catch {
            // 读取剪切板失败时回退到空内容
            logger.warn('getOpenUrl: clipboard read failed, fallback empty');
        }
    }

    logger.info('getOpenUrl: request with empty clipboard');
    return requestOpenUrlWithClipboardContent('', 'empty');
};
