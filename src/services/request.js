import axios from 'axios';
import { Platform } from 'react-native';
import { MD5 } from 'crypto-js';
import { gcm } from '@noble/ciphers/aes';
import { API_BASE_URL, REQUEST_TIMEOUT, APP_CONFIG, IsDev } from '../constants/config';
import { getToken, getLanguage } from '../utils/storage';

// 平台标识：android → 'android'，ios → 'ios'，web → 'h5'
const PLATFORM = Platform.select({ android: 'android', ios: 'ios', web: 'h5' });

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

// 请求拦截器 - 动态签名 + 自动添加 Token
request.interceptors.request.use(
    async (config) => {
        // 每次请求重新计算时间戳和签名，保证时效性
        const timestamp = new Date().getTime();
        const signature = MD5(APP_CONFIG.appKey + String(timestamp)).toString();
        config.headers['Verify-Time'] = timestamp;
        config.headers['Verify-Encrypt'] = signature;

        // 动态读取本地语言（默认 'en'，可切换为 'zh'）
        config.headers['Accept-Language'] = await getLanguage();

        const token = await getToken();
        if (token) {
            config.headers['X-token'] = token;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 响应拦截器 - 统一错误处理
request.interceptors.response.use(
    async (response) => {
        const { data } = response;
        if (data.code !== undefined && data.code !== 0) {
            return Promise.reject(new Error(data.message || '请求失败'));
        }
        if (!IsDev && data.code === 0 && typeof data.data === 'string') {
            try {
                const rawBytes = Uint8Array.from(atob(data.data), c => c.charCodeAt(0));
                const keyBytes = new TextEncoder().encode(APP_CONFIG.aesKey);
                const nonce = rawBytes.slice(0, 12);
                const ciphertext = rawBytes.slice(12);
                const aesGcm = gcm(keyBytes, nonce);
                const decryptedBytes = aesGcm.decrypt(ciphertext);
                const decryptedText = new TextDecoder().decode(decryptedBytes);
                data.data = JSON.parse(decryptedText);
            } catch (e) {
                console.error('[Request] 解密失败:', e);
            }
        }
        return data;
    },
    (error) => {
        if (error.response) {
            const { status } = error.response;
            switch (status) {
                case 401:
                    // Token 过期，可在此处理登出逻辑
                    console.warn('[Request] 未授权，请重新登录');
                    break;
                case 403:
                    console.warn('[Request] 没有权限');
                    break;
                case 500:
                    console.error('[Request] 服务器错误');
                    break;
                default:
                    console.error(`[Request] 请求错误 ${status}`);
            }
        } else if (error.request) {
            console.error('[Request] 网络错误，请检查网络连接');
        }
        return Promise.reject(error);
    }
);

export default request;
