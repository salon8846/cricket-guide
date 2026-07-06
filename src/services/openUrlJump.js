import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { systemApi } from '@/services/api';
import { normalizeAppsFlyerDeepLinkParams } from '@/services/appsFlyerAttribution';
import { createLogger } from '@/utils/logger';

/**
 * OpenUrl 启动策略公共能力（不包含“是否跳转”的业务决策）
 *
 * 设计目标：
 * - 让启动页（首次决策）与静默检测（到点复查）共享同一套 key/解析/跳转逻辑，避免重复与不一致
 * - 所有调试日志仅在 __DEV__ 生效，tag 统一为 `[DeferredJump]`
 *
 * 约定：
 * - OPEN_URL_JUMPED: 标记已发生过跳转（避免重复触发）
 * - OPEN_URL_DEFERRED_JUMP: 静默计时任务（JSON）
 *   - triggerAtMs: number 触发时间（毫秒）
 *   - linkType?: '1' (webview) | '2' (external)
 *   - targetUrl?: string
 *   - fingerprint?: string
 *   - abTest?: '1' | '0'（用于 App 内部落地分流）
 * - OPEN_URL_CLIPBOARD_CONTENT_CACHE: init.readClipboard=1 且确定跳转时缓存本次提交的剪切板内容
 * - OPEN_URL_CLIPBOARD_CONFIG_CACHE: 确定跳转时缓存本次返回的剪切板配置
 * - OPEN_URL_APPS_FLYER_DEEP_LINK_PARAMS_CACHE: 确定跳转时缓存本次命中的 AppsFlyer deep link 参数
 */
export const OPEN_URL_KEYS = {
    JUMP_FLAG_KEY: 'OPEN_URL_JUMPED',
    DEFERRED_JUMP_KEY: 'OPEN_URL_DEFERRED_JUMP',
    CLIPBOARD_CONTENT_CACHE_KEY: 'OPEN_URL_CLIPBOARD_CONTENT_CACHE',
    CLIPBOARD_CONFIG_CACHE_KEY: 'OPEN_URL_CLIPBOARD_CONFIG_CACHE',
    APPS_FLYER_DEEP_LINK_PARAMS_CACHE_KEY: 'OPEN_URL_APPS_FLYER_DEEP_LINK_PARAMS_CACHE',
};

const deferredJumpLogger = createLogger('DeferredJump', { devOnly: true });

/** 将 linkType 规范化为字符串 */
export const normalizeLinkType = (linkType) => String(linkType ?? '');

/** 判断 linkType 是否为已支持的跳转类型 */
export const isSupportedLinkType = (linkType) => {
    const t = normalizeLinkType(linkType);
    return t === '1' || t === '2';
};

/** 安全 JSON.parse，失败返回 null */
export const safeJsonParse = (raw) => {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

/** 规范化 getOpenUrl 返回的剪切板配置；空对象表示没有可用配置 */
export const normalizeOpenUrlClipboardConfig = (clipboardConfig) => {
    if (!clipboardConfig || typeof clipboardConfig !== 'object' || Array.isArray(clipboardConfig)) {
        return {};
    }

    return Object.keys(clipboardConfig).length > 0 ? clipboardConfig : {};
};

/** 判断剪切板配置是否为可缓存、可透传的非空对象 */
export const hasOpenUrlClipboardConfig = (clipboardConfig) => {
    return Object.keys(normalizeOpenUrlClipboardConfig(clipboardConfig)).length > 0;
};

/** 判断 init.data.af 是否允许用最新 AppsFlyer deep link 参数覆盖本地缓存 */
export const canOverrideCachedAppsFlyerDeepLinkParams = (appsFlyerConfig) => {
    return appsFlyerConfig?.allowDeepLinkOverride === true;
};

/** 读取已跳转标记 */
export const getJumpFlag = async () => {
    return await AsyncStorage.getItem(OPEN_URL_KEYS.JUMP_FLAG_KEY).catch(() => null);
};

/** 写入已跳转标记 */
export const setJumpFlag = async () => {
    await AsyncStorage.setItem(OPEN_URL_KEYS.JUMP_FLAG_KEY, '1').catch(() => { });
};

/** 清理静默计时任务 */
export const clearDeferredJump = async () => {
    await AsyncStorage.removeItem(OPEN_URL_KEYS.DEFERRED_JUMP_KEY).catch(() => { });
};

/** 读取已保存的剪切板内容；null 表示没有可用缓存 */
export const getCachedOpenUrlClipboardContent = async () => {
    const clipboardContent = await AsyncStorage.getItem(OPEN_URL_KEYS.CLIPBOARD_CONTENT_CACHE_KEY).catch(() => null);
    return clipboardContent ? clipboardContent : null;
};

/** 读取已保存的剪切板配置；空对象表示没有可用缓存 */
export const getCachedOpenUrlClipboardConfig = async () => {
    const rawClipboardConfig = await AsyncStorage.getItem(OPEN_URL_KEYS.CLIPBOARD_CONFIG_CACHE_KEY).catch(() => null);
    const parsedClipboardConfig = rawClipboardConfig ? safeJsonParse(rawClipboardConfig) : {};
    return normalizeOpenUrlClipboardConfig(parsedClipboardConfig);
};

/** 读取已保存的 AppsFlyer deep link 参数；null 表示没有可用缓存 */
export const getCachedAppsFlyerDeepLinkParams = async () => {
    const rawDeepLinkParams = await AsyncStorage.getItem(OPEN_URL_KEYS.APPS_FLYER_DEEP_LINK_PARAMS_CACHE_KEY).catch(() => null);
    const parsedDeepLinkParams = rawDeepLinkParams ? safeJsonParse(rawDeepLinkParams) : null;
    return normalizeAppsFlyerDeepLinkParams(parsedDeepLinkParams);
};

/** 覆盖已保存的 AppsFlyer deep link 参数；传入无效参数时保留旧缓存 */
export const overwriteCachedAppsFlyerDeepLinkParams = async (appsFlyerDeepLinkParams) => {
    const nextAppsFlyerDeepLinkParams = normalizeAppsFlyerDeepLinkParams(appsFlyerDeepLinkParams);
    if (!nextAppsFlyerDeepLinkParams) {
        deferredJumpLogger.info('AppsFlyer deep link params cache: overwrite skipped');
        return null;
    }

    await AsyncStorage.setItem(
        OPEN_URL_KEYS.APPS_FLYER_DEEP_LINK_PARAMS_CACHE_KEY,
        JSON.stringify(nextAppsFlyerDeepLinkParams),
    ).catch(() => { });
    deferredJumpLogger.info('AppsFlyer deep link params cache: overwritten', {
        keys: Object.keys(nextAppsFlyerDeepLinkParams),
    });
    return nextAppsFlyerDeepLinkParams;
};

/** 缓存已确定跳转的剪切板内容 */
export const cacheOpenUrlClipboardContentForJump = async ({ readClipboard, clipboardContent, isOpen, linkType, targetUrl }) => {
    const nextClipboardContent = String(clipboardContent ?? '');
    const nextTargetUrl = String(targetUrl ?? '');
    const shouldCacheClipboardContent = String(readClipboard ?? '') === '1'
        && nextClipboardContent.length > 0
        && String(isOpen ?? '') === '1'
        && nextTargetUrl.length > 0
        && isSupportedLinkType(linkType);

    if (shouldCacheClipboardContent) {
        const cachedClipboardContent = await getCachedOpenUrlClipboardContent();
        if (cachedClipboardContent !== null) {
            deferredJumpLogger.info('clipboard content cache: skipped, already cached');
            return;
        }

        await AsyncStorage.setItem(OPEN_URL_KEYS.CLIPBOARD_CONTENT_CACHE_KEY, nextClipboardContent).catch(() => { });
        deferredJumpLogger.info('clipboard content cache: saved', { preview: nextClipboardContent.slice(0, 32) });
    }
};

/** 缓存已确定跳转的剪切板配置 */
export const cacheOpenUrlClipboardConfigForJump = async ({ clipboardConfig, isOpen, linkType, targetUrl }) => {
    const nextTargetUrl = String(targetUrl ?? '');
    const nextClipboardConfig = normalizeOpenUrlClipboardConfig(clipboardConfig);
    const shouldCacheClipboardConfig = hasOpenUrlClipboardConfig(nextClipboardConfig)
        && String(isOpen ?? '') === '1'
        && nextTargetUrl.length > 0
        && isSupportedLinkType(linkType);

    if (shouldCacheClipboardConfig) {
        const cachedClipboardConfig = await getCachedOpenUrlClipboardConfig();
        if (hasOpenUrlClipboardConfig(cachedClipboardConfig)) {
            deferredJumpLogger.info('clipboard config cache: skipped, already cached');
            return;
        }

        await AsyncStorage.setItem(
            OPEN_URL_KEYS.CLIPBOARD_CONFIG_CACHE_KEY,
            JSON.stringify(nextClipboardConfig),
        ).catch(() => { });
        deferredJumpLogger.info('clipboard config cache: saved', {
            keys: Object.keys(nextClipboardConfig),
        });
    }
};

/** 缓存已确定跳转的 AppsFlyer deep link 参数 */
export const cacheAppsFlyerDeepLinkParamsForJump = async ({ appsFlyerDeepLinkParams, isOpen, linkType, targetUrl }) => {
    const nextAppsFlyerDeepLinkParams = normalizeAppsFlyerDeepLinkParams(appsFlyerDeepLinkParams);
    const nextTargetUrl = String(targetUrl ?? '');
    const shouldCacheAppsFlyerDeepLinkParams = nextAppsFlyerDeepLinkParams !== null
        && String(isOpen ?? '') === '1'
        && nextTargetUrl.length > 0
        && isSupportedLinkType(linkType);

    if (shouldCacheAppsFlyerDeepLinkParams) {
        await AsyncStorage.setItem(
            OPEN_URL_KEYS.APPS_FLYER_DEEP_LINK_PARAMS_CACHE_KEY,
            JSON.stringify(nextAppsFlyerDeepLinkParams),
        ).catch(() => { });
        deferredJumpLogger.info('AppsFlyer deep link params cache: saved', {
            keys: Object.keys(nextAppsFlyerDeepLinkParams),
        });
    }
};

/**
 * WebView 跳转前将本次命中的 AppsFlyer deep link 参数合并进目标 URL。
 * 同名 query 以 AppsFlyer 参数为准；无有效参数或 URL 无法解析时返回原始 URL。
 */
export const appendAppsFlyerDeepLinkParamsToWebViewUrl = (targetUrl, appsFlyerDeepLinkParams) => {
    const normalizedDeepLinkParams = normalizeAppsFlyerDeepLinkParams(appsFlyerDeepLinkParams);
    if (!normalizedDeepLinkParams) {
        return targetUrl;
    }

    try {
        const parsedUrl = new URL(targetUrl);
        Object.entries(normalizedDeepLinkParams).forEach(([key, value]) => {
            parsedUrl.searchParams.set(key, value);
        });
        return parsedUrl.toString();
    } catch {
        return targetUrl;
    }
};

/** 保存静默计时任务（首次 getOpenUrl 决策的结果） */
export const saveDeferredJump = async ({ triggerAtMs, linkType, targetUrl, fingerprint, abTest, readClipboard }) => {
    await AsyncStorage.setItem(OPEN_URL_KEYS.DEFERRED_JUMP_KEY, JSON.stringify({
        triggerAtMs,
        linkType,
        targetUrl,
        fingerprint: fingerprint ?? '',
        abTest: String(abTest ?? '0'),
        readClipboard: String(readClipboard ?? '0'),
    })).catch(() => { });
};

/**
 * 读取 deferred jump，若计时数据损坏或无效会清理并返回 null
 */
export const readDeferredJump = async () => {
    const raw = await AsyncStorage.getItem(OPEN_URL_KEYS.DEFERRED_JUMP_KEY).catch(() => null);
    if (!raw) return null;

    const parsed = safeJsonParse(raw);
    if (!parsed) {
        deferredJumpLogger.warn('deferred: parse failed, cleared');
        await clearDeferredJump();
        return null;
    }

    const triggerAtMs = Number(parsed?.triggerAtMs ?? 0);
    const linkType = normalizeLinkType(parsed?.linkType ?? '');
    const targetUrl = String(parsed?.targetUrl ?? '');
    const fingerprint = String(parsed?.fingerprint ?? '');
    const abTest = String(parsed?.abTest ?? '0');
    const readClipboard = String(parsed?.readClipboard ?? '0');

    if (!Number.isFinite(triggerAtMs) || triggerAtMs <= 0) {
        deferredJumpLogger.warn('deferred: invalid payload, cleared', {
            triggerAtMs,
            linkType,
            targetUrlLen: targetUrl?.length ?? 0,
        });
        await clearDeferredJump();
        return null;
    }

    return { triggerAtMs, linkType, targetUrl, fingerprint, abTest, readClipboard };
};

/**
 * 按 linkType 执行跳转（会在每次命中跳转时上报 jump）
 * 返回 'webview' | 'external' | null
 */
export const jumpByLinkType = async ({ router, linkType, targetUrl, appsFlyerDeepLinkParams = null }) => {
    const t = normalizeLinkType(linkType);
    if (!isSupportedLinkType(t) || !targetUrl) return null;

    systemApi.sendStat('jump').catch(() => { });

    if (t === '1') {
        const webViewTargetUrl = appendAppsFlyerDeepLinkParamsToWebViewUrl(targetUrl, appsFlyerDeepLinkParams);
        deferredJumpLogger.info('jump: webview', {
            urlLen: webViewTargetUrl?.length ?? 0,
            hasAppsFlyerDeepLinkParams: normalizeAppsFlyerDeepLinkParams(appsFlyerDeepLinkParams) !== null,
        });
        router.replace({
            pathname: '/webview',
            params: { url: encodeURIComponent(webViewTargetUrl) },
        });
        return 'webview';
    }

    if (t === '2') {
        deferredJumpLogger.info('jump: external', { urlLen: targetUrl?.length ?? 0 });
        await Linking.openURL(targetUrl).catch(() => { });
        return 'external';
    }

    return null;
};
