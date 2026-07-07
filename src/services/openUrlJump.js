import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { systemApi } from '@/services/api';
import { normalizeAttributionDeepLinkParams } from '@/services/attributionReporter';
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
 * - OPEN_URL_ATTRIBUTION_DEEP_LINK_PARAMS_CACHE: 确定跳转时缓存本次命中的归因 deep link 参数
 * - OPEN_URL_ATTRIBUTION_CLIPBOARD_FALLBACK_PENDING: 归因 deep link 失败后的剪贴板 JSON 兜底任务
 */
export const OPEN_URL_KEYS = {
    JUMP_FLAG_KEY: 'OPEN_URL_JUMPED',
    DEFERRED_JUMP_KEY: 'OPEN_URL_DEFERRED_JUMP',
    CLIPBOARD_CONTENT_CACHE_KEY: 'OPEN_URL_CLIPBOARD_CONTENT_CACHE',
    CLIPBOARD_CONFIG_CACHE_KEY: 'OPEN_URL_CLIPBOARD_CONFIG_CACHE',
    ATTRIBUTION_DEEP_LINK_PARAMS_CACHE_KEY: 'OPEN_URL_ATTRIBUTION_DEEP_LINK_PARAMS_CACHE',
    ATTRIBUTION_CLIPBOARD_FALLBACK_PENDING_KEY: 'OPEN_URL_ATTRIBUTION_CLIPBOARD_FALLBACK_PENDING',
};

const deferredJumpLogger = createLogger('DeferredJump', { devOnly: true });
const ATTRIBUTION_CLIPBOARD_FALLBACK_EXPIRE_MS = 24 * 60 * 60 * 1000;

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

const normalizeAttributionClipboardFallbackPending = (pending) => {
    if (!pending || typeof pending !== 'object' || Array.isArray(pending)) {
        return null;
    }

    const createdAtMs = Number(pending.createdAtMs);
    if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) {
        return null;
    }

    return {
        createdAtMs,
        lastStatus: String(pending.lastStatus ?? ''),
        reason: String(pending.reason ?? ''),
        readClipboard: String(pending.readClipboard ?? '0'),
        abTest: String(pending.abTest ?? '0'),
    };
};

/** 清理归因剪贴板 JSON 兜底任务 */
export const clearAttributionClipboardFallbackPending = async () => {
    await AsyncStorage.removeItem(OPEN_URL_KEYS.ATTRIBUTION_CLIPBOARD_FALLBACK_PENDING_KEY).catch(() => { });
};

/** 读取归因剪贴板 JSON 兜底任务；过期或损坏时返回 null */
export const readAttributionClipboardFallbackPending = async () => {
    const rawPending = await AsyncStorage.getItem(OPEN_URL_KEYS.ATTRIBUTION_CLIPBOARD_FALLBACK_PENDING_KEY).catch(() => null);
    const pending = normalizeAttributionClipboardFallbackPending(rawPending ? safeJsonParse(rawPending) : null);
    if (!pending) {
        return null;
    }

    if (Date.now() - pending.createdAtMs > ATTRIBUTION_CLIPBOARD_FALLBACK_EXPIRE_MS) {
        await clearAttributionClipboardFallbackPending();
        deferredJumpLogger.info('attribution clipboard fallback: expired, cleared');
        return null;
    }

    return pending;
};

/** 保存归因 deep link 失败后的剪贴板 JSON 兜底任务 */
export const saveAttributionClipboardFallbackPending = async ({ reason, readClipboard, abTest }) => {
    const existingPending = await readAttributionClipboardFallbackPending();
    const pending = existingPending ?? {
        createdAtMs: Date.now(),
        lastStatus: '',
        reason: String(reason ?? ''),
        readClipboard: String(readClipboard ?? '0'),
        abTest: String(abTest ?? '0'),
    };

    const nextPending = {
        ...pending,
        reason: String(reason ?? pending.reason ?? ''),
        readClipboard: String(readClipboard ?? pending.readClipboard ?? '0'),
        abTest: String(abTest ?? pending.abTest ?? '0'),
    };

    await AsyncStorage.setItem(
        OPEN_URL_KEYS.ATTRIBUTION_CLIPBOARD_FALLBACK_PENDING_KEY,
        JSON.stringify(nextPending),
    ).catch(() => { });
    deferredJumpLogger.info('attribution clipboard fallback: pending saved', {
        reason: nextPending.reason,
    });
    return nextPending;
};

/** 记录一次归因剪贴板 JSON 兜底尝试 */
export const recordAttributionClipboardFallbackAttempt = async (status) => {
    const pending = await readAttributionClipboardFallbackPending();
    if (!pending) {
        return null;
    }

    const nextPending = {
        ...pending,
        lastStatus: String(status ?? ''),
    };

    await AsyncStorage.setItem(
        OPEN_URL_KEYS.ATTRIBUTION_CLIPBOARD_FALLBACK_PENDING_KEY,
        JSON.stringify(nextPending),
    ).catch(() => { });
    return nextPending;
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

/** 读取已保存的归因 deep link 参数；null 表示没有可用缓存 */
export const getCachedAttributionDeepLinkParams = async () => {
    const rawDeepLinkParams = await AsyncStorage.getItem(OPEN_URL_KEYS.ATTRIBUTION_DEEP_LINK_PARAMS_CACHE_KEY).catch(() => null);
    const parsedDeepLinkParams = rawDeepLinkParams ? safeJsonParse(rawDeepLinkParams) : null;
    return normalizeAttributionDeepLinkParams(parsedDeepLinkParams);
};

/** 覆盖已保存的归因 deep link 参数；传入无效参数时保留旧缓存 */
export const overwriteCachedAttributionDeepLinkParams = async (attributionDeepLinkParams) => {
    const nextAttributionDeepLinkParams = normalizeAttributionDeepLinkParams(attributionDeepLinkParams);
    if (!nextAttributionDeepLinkParams) {
        deferredJumpLogger.info('attribution deep link params cache: overwrite skipped');
        return null;
    }

    await AsyncStorage.setItem(
        OPEN_URL_KEYS.ATTRIBUTION_DEEP_LINK_PARAMS_CACHE_KEY,
        JSON.stringify(nextAttributionDeepLinkParams),
    ).catch(() => { });
    deferredJumpLogger.info('attribution deep link params cache: overwritten', {
        keys: Object.keys(nextAttributionDeepLinkParams),
    });
    return nextAttributionDeepLinkParams;
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

/** 缓存已确定跳转的归因 deep link 参数 */
export const cacheAttributionDeepLinkParamsForJump = async ({ attributionDeepLinkParams, isOpen, linkType, targetUrl }) => {
    const nextAttributionDeepLinkParams = normalizeAttributionDeepLinkParams(attributionDeepLinkParams);
    const nextTargetUrl = String(targetUrl ?? '');
    const shouldCacheAttributionDeepLinkParams = nextAttributionDeepLinkParams !== null
        && String(isOpen ?? '') === '1'
        && nextTargetUrl.length > 0
        && isSupportedLinkType(linkType);

    if (shouldCacheAttributionDeepLinkParams) {
        await AsyncStorage.setItem(
            OPEN_URL_KEYS.ATTRIBUTION_DEEP_LINK_PARAMS_CACHE_KEY,
            JSON.stringify(nextAttributionDeepLinkParams),
        ).catch(() => { });
        deferredJumpLogger.info('attribution deep link params cache: saved', {
            keys: Object.keys(nextAttributionDeepLinkParams),
        });
    }
};

/**
 * WebView 跳转前将本次命中的归因 deep link 参数合并进目标 URL。
 * 同名 query 以归因参数为准；无有效参数或 URL 无法解析时返回原始 URL。
 */
export const appendAttributionDeepLinkParamsToWebViewUrl = (targetUrl, attributionDeepLinkParams) => {
    const normalizedDeepLinkParams = normalizeAttributionDeepLinkParams(attributionDeepLinkParams);
    if (!normalizedDeepLinkParams) {
        return targetUrl;
    }

    try {
        const parsedUrl = new URL(targetUrl);
        Object.entries(normalizedDeepLinkParams.urlParams).forEach(([key, value]) => {
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
export const jumpByLinkType = async ({ router, linkType, targetUrl, attributionDeepLinkParams = null }) => {
    const t = normalizeLinkType(linkType);
    if (!isSupportedLinkType(t) || !targetUrl) return null;

    systemApi.sendStat('jump').catch(() => { });

    if (t === '1') {
        const webViewTargetUrl = appendAttributionDeepLinkParamsToWebViewUrl(targetUrl, attributionDeepLinkParams);
        deferredJumpLogger.info('jump: webview', {
            urlLen: webViewTargetUrl?.length ?? 0,
            hasAttributionDeepLinkParams: normalizeAttributionDeepLinkParams(attributionDeepLinkParams) !== null,
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
