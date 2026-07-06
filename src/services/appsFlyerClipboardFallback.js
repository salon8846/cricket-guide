import * as Clipboard from 'expo-clipboard';
import {
    APPS_FLYER_DEEP_LINK_PARAM_KEYS,
    normalizeAppsFlyerDeepLinkParams,
} from '@/services/appsFlyerAttribution';
import { createLogger } from '@/utils/logger';

const fallbackLogger = createLogger('AppsFlyerClipboardFallback', { devOnly: true });

export const parseAppsFlyerClipboardFallback = (clipboardContent) => {
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

    const allowedParams = {};
    APPS_FLYER_DEEP_LINK_PARAM_KEYS.forEach((key) => {
        if (parsedClipboardContent[key] !== undefined) {
            allowedParams[key] = parsedClipboardContent[key];
        }
    });

    const normalizedParams = normalizeAppsFlyerDeepLinkParams(allowedParams);
    const deepLinkValue = String(normalizedParams?.deep_link_value ?? '').trim();
    return deepLinkValue ? normalizedParams : null;
};

export const readAppsFlyerClipboardFallback = async () => {
    try {
        const clipboardContent = await Clipboard.getStringAsync();
        const params = parseAppsFlyerClipboardFallback(clipboardContent);
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
