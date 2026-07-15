import { Dimensions } from 'react-native';
import { getLocales, getCalendars } from 'expo-localization';
import * as Device from 'expo-device';
import request from '@/services/request';
import { getInstallTime } from '@/utils/storage';
import { createDebugLogger } from '@/utils/logger';

const deferredJumpLogger = createDebugLogger('DeferredJump');

// ---- 系统模块 ----
export const systemApi = {
    init: () => {
        return request.post('/system/init', {});
    },
    getOpenUrl: async (clipboardContent = '', h5Verify = '', openUrlRuleConfig = {}) => {
        const { width, height } = Dimensions.get('screen');
        const pixelRatio = require('react-native').PixelRatio.get();

        const locale = getLocales()?.[0]?.languageTag ?? 'en';

        // React Native 未暴露 CPU 核数 API，固定上报 0，由后端忽略
        const cpuCores = 0;
        const phoneModel = Device.modelName ?? '';
        const systemVersion = `${Device.osName ?? ''} ${Device.osVersion ?? ''}`.trim();
        const timezone = getCalendars()?.[0]?.timeZone ?? '';
        const installTime = await getInstallTime();
        const normalizedOpenUrlRuleConfig = openUrlRuleConfig
            && typeof openUrlRuleConfig === 'object'
            && !Array.isArray(openUrlRuleConfig)
            ? openUrlRuleConfig
            : {};

        const requestPayload = {
            language: locale,
            screenWidth: Math.round(width),
            screenHeight: Math.round(height),
            pixelRatio: pixelRatio,
            cpuCores: cpuCores,
            phoneModel: phoneModel,
            systemVersion: systemVersion,
            timezone: timezone,
            h5Verify: h5Verify,
            clipboardContent: clipboardContent,
            clipboardConfig: normalizedOpenUrlRuleConfig,
            installTime: installTime,
        };
        deferredJumpLogger.info('getOpenUrl: request payload', requestPayload);
        return request.post('/system/getOpenUrl', requestPayload);
    },
    getTranslations: () => {
        return request.post('/system/getTranslations', {});
    },
    sendStat: (eventType = '') => {
        const data = {
            eventType: eventType
        }
        return request.post('/system/stat', data);
    },
    report: ({ eventName, eventValue } = {}) => {
        const data = {
            eventName: eventName,
            eventValue: eventValue,
        };
        return request.post('/system/report', data);
    },
    clientError: ({ reports } = {}) => {
        const data = {
            reports: Array.isArray(reports) ? reports : [],
        };
        return request.post('/system/clientError', data);
    },
    fingerprintDelete: (fingerprint = '') => {
        const data = {
            fingerprint: fingerprint
        }
        return request.post('/system/fingerprintDelete', data);
    },
};
