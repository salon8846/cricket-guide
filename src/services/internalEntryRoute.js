import AsyncStorage from '@react-native-async-storage/async-storage';
import { AB_TEST_ENTRY_ROUTE, HAS_AB_TEST_MODULE } from '@/constants/config';
import { APP_STORAGE_KEYS } from '@/constants/storageKeys';
import { createDebugLogger } from '@/utils/logger';

const internalEntryLogger = createDebugLogger('InternalEntry');

export const getStickyB = async () => {
    return await AsyncStorage.getItem(APP_STORAGE_KEYS.internalEntry.stickyB);
};

export const setStickyB = async () => {
    await AsyncStorage.setItem(APP_STORAGE_KEYS.internalEntry.stickyB, '1');
};

/**
 * 解析内部落地路由（只处理 abTest/B 模块，不处理 isOpen 跳转）
 * - HAS_AB_TEST_MODULE=false 时始终回落到 /home
 * - 命中 B 时写入粘滞缓存，后续始终进入 B
 */
export const resolveInternalEntryRoute = async (abTest) => {
    if (!HAS_AB_TEST_MODULE) {
        internalEntryLogger.info('resolve: module disabled, route=/home');
        return '/home';
    }

    const sticky = await getStickyB();
    if (sticky === '1') {
        internalEntryLogger.info('resolve: sticky hit, route=B', { route: AB_TEST_ENTRY_ROUTE });
        return AB_TEST_ENTRY_ROUTE;
    }

    const normalized = String(abTest ?? '0');
    if (normalized === '1') {
        await setStickyB();
        internalEntryLogger.info('resolve: abTest=1, set sticky, route=B', { route: AB_TEST_ENTRY_ROUTE });
        return AB_TEST_ENTRY_ROUTE;
    }

    internalEntryLogger.info('resolve: abTest!=1, route=/home', { abTest: normalized });
    return '/home';
};
