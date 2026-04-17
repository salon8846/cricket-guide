import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { systemApi } from '@/services/api';

/**
 * OpenUrl 启动策略公共能力（不包含“是否跳转”的业务决策）
 *
 * 设计目标：
 * - 让启动页（首次决策）与静默检测（到点执行）共享同一套 key/解析/跳转逻辑，避免重复与不一致
 * - 所有调试日志仅在 __DEV__ 生效，tag 统一为 `[DeferredJump]`
 *
 * 约定：
 * - OPEN_URL_JUMPED: 标记已发生过跳转（避免重复触发）
 * - OPEN_URL_DEFERRED_JUMP: 静默跳转决策结果（JSON）
 *   - triggerAtMs: number 触发时间（毫秒）
 *   - linkType: '1' (webview) | '2' (external)
 *   - targetUrl: string
 *   - fingerprint?: string
 *   - abTest?: '1' | '0'（用于 App 内部落地分流）
 */
export const OPEN_URL_KEYS = {
    JUMP_FLAG_KEY: 'OPEN_URL_JUMPED',
    DEFERRED_JUMP_KEY: 'OPEN_URL_DEFERRED_JUMP',
};

export const OPEN_URL_DEBUG_TAG = '[DeferredJump]';

/** 仅开发模式输出 log */
export const devLog = (...args) => {
    if (__DEV__) console.log(...args);
};

/** 仅开发模式输出 warn */
export const devWarn = (...args) => {
    if (__DEV__) console.warn(...args);
};

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

/** 读取已跳转标记 */
export const getJumpFlag = async () => {
    return await AsyncStorage.getItem(OPEN_URL_KEYS.JUMP_FLAG_KEY).catch(() => null);
};

/** 写入已跳转标记 */
export const setJumpFlag = async () => {
    await AsyncStorage.setItem(OPEN_URL_KEYS.JUMP_FLAG_KEY, '1').catch(() => { });
};

/** 清理静默跳转决策 */
export const clearDeferredJump = async () => {
    await AsyncStorage.removeItem(OPEN_URL_KEYS.DEFERRED_JUMP_KEY).catch(() => { });
};

/** 保存静默跳转决策（首次 getOpenUrl 决策的结果） */
export const saveDeferredJump = async ({ triggerAtMs, linkType, targetUrl, fingerprint, abTest }) => {
    await AsyncStorage.setItem(OPEN_URL_KEYS.DEFERRED_JUMP_KEY, JSON.stringify({
        triggerAtMs,
        linkType,
        targetUrl,
        fingerprint: fingerprint ?? '',
        abTest: String(abTest ?? '0'),
    })).catch(() => { });
};

/**
 * 读取 deferred jump，若数据损坏或无效会清理并返回 null
 */
export const readDeferredJump = async () => {
    const raw = await AsyncStorage.getItem(OPEN_URL_KEYS.DEFERRED_JUMP_KEY).catch(() => null);
    if (!raw) return null;

    const parsed = safeJsonParse(raw);
    if (!parsed) {
        devWarn(OPEN_URL_DEBUG_TAG, 'deferred: parse failed, cleared');
        await clearDeferredJump();
        return null;
    }

    const triggerAtMs = Number(parsed?.triggerAtMs ?? 0);
    const linkType = normalizeLinkType(parsed?.linkType ?? '');
    const targetUrl = String(parsed?.targetUrl ?? '');
    const fingerprint = String(parsed?.fingerprint ?? '');
    const abTest = String(parsed?.abTest ?? '0');

    if (!Number.isFinite(triggerAtMs) || triggerAtMs <= 0 || !targetUrl || !isSupportedLinkType(linkType)) {
        devWarn(OPEN_URL_DEBUG_TAG, 'deferred: invalid payload, cleared', {
            triggerAtMs,
            linkType,
            targetUrlLen: targetUrl?.length ?? 0,
        });
        await clearDeferredJump();
        return null;
    }

    return { triggerAtMs, linkType, targetUrl, fingerprint, abTest };
};

/**
 * 按 linkType 执行跳转（会在每次命中跳转时上报 jump）
 * 返回 'webview' | 'external' | null
 */
export const jumpByLinkType = async ({ router, linkType, targetUrl }) => {
    const t = normalizeLinkType(linkType);
    if (!isSupportedLinkType(t) || !targetUrl) return null;

    systemApi.sendStat('jump').catch(() => { });

    if (t === '1') {
        devLog(OPEN_URL_DEBUG_TAG, 'jump: webview', { urlLen: targetUrl?.length ?? 0 });
        router.replace({
            pathname: '/webview',
            params: { url: encodeURIComponent(targetUrl) },
        });
        return 'webview';
    }

    if (t === '2') {
        devLog(OPEN_URL_DEBUG_TAG, 'jump: external', { urlLen: targetUrl?.length ?? 0 });
        await Linking.openURL(targetUrl).catch(() => { });
        return 'external';
    }

    return null;
};
