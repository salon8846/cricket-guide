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



// --- 语言版本号快捷方法（默认 0）---
export const setLangVer = (ver) => setItem(STORAGE_KEYS.LANG_VER, ver);
export const getLangVer = async () => (await getItem(STORAGE_KEYS.LANG_VER)) || 0;

// --- 翻译表快捷方法 ---
export const setLangTranslations = (translations) => setItem(STORAGE_KEYS.LANG_TRANSLATIONS, translations);
export const getLangTranslations = async () => (await getItem(STORAGE_KEYS.LANG_TRANSLATIONS)) || {};

