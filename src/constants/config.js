import Constants from 'expo-constants';
import { API_URLS, REQUEST_SECRETS } from './config.private';

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

const trimTrailingSlash = (value) => {
    return `${value ?? ''}`.trim().replace(/\/+$/, '');
};

const normalizePathPrefix = (value) => {
    const path = `${value ?? ''}`.trim();
    const normalizedPath = path.replace(/^\/+|\/+$/g, '');
    return normalizedPath ? `/${normalizedPath}` : '';
};

export const API_BASE_PATH = normalizePathPrefix(API_URLS.basePath);
export const DEV_API_ROOT_URL = trimTrailingSlash(API_URLS.devRootUrl);
export const PROD_API_ROOT_URLS = (API_URLS.prodRootUrls ?? [])
    .filter(Boolean)
    .map(trimTrailingSlash);

export const buildApiBaseURL = (rootUrl) => {
    const apiRootUrl = trimTrailingSlash(rootUrl);
    return apiRootUrl ? `${apiRootUrl}${API_BASE_PATH}` : '';
};

export const API_BASE_URL = IsDev
    ? buildApiBaseURL(DEV_API_ROOT_URL)
    : buildApiBaseURL(PROD_API_ROOT_URLS[0]);

export const API_HEALTH_PATH = `${API_BASE_PATH}/health`;

export const REQUEST_TIMEOUT = 15000;

export const APP_CONFIG = {
    name: APP_NAME,
    version: APP_VERSION,
    pageSize: 20,           // 列表默认每页条数
    maxRetryCount: 3,       // 最大重试次数
    appId: REQUEST_SECRETS.appId,
    appKey: REQUEST_SECRETS.appKey,
    aesKey: REQUEST_SECRETS.aesKey,
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
    API_BASE_PATH,
    DEV_API_ROOT_URL,
    PROD_API_ROOT_URLS,
    buildApiBaseURL,
    API_BASE_URL,
    API_HEALTH_PATH,
    REQUEST_TIMEOUT,
    APP_CONFIG,
    AB_TEST_ENTRY_ROUTE,
    HAS_AB_TEST_MODULE,
};
