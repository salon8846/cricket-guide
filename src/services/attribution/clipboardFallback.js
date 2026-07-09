import * as Clipboard from 'expo-clipboard';
import { parseAttributionClipboardFallbackParams } from '@/services/attribution/reporter';
import { createLogger } from '@/utils/logger';

const fallbackLogger = createLogger('AttributionClipboardFallback', { devOnly: true });

export const parseAttributionClipboardFallback = (clipboardContent) => {
    const rawClipboardContent = String(clipboardContent ?? '').trim();
    if (!rawClipboardContent) {
        return null;
    }

    let parsedClipboardContent = null;
    try {
        parsedClipboardContent = JSON.parse(rawClipboardContent);
    } catch {
        return null;
    }

    if (!parsedClipboardContent || typeof parsedClipboardContent !== 'object' || Array.isArray(parsedClipboardContent)) {
        return null;
    }

    const normalizedParams = parseAttributionClipboardFallbackParams(parsedClipboardContent);
    const deepLinkValue = String(normalizedParams?.linkValue ?? '').trim();
    return deepLinkValue ? normalizedParams : null;
};

export const readAttributionClipboardFallback = async () => {
    try {
        const clipboardContent = await Clipboard.getStringAsync();
        const params = parseAttributionClipboardFallback(clipboardContent);
        if (!params) {
            fallbackLogger.info('clipboard fallback params unavailable', {
                hasClipboardContent: String(clipboardContent ?? '').length > 0,
            });
            return {
                status: 'unavailable',
                clipboardContent: clipboardContent ?? '',
                params: null,
            };
        }

        fallbackLogger.info('clipboard fallback params ready', {
            keys: Object.keys(params),
        });
        return {
            status: 'ready',
            clipboardContent: clipboardContent ?? '',
            params,
        };
    } catch (error) {
        fallbackLogger.warn('clipboard fallback read failed', { error });
        return {
            status: 'read_failed',
            clipboardContent: '',
            params: null,
        };
    }
};
