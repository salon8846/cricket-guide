import Constants from 'expo-constants';

/**
 * 全局配置
 */

// 环境判断 (__DEV__ 是 React Native 内置的开发环境变量)
export const IsDev = __DEV__;

const getConfiguredAppScheme = () => {
    const scheme = Constants.expoConfig?.scheme;
    return Array.isArray(scheme) ? scheme[0] : scheme;
};

export const APP_SCHEME = getConfiguredAppScheme();
export const APP_NAME = Constants.expoConfig?.name;
export const APP_VERSION = Constants.expoConfig?.version;

export const API_BASE_URL = IsDev
    ? 'https://goapi0099.xctsappet.com/api'
    : 'https://api-ftcb.apiapp123.com/api';
export const PROD_DOMAINS = [
    'https://api-ftcb.apiapp123.link',
    'https://api-ftcb.apiapp123.click'
];

export const HEALTH_PATH = '/api/health';

export const REQUEST_TIMEOUT = 15000;

export const STORAGE_KEYS = {
    TOKEN: '@app_token',
    USER_INFO: '@app_user_info',
    SETTINGS: '@app_settings',
    LANGUAGE: '@app_language',
    INSTALL_TIME: '@app_install_time',
    LANG_VER: '@lang_ver',
    LANG_TRANSLATIONS: '@lang_translations',
    LANG_VER_CACHE: '@lang_ver_cache',
    LANG_TRANSLATIONS_CACHE: '@lang_translations_cache',
};

export const APP_CONFIG = {
    name: APP_NAME,
    version: APP_VERSION,
    pageSize: 20,           // 列表默认每页条数
    maxRetryCount: 3,       // 最大重试次数
    appId: 99,
    appKey: 'f06eb3e5cfc99aae8aa71ac2ccbff98a',
    aesKey: '9483cf58fd7bbb46603bed9acb54a230',
};

// abTest 内部分流入口（示例模块：B 模块入口）
export const AB_TEST_ENTRY_ROUTE = '/dexa';
// 是否包含 abTest 模块（下游项目不包含 B 模块时设为 false）
export const HAS_AB_TEST_MODULE = true;

export default {
    IsDev,
    APP_SCHEME,
    APP_NAME,
    APP_VERSION,
    API_BASE_URL,
    REQUEST_TIMEOUT,
    STORAGE_KEYS,
    APP_CONFIG,
    AB_TEST_ENTRY_ROUTE,
    HAS_AB_TEST_MODULE,
};
