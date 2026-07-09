import { APP_STORAGE_KEYS } from '@/constants/storageKeys';
import { getItem, setItemOrThrow } from '@/utils/storage';
import { createUuidV4, normalizeUuidV4 } from '@/utils/uuid';
import { createLogger } from '@/utils/logger';

const logger = createLogger('InstallIdentity');

const INSTALL_ID_STATE_KEY = '__APP_INSTALL_ID_STATE__';

const installIdState = (() => {
    if (!globalThis[INSTALL_ID_STATE_KEY]) {
        globalThis[INSTALL_ID_STATE_KEY] = {
            cachedInstallId: '',
            pendingInstallId: null,
        };
    }

    return globalThis[INSTALL_ID_STATE_KEY];
})();

export const readInstallId = async () => {
    if (installIdState.cachedInstallId) {
        return installIdState.cachedInstallId;
    }

    const installId = normalizeUuidV4(await getItem(APP_STORAGE_KEYS.identity.installId));
    if (installId) {
        installIdState.cachedInstallId = installId;
    }
    return installId;
};

export const ensureInstallId = async () => {
    if (installIdState.cachedInstallId) {
        return installIdState.cachedInstallId;
    }

    if (installIdState.pendingInstallId) {
        return await installIdState.pendingInstallId;
    }

    installIdState.pendingInstallId = (async () => {
        const savedInstallId = await readInstallId();
        if (savedInstallId) {
            return savedInstallId;
        }

        const installId = createUuidV4();
        try {
            await setItemOrThrow(APP_STORAGE_KEYS.identity.installId, installId);
            installIdState.cachedInstallId = installId;
            return installId;
        } catch (error) {
            logger.warn('installId persist failed', { error });
            return '';
        }
    })();

    try {
        return await installIdState.pendingInstallId;
    } finally {
        installIdState.pendingInstallId = null;
    }
};

export const clearInstallIdMemoryCache = () => {
    installIdState.cachedInstallId = '';
    installIdState.pendingInstallId = null;
};
