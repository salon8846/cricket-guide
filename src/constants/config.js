/**
 * 全局配置
 */

// 环境判断 (__DEV__ 是 React Native 内置的开发环境变量)
export const IsDev = __DEV__;

export const API_BASE_URL = IsDev
    ? 'https://goapi0018.xctsappet.com/api'
    : 'https://api.beimeishi.com/api';
export const PROD_DOMAINS = [
    'https://api.beimeishi.com',
    'https://api.beimeishi.click',
    'https://api.beimeishi.link',
];

export const HEALTH_PATH = '/api/health';

export const REQUEST_TIMEOUT = 15000;

export const STORAGE_KEYS = {
    TOKEN: '@app_token',
    USER_INFO: '@app_user_info',
    SETTINGS: '@app_settings',
    LANGUAGE: '@app_language',
    LANG_VER: '@lang_ver',
    LANG_TRANSLATIONS: '@lang_translations',
    LANG_VER_CACHE: '@lang_ver_cache',
    LANG_TRANSLATIONS_CACHE: '@lang_translations_cache',
};

export const APP_CONFIG = {
    name: 'baseApp',
    version: '1.0.0',
    pageSize: 20,           // 列表默认每页条数
    maxRetryCount: 3,       // 最大重试次数
    appId: 18,
    appKey: 'f06eb3e5cfc99aae8aa71ac2ccbff98a',
    aesKey: '9483cf58fd7bbb46603bed9acb54a230',
};

export default {
    IsDev,
    API_BASE_URL,
    REQUEST_TIMEOUT,
    STORAGE_KEYS,
    APP_CONFIG,
};
