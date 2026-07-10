import axios from 'axios';
import { Platform } from 'react-native';
import { MD5 } from 'crypto-js';
import { gcm } from '@noble/ciphers/aes.js';
import { API_BASE_URL, REQUEST_TIMEOUT, APP_CONFIG, IsDev } from '@/constants/config';
import { getActiveBaseURL } from './domainSelector';
import { getAppDebugRequestHeaderValues } from '@/services/appDebug/requestHeaders';
import { ensureInstallId } from '@/services/installIdentity';
import { recordBreadcrumb } from '@/services/logging/breadcrumbs';
import { getToken, getLanguage } from '@/utils/storage';
import { createLogger } from '@/utils/logger';

// 平台标识：android → 'android'，ios → 'ios'，web → 'h5'
const PLATFORM = Platform.select({ android: 'android', ios: 'ios', web: 'h5' });
const logger = createLogger('Request');

// 创建 axios 实例
const request = axios.create({
    baseURL: API_BASE_URL,
    timeout: REQUEST_TIMEOUT,
    headers: {
        'Content-Type': 'application/json',
        'AppId': APP_CONFIG.appId,
        'Ver': APP_CONFIG.version,
        'Platform': PLATFORM,
    },
});

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const createRequestSignature = (timestamp) => MD5(APP_CONFIG.appKey + String(timestamp)).toString();

const normalizeRequestPath = (url) => String(url ?? '').split(/[?#]/)[0];

const shouldRecordApiBreadcrumb = (url) => normalizeRequestPath(url) !== '/system/clientError';

const readRequestPath = (config) => normalizeRequestPath(config?.url);

const readRequestMethod = (config) => String(config?.method ?? 'get').toUpperCase();

const readRequestDuration = (config) => {
    const startedAt = Number(config?.metadata?.startedAt ?? 0);
    return Number.isFinite(startedAt) && startedAt > 0 ? Date.now() - startedAt : undefined;
};

// 避免依赖运行时是否注入 atob / TextDecoder，保证独立发布包解密链路稳定。
const decodeBase64ToBytes = (value) => {
    if (typeof globalThis.atob === 'function') {
        const binary = globalThis.atob(value);
        return Uint8Array.from(binary, (char) => char.charCodeAt(0));
    }

    const sanitized = `${value}`.replace(/\s+/g, '');
    const output = [];
    let buffer = 0;
    let bits = 0;

    for (const char of sanitized) {
        if (char === '=') {
            break;
        }

        const index = BASE64_CHARS.indexOf(char);
        if (index < 0) {
            throw new Error(`Invalid base64 character: ${char}`);
        }

        buffer = (buffer << 6) | index;
        bits += 6;

        if (bits >= 8) {
            bits -= 8;
            output.push((buffer >> bits) & 0xff);
        }
    }

    return Uint8Array.from(output);
};

const encodeAsciiToBytes = (value) => {
    return Uint8Array.from(`${value}`.split('').map((char) => char.charCodeAt(0)));
};

const decodeUtf8Bytes = (value) => {
    if (typeof globalThis.TextDecoder === 'function') {
        return new globalThis.TextDecoder().decode(value);
    }

    const encoded = Array.from(value, (byte) => `%${byte.toString(16).padStart(2, '0')}`).join('');
    return decodeURIComponent(encoded);
};

// 请求拦截器 - 动态注入 baseURL + 签名 + Token
request.interceptors.request.use(
    async (config) => {
        config.metadata = {
            ...(config.metadata ?? {}),
            startedAt: Date.now(),
        };

        if (shouldRecordApiBreadcrumb(config.url)) {
            recordBreadcrumb({
                category: 'api',
                name: 'api.request',
                data: {
                    method: readRequestMethod(config),
                    path: readRequestPath(config),
                },
            });
        }

        // 动态读取当前可用域名（initDomain 完成后就是最优域名）
        config.baseURL = getActiveBaseURL();

        // 每次请求重新计算时间戳和签名，保证时效性
        const timestamp = new Date().getTime();
        const signature = createRequestSignature(timestamp);
        config.headers['Verify-Time'] = timestamp;
        config.headers['Verify-Encrypt'] = signature;

        // 动态读取本地语言（默认 'en'，可切换为 'zh'）
        config.headers['Accept-Language'] = await getLanguage();

        const token = await getToken();
        if (token) {
            config.headers['X-token'] = token;
        }

        config.headers['X-App-Client'] = await ensureInstallId();

        const debugHeaders = getAppDebugRequestHeaderValues();
        Object.entries(debugHeaders).forEach(([key, value]) => {
            config.headers[key] = value;
        });
        return config;
    },
    (error) => Promise.reject(error)
);

// 响应拦截器 - 统一错误处理
request.interceptors.response.use(
    async (response) => {
        const { data } = response;
        if (shouldRecordApiBreadcrumb(response.config?.url)) {
            recordBreadcrumb({
                category: 'api',
                name: 'api.response',
                data: {
                    method: readRequestMethod(response.config),
                    path: readRequestPath(response.config),
                    status: response.status,
                    durationMs: readRequestDuration(response.config),
                },
            });
        }

        if (data.code !== undefined && data.code !== 0) {
            if (shouldRecordApiBreadcrumb(response.config?.url)) {
                recordBreadcrumb({
                    category: 'api',
                    name: 'api.business_error',
                    level: 'warn',
                    data: {
                        method: readRequestMethod(response.config),
                        path: readRequestPath(response.config),
                        code: data.code,
                        durationMs: readRequestDuration(response.config),
                    },
                });
            }
            return Promise.reject(new Error(data.message || '请求失败'));
        }
        if (!IsDev && data.code === 0 && typeof data.data === 'string') {
            try {
                const rawBytes = decodeBase64ToBytes(data.data);
                const keyBytes = encodeAsciiToBytes(APP_CONFIG.aesKey);
                const nonce = rawBytes.slice(0, 12);
                const ciphertext = rawBytes.slice(12);
                const aesGcm = gcm(keyBytes, nonce);
                const decryptedBytes = aesGcm.decrypt(ciphertext);
                const decryptedText = decodeUtf8Bytes(decryptedBytes);
                data.data = JSON.parse(decryptedText);
            } catch (e) {
                logger.error('decrypt failed', { error: e });
                if (shouldRecordApiBreadcrumb(response.config?.url)) {
                    recordBreadcrumb({
                        category: 'api',
                        name: 'api.decrypt_failed',
                        level: 'error',
                        data: {
                            method: readRequestMethod(response.config),
                            path: readRequestPath(response.config),
                            durationMs: readRequestDuration(response.config),
                            message: e?.message,
                        },
                    });
                }
            }
        }
        return data;
    },
    (error) => {
        const config = error.config ?? error.response?.config;
        if (shouldRecordApiBreadcrumb(config?.url)) {
            recordBreadcrumb({
                category: 'api',
                name: 'api.failed',
                level: 'error',
                data: {
                    method: readRequestMethod(config),
                    path: readRequestPath(config),
                    status: error.response?.status,
                    durationMs: readRequestDuration(config),
                    message: error.message,
                },
            });
        }

        if (error.response) {
            const { status } = error.response;
            switch (status) {
                case 401:
                    // Token 过期，可在此处理登出逻辑
                    logger.warn('request unauthorized', { status });
                    break;
                case 403:
                    logger.warn('request forbidden', { status });
                    break;
                case 500:
                    logger.error('server error', { status });
                    break;
                default:
                    logger.error('request failed', { status });
            }
        } else if (error.request) {
            logger.error('network request failed', { error });
        }
        return Promise.reject(error);
    }
);

export default request;
