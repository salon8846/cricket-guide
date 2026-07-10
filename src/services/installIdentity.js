import { APP_STORAGE_KEYS } from '@/constants/storageKeys';
import { getItemOrThrow, setItemOrThrow } from '@/utils/storage';
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

const readStoredInstallIdOrThrow = async () => {
    return normalizeUuidV4(await getItemOrThrow(APP_STORAGE_KEYS.identity.installId));
};

export const readInstallId = async () => {
    if (installIdState.cachedInstallId) {
        return installIdState.cachedInstallId;
    }

    try {
        const installId = await readStoredInstallIdOrThrow();
        if (installId) {
            installIdState.cachedInstallId = installId;
        }
        return installId;
    } catch (error) {
        logger.warn('installId read failed', { error });
        return '';
    }
};

export const ensureInstallId = async () => {
    if (installIdState.cachedInstallId) {
        return installIdState.cachedInstallId;
    }

    if (installIdState.pendingInstallId) {
        return await installIdState.pendingInstallId;
    }

    installIdState.pendingInstallId = (async () => {
        let savedInstallId = '';
        try {
            savedInstallId = await readStoredInstallIdOrThrow();
        } catch (error) {
            logger.warn('installId read failed', { error });
            return '';
        }

        if (savedInstallId) {
            installIdState.cachedInstallId = savedInstallId;
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
