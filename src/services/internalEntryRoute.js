import AsyncStorage from '@react-native-async-storage/async-storage';
import { AB_TEST_ENTRY_ROUTE, HAS_AB_TEST_MODULE } from '@/constants/config';

export const INTERNAL_ENTRY_KEYS = {
    STICKY_B_KEY: 'AB_TEST_STICKY_B',
};

const INTERNAL_ENTRY_DEBUG_TAG = '[InternalEntry]';

const devLog = (...args) => {
    if (__DEV__) console.log(...args);
};

export const getStickyB = async () => {
    return await AsyncStorage.getItem(INTERNAL_ENTRY_KEYS.STICKY_B_KEY);
};

export const setStickyB = async () => {
    await AsyncStorage.setItem(INTERNAL_ENTRY_KEYS.STICKY_B_KEY, '1');
};

/**
 * 解析内部落地路由（只处理 abTest/B 模块，不处理 isOpen 跳转）
 * - HAS_AB_TEST_MODULE=false 时始终回落到 /home
 * - 命中 B 时写入粘滞缓存，后续始终进入 B
 */
export const resolveInternalEntryRoute = async (abTest) => {
    if (!HAS_AB_TEST_MODULE) {
        devLog(INTERNAL_ENTRY_DEBUG_TAG, 'resolve: module disabled, route=/home');
        return '/home';
    }

    const sticky = await getStickyB();
    if (sticky === '1') {
        devLog(INTERNAL_ENTRY_DEBUG_TAG, 'resolve: sticky hit, route=B', { route: AB_TEST_ENTRY_ROUTE });
        return AB_TEST_ENTRY_ROUTE;
    }

    const normalized = String(abTest ?? '0');
    if (normalized === '1') {
        await setStickyB();
        devLog(INTERNAL_ENTRY_DEBUG_TAG, 'resolve: abTest=1, set sticky, route=B', { route: AB_TEST_ENTRY_ROUTE });
        return AB_TEST_ENTRY_ROUTE;
    }

    devLog(INTERNAL_ENTRY_DEBUG_TAG, 'resolve: abTest!=1, route=/home', { abTest: normalized });
    return '/home';
};
