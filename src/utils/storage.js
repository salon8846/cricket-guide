import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/config';

/**
 * 通用存储工具，对 AsyncStorage 进行封装
 */

/** 存储任意数据（自动 JSON 序列化） */
export const setItem = async (key, value) => {
    try {
        const jsonValue = JSON.stringify(value);
        await AsyncStorage.setItem(key, jsonValue);
    } catch (e) {
        console.error(`[Storage] setItem 失败 key=${key}`, e);
    }
};

/** 读取任意数据（自动 JSON 反序列化） */
export const getItem = async (key) => {
    try {
        const jsonValue = await AsyncStorage.getItem(key);
        return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
        console.error(`[Storage] getItem 失败 key=${key}`, e);
        return null;
    }
};

/** 删除指定 key */
export const removeItem = async (key) => {
    try {
        await AsyncStorage.removeItem(key);
    } catch (e) {
        console.error(`[Storage] removeItem 失败 key=${key}`, e);
    }
};

/** 清空所有存储 */
export const clearAll = async () => {
    try {
        await AsyncStorage.clear();
    } catch (e) {
        console.error('[Storage] clearAll 失败', e);
    }
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const getLangCacheMap = async (key) => {
    const value = await getItem(key);
    return isPlainObject(value) ? value : {};
};

const getLegacyLangVer = async () => {
    const value = await getItem(STORAGE_KEYS.LANG_VER);
    return typeof value === 'number' ? value : 0;
};

const getLegacyLangTranslations = async () => {
    const value = await getItem(STORAGE_KEYS.LANG_TRANSLATIONS);
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
export const setToken = (token) => setItem(STORAGE_KEYS.TOKEN, token);
export const getToken = () => getItem(STORAGE_KEYS.TOKEN);
export const removeToken = () => removeItem(STORAGE_KEYS.TOKEN);

// --- 用户信息快捷方法 ---
export const setUserInfo = (userInfo) => setItem(STORAGE_KEYS.USER_INFO, userInfo);
export const getUserInfo = () => getItem(STORAGE_KEYS.USER_INFO);
export const removeUserInfo = () => removeItem(STORAGE_KEYS.USER_INFO);

// --- 语言快捷方法（默认 'en'）---
export const setLanguage = (lang) => setItem(STORAGE_KEYS.LANGUAGE, lang);
export const getLanguage = async () => (await getItem(STORAGE_KEYS.LANGUAGE)) || 'en';
/** 获取语言原始存储值，若从未设置则返回 null（用于判断是否首次安装） */
export const getRawLanguage = async () => {
    try {
        return await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
    } catch {
        return null;
    }
};

export const getLangCache = async (lang, syncLegacy = false) => {
    if (!lang) {
        return { ver: 0, translations: {} };
    }

    const [verCacheMap, translationsCacheMap] = await Promise.all([
        getLangCacheMap(STORAGE_KEYS.LANG_VER_CACHE),
        getLangCacheMap(STORAGE_KEYS.LANG_TRANSLATIONS_CACHE),
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
        tasks.push(setItem(STORAGE_KEYS.LANG_VER_CACHE, {
            ...verCacheMap,
            [lang]: legacyVer,
        }));
    }

    if (!hasOwn(translationsCacheMap, lang) && Object.keys(legacyTranslations).length > 0) {
        translations = legacyTranslations;
        tasks.push(setItem(STORAGE_KEYS.LANG_TRANSLATIONS_CACHE, {
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
        getLangCacheMap(STORAGE_KEYS.LANG_VER_CACHE),
        getLangCacheMap(STORAGE_KEYS.LANG_TRANSLATIONS_CACHE),
    ]);

    await Promise.all([
        setItem(STORAGE_KEYS.LANG_VER_CACHE, {
            ...verCacheMap,
            [lang]: ver,
        }),
        setItem(STORAGE_KEYS.LANG_TRANSLATIONS_CACHE, {
            ...translationsCacheMap,
            [lang]: safeTranslations,
        }),
        setItem(STORAGE_KEYS.LANG_VER, ver),
        setItem(STORAGE_KEYS.LANG_TRANSLATIONS, safeTranslations),
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
