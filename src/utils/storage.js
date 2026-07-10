import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_KEYS } from '@/constants/storageKeys';
import { createLogger } from '@/utils/logger';

const logger = createLogger('Storage');

/**
 * 通用存储工具，对 AsyncStorage 进行 JSON 序列化封装。
 *
 * `try*` 只用于可选缓存或允许缺失的运行辅助数据，失败时记录日志并继续。
 * `*OrThrow` 用于关键状态，调用方必须显式处理失败。
 */
/** 存储可选数据，失败只记录日志。 */
export const trySetItem = async (key, value) => {
    try {
        await setItemOrThrow(key, value);
    } catch (e) {
        logger.error('trySetItem failed', { key, error: e });
    }
};

/** 存储任意 JSON 可序列化数据，失败会抛出。 */
export const setItemOrThrow = async (key, value) => {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
};

/** 读取任意 JSON 存储数据，读取或解析失败会抛出。 */
export const getItemOrThrow = async (key) => {
    const jsonValue = await AsyncStorage.getItem(key);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
};

/** 读取可选数据，失败只记录日志并返回 null。 */
export const tryGetItem = async (key) => {
    try {
        return await getItemOrThrow(key);
    } catch (e) {
        logger.error('tryGetItem failed', { key, error: e });
        return null;
    }
};

/** 删除可选数据，失败只记录日志。 */
export const tryRemoveItem = async (key) => {
    try {
        await removeItemOrThrow(key);
    } catch (e) {
        logger.error('tryRemoveItem failed', { key, error: e });
    }
};

/** 删除指定 key，失败会抛出。 */
export const removeItemOrThrow = async (key) => {
    await AsyncStorage.removeItem(key);
};

/** 清空所有 AsyncStorage 数据，失败会抛出。 */
export const clearAllOrThrow = async () => {
    await AsyncStorage.clear();
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const getLangCacheMap = async (key) => {
    const value = await tryGetItem(key);
    return isPlainObject(value) ? value : {};
};

const getLegacyLangVer = async () => {
    const value = await tryGetItem(APP_STORAGE_KEYS.language.version);
    return typeof value === 'number' ? value : 0;
};

const getLegacyLangTranslations = async () => {
    const value = await tryGetItem(APP_STORAGE_KEYS.language.translations);
    return isPlainObject(value) ? value : {};
};

const getCachedLangVer = (lang, cacheMap) => {
    const value = cacheMap[lang];
    return typeof value === 'number' ? value : 0;
};

const getCachedLangTranslations = (lang, cacheMap) => {
    const value = cacheMap[lang];
    return isPlainObject(value) ? value : {};
};

// --- Token 快捷方法 ---
/** Token 是认证关键状态，写入或删除失败必须交给调用方处理。 */
export const setToken = (token) => setItemOrThrow(APP_STORAGE_KEYS.userSession.token, token);
/** Token 读取失败按未登录处理，避免启动链路被本地存储故障阻断。 */
export const getToken = () => tryGetItem(APP_STORAGE_KEYS.userSession.token);
export const removeToken = () => removeItemOrThrow(APP_STORAGE_KEYS.userSession.token);

// --- 用户信息快捷方法 ---
/** 用户信息写入或删除需要和内存登录态保持一致，失败必须交给调用方处理。 */
export const setUserInfo = (userInfo) => setItemOrThrow(APP_STORAGE_KEYS.userSession.userInfo, userInfo);
/** 用户信息读取失败按未登录处理，避免启动链路被本地存储故障阻断。 */
export const getUserInfo = () => tryGetItem(APP_STORAGE_KEYS.userSession.userInfo);
export const removeUserInfo = () => removeItemOrThrow(APP_STORAGE_KEYS.userSession.userInfo);

// --- 语言快捷方法（默认 'en'）---
/** 语言偏好是可恢复体验状态，写入失败只记录日志并继续使用当前运行态。 */
export const setLanguage = (lang) => trySetItem(APP_STORAGE_KEYS.language.current, lang);
/** 语言读取失败使用默认语言，保证启动和页面渲染可继续。 */
export const getLanguage = async () => (await tryGetItem(APP_STORAGE_KEYS.language.current)) || 'en';
/** 获取语言原始存储值，若从未设置则返回 null（用于判断是否首次安装） */
export const getRawLanguage = async () => {
    try {
        return await AsyncStorage.getItem(APP_STORAGE_KEYS.language.current);
    } catch {
        return null;
    }
};

/** 安装时间用于请求上下文，存储失败允许继续并在下次启动重新计算。 */
export const getInstallTime = async () => {
    const savedInstallTime = await tryGetItem(APP_STORAGE_KEYS.identity.installTime);

    if (typeof savedInstallTime === 'number' && Number.isFinite(savedInstallTime)) {
        const normalizedInstallTime = savedInstallTime > 9999999999
            ? Math.floor(savedInstallTime / 1000)
            : Math.floor(savedInstallTime);

        if (normalizedInstallTime !== savedInstallTime) {
            await trySetItem(APP_STORAGE_KEYS.identity.installTime, normalizedInstallTime);
        }

        return normalizedInstallTime;
    }

    const installTime = Math.floor(Date.now() / 1000);
    await trySetItem(APP_STORAGE_KEYS.identity.installTime, installTime);
    return installTime;
};

/** 读取指定语言的本地缓存；缓存损坏或缺失时返回空版本和空翻译。 */
export const getLangCache = async (lang, syncLegacy = false) => {
    if (!lang) {
        return { ver: 0, translations: {} };
    }

    const [verCacheMap, translationsCacheMap] = await Promise.all([
        getLangCacheMap(APP_STORAGE_KEYS.language.versionCache),
        getLangCacheMap(APP_STORAGE_KEYS.language.translationsCache),
    ]);

    let ver = getCachedLangVer(lang, verCacheMap);
    let translations = getCachedLangTranslations(lang, translationsCacheMap);

    if (!syncLegacy || ver > 0 || Object.keys(translations).length > 0) {
        return { ver, translations };
    }

    const savedRaw = await getRawLanguage();
    const savedLang = savedRaw === null ? null : await getLanguage();
    if (savedLang !== lang) {
        return { ver, translations };
    }

    const [legacyVer, legacyTranslations] = await Promise.all([
        getLegacyLangVer(),
        getLegacyLangTranslations(),
    ]);
    const tasks = [];

    if (!hasOwn(verCacheMap, lang) && legacyVer > 0) {
        ver = legacyVer;
        tasks.push(trySetItem(APP_STORAGE_KEYS.language.versionCache, {
            ...verCacheMap,
            [lang]: legacyVer,
        }));
    }

    if (!hasOwn(translationsCacheMap, lang) && Object.keys(legacyTranslations).length > 0) {
        translations = legacyTranslations;
        tasks.push(trySetItem(APP_STORAGE_KEYS.language.translationsCache, {
            ...translationsCacheMap,
            [lang]: legacyTranslations,
        }));
    }

    if (tasks.length > 0) {
        await Promise.all(tasks);
    }

    return { ver, translations };
};

/** 写入指定语言的本地缓存；失败只记录日志，不阻断当前可用翻译。 */
export const setLangCache = async (lang, ver, translations) => {
    if (!lang) {
        return;
    }

    const safeTranslations = isPlainObject(translations) ? translations : {};
    const [verCacheMap, translationsCacheMap] = await Promise.all([
        getLangCacheMap(APP_STORAGE_KEYS.language.versionCache),
        getLangCacheMap(APP_STORAGE_KEYS.language.translationsCache),
    ]);

    await Promise.all([
        trySetItem(APP_STORAGE_KEYS.language.versionCache, {
            ...verCacheMap,
            [lang]: ver,
        }),
        trySetItem(APP_STORAGE_KEYS.language.translationsCache, {
            ...translationsCacheMap,
            [lang]: safeTranslations,
        }),
        trySetItem(APP_STORAGE_KEYS.language.version, ver),
        trySetItem(APP_STORAGE_KEYS.language.translations, safeTranslations),
    ]);
};

// --- 语言版本号快捷方法（默认 0）---
export const setLangVer = async (lang, ver) => {
    const { translations } = await getLangCache(lang);
    await setLangCache(lang, ver, translations);
};
export const getLangVer = async (lang, syncLegacy = false) => (await getLangCache(lang, syncLegacy)).ver;

// --- 翻译表快捷方法 ---
export const setLangTranslations = async (lang, translations) => {
    const { ver } = await getLangCache(lang);
    await setLangCache(lang, ver, translations);
};
export const getLangTranslations = async (lang, syncLegacy = false) => (await getLangCache(lang, syncLegacy)).translations;
