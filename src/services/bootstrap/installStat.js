import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_KEYS } from '@/constants/storageKeys';
import { systemApi } from '@/services/api/system';
import { createDebugLogger } from '@/utils/logger';

const logger = createDebugLogger('DeferredJump');

export const sendInstallStatOnce = async () => {
    let installed = null;
    try {
        installed = await AsyncStorage.getItem(APP_STORAGE_KEYS.stat.installed);
    } catch (error) {
        logger.warn('stat: install flag read failed', { error });
        return;
    }

    if (installed) {
        return;
    }

    logger.info('stat: install');
    try {
        await systemApi.sendStat('install');
        await AsyncStorage.setItem(APP_STORAGE_KEYS.stat.installed, '1');
    } catch (error) {
        logger.warn('stat: install failed', { error });
    }
};
