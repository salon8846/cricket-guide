import { Dimensions, NativeModules, Platform } from 'react-native';
import request from './request';

// ---- 系统模块 ----
export const systemApi = {
    /** App 启动初始化，上报设备基础信息 */
    init: () => {
        const { width, height } = Dimensions.get('screen');
        const pixelRatio = require('react-native').PixelRatio.get();

        // 获取系统语言
        const locale =
            Platform.OS === 'ios'
                ? NativeModules.SettingsManager?.settings?.AppleLocale ||
                NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
                'en'
                : NativeModules.I18nManager?.localeIdentifier || 'en';

        // CPU 核数（React Native 未直接暴露，Android 可取，iOS 返回 0 由后端忽略）
        const cpuCores =
            Platform.OS === 'android'
                ? NativeModules.PlatformConstants?.reactNativeVersion
                    ? 0
                    : 0
                : 0;

        const data = {
            language: locale,
            screenWidth: Math.round(width),
            screenHeight: Math.round(height),
            pixelRatio: pixelRatio,
            cpuCores: cpuCores,
        };

        return request.post('/system/init', data);
    },
    getOpenUrl: () => {
        return request.get('/system/getOpenUrl');
    },
    getTranslations: () => {
        return request.post('/system/getTranslations', {});
    },
};

/**
 * API 接口集中管理
 * 按业务模块分组，每个模块导出一个对象
 */

// ---- 用户模块 ----
export const userApi = {
    /** 登录 */
    login: (data) => request.post('/user/login', data),

    /** 获取当前用户信息 */
    getProfile: () => request.get('/user/profile'),

    /** 更新用户信息 */
    updateProfile: (data) => request.put('/user/profile', data),

    /** 登出 */
    logout: () => request.post('/user/logout'),
};

// ---- 示例模块（按业务自行扩展）----
export const exampleApi = {
    /** 获取列表 */
    getList: (params) => request.get('/example/list', { params }),

    /** 获取详情 */
    getDetail: (id) => request.get(`/example/${id}`),

    /** 创建 */
    create: (data) => request.post('/example', data),

    /** 更新 */
    update: (id, data) => request.put(`/example/${id}`, data),

    /** 删除 */
    remove: (id) => request.delete(`/example/${id}`),
};
