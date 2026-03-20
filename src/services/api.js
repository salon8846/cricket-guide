import { Dimensions } from 'react-native';
import { getLocales, getCalendars } from 'expo-localization';
import * as Device from 'expo-device';
import request from './request';

// ---- 系统模块 ----
export const systemApi = {
    /** App 启动初始化，上报设备基础信息 */
    init: () => {
        return request.post('/system/init', {});
    },
    getOpenUrl: (clipboardContent = '', h5Verify = '') => {
        const { width, height } = Dimensions.get('screen');
        const pixelRatio = require('react-native').PixelRatio.get();

        // 获取系统语言（expo-localization 在 Expo Go / Web / 打包后均可正确读取设备语言）
        const locale = getLocales()?.[0]?.languageTag ?? 'en';

        // React Native 未暴露 CPU 核数 API，固定上报 0，由后端忽略
        const cpuCores = 0;
        const phoneModel = Device.modelName ?? '';
        const systemVersion = `${Device.osName ?? ''} ${Device.osVersion ?? ''}`.trim();
        const timezone = getCalendars()?.[0]?.timeZone ?? '';

        const data = {
            language: locale,
            screenWidth: Math.round(width),
            screenHeight: Math.round(height),
            pixelRatio: pixelRatio,
            cpuCores: cpuCores,
            phoneModel: phoneModel,
            systemVersion: systemVersion,
            timezone: timezone,
            h5Verify: h5Verify,
            clipboardContent: clipboardContent
        };
        console.log('data', data);
        return request.post('/system/getOpenUrl', data);
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
