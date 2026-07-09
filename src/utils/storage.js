import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_KEYS } from '@/constants/storageKeys';
import { createLogger } from '@/utils/logger';

const logger = createLogger('Storage');

/**
 * 通用存储工具，对 AsyncStorage 进行封装
 */

/** 存储任意数据（自动 JSON 序列化） */
export const setItem = async (key, value) => {
    try {
        await setItemOrThrow(key, value);
    } catch (e) {
        logger.error('setItem failed', { key, error: e });
    }
};

export const setItemOrThrow = async (key, value) => {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
};

/** 读取任意数据（自动 JSON 反序列化） */
export const getItem = async (key) => {
    try {
        const jsonValue = await AsyncStorage.getItem(key);
        return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
        logger.error('getItem failed', { key, error: e });
        return null;
    }
};

/** 删除指定 key */
export const removeItem = async (key) => {
    try {
        await removeItemOrThrow(key);
    } catch (e) {
        logger.error('removeItem failed', { key, error: e });
    }
};

export const removeItemOrThrow = async (key) => {
    await AsyncStorage.removeItem(key);
};

/** 清空所有存储 */
export const clearAll = async () => {
    try {
        await clearAllOrThrow();
    } catch (e) {
        logger.error('clearAll failed', { error: e });
    }
};

export const clearAllOrThrow = async () => {
    await AsyncStorage.clear();
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const getLangCacheMap = async (key) => {
    const value = await getItem(key);
    return isPlainObject(value) ? value : {};
};

const getLegacyLangVer = async () => {
    const value = await getItem(APP_STORAGE_KEYS.language.version);
    return typeof value === 'number' ? value : 0;
};

const getLegacyLangTranslations = async () => {
    const value = await getItem(APP_STORAGE_KEYS.language.translations);
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
export const setToken = (token) => setItem(APP_STORAGE_KEYS.userSession.token, token);
export const getToken = () => getItem(APP_STORAGE_KEYS.userSession.token);
export const removeToken = () => removeItem(APP_STORAGE_KEYS.userSession.token);

// --- 用户信息快捷方法 ---
export const setUserInfo = (userInfo) => setItem(APP_STORAGE_KEYS.userSession.userInfo, userInfo);
export const getUserInfo = () => getItem(APP_STORAGE_KEYS.userSession.userInfo);
export const removeUserInfo = () => removeItem(APP_STORAGE_KEYS.userSession.userInfo);

// --- 语言快捷方法（默认 'en'）---
export const setLanguage = (lang) => setItem(APP_STORAGE_KEYS.language.current, lang);
export const getLanguage = async () => (await getItem(APP_STORAGE_KEYS.language.current)) || 'en';
/** 获取语言原始存储值，若从未设置则返回 null（用于判断是否首次安装） */
export const getRawLanguage = async () => {
    try {
        return await AsyncStorage.getItem(APP_STORAGE_KEYS.language.current);
    } catch {
        return null;
    }
};

export const getInstallTime = async () => {
    const savedInstallTime = await getItem(APP_STORAGE_KEYS.identity.installTime);

    if (typeof savedInstallTime === 'number' && Number.isFinite(savedInstallTime)) {
        const normalizedInstallTime = savedInstallTime > 9999999999
            ? Math.floor(savedInstallTime / 1000)
            : Math.floor(savedInstallTime);

        if (normalizedInstallTime !== savedInstallTime) {
            await setItem(APP_STORAGE_KEYS.identity.installTime, normalizedInstallTime);
        }

        return normalizedInstallTime;
    }

    const installTime = Math.floor(Date.now() / 1000);
    await setItem(APP_STORAGE_KEYS.identity.installTime, installTime);
    return installTime;
};

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
        tasks.push(setItem(APP_STORAGE_KEYS.language.versionCache, {
            ...verCacheMap,
            [lang]: legacyVer,
        }));
    }

    if (!hasOwn(translationsCacheMap, lang) && Object.keys(legacyTranslations).length > 0) {
        translations = legacyTranslations;
        tasks.push(setItem(APP_STORAGE_KEYS.language.translationsCache, {
            ...translationsCacheMap,
            [lang]: legacyTranslations,
        }));
    }

    if (tasks.length > 0) {
        await Promise.all(tasks);
    }

    return { ver, translations };
};

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
        setItem(APP_STORAGE_KEYS.language.versionCache, {
            ...verCacheMap,
            [lang]: ver,
        }),
        setItem(APP_STORAGE_KEYS.language.translationsCache, {
            ...translationsCacheMap,
            [lang]: safeTranslations,
        }),
        setItem(APP_STORAGE_KEYS.language.version, ver),
        setItem(APP_STORAGE_KEYS.language.translations, safeTranslations),
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
