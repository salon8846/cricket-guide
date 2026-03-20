/**
 * 全局配置
 */

// 环境判断 (__DEV__ 是 React Native 内置的开发环境变量)
const IsDev = __DEV__;

export const API_BASE_URL = IsDev
    ? 'https://goapi0040.xctsappet.com/api'   // 测试环境，请替换为实际地址
    : 'https://api.airdropsba.com/api'; // 生产环境，请替换为实际地址

export const REQUEST_TIMEOUT = 15000; // 请求超时时间（毫秒）

export const STORAGE_KEYS = {
    TOKEN: '@app_token',
    USER_INFO: '@app_user_info',
    SETTINGS: '@app_settings',
    LANGUAGE: '@app_language',
    LANG_VER: '@lang_ver',
    LANG_TRANSLATIONS: '@lang_translations',
};

export const APP_CONFIG = {
    name: 'baseApp',
    version: '1.0.0',
    pageSize: 20,           // 列表默认每页条数
    maxRetryCount: 3,       // 最大重试次数
    appId: 40,
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
