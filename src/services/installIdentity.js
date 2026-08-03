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
            restoredInstallIdentity: false,
            pendingInstallIdentity: null,
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
            installIdState.restoredInstallIdentity = true;
        }
        return installId;
    } catch (error) {
        logger.warn('installId read failed', { error });
        return '';
    }
};

export const initializeInstallIdentity = async () => {
    if (installIdState.cachedInstallId) {
        return {
            installId: installIdState.cachedInstallId,
            restoredInstallIdentity: installIdState.restoredInstallIdentity,
        };
    }

    if (installIdState.pendingInstallIdentity) {
        return await installIdState.pendingInstallIdentity;
    }

    installIdState.pendingInstallIdentity = (async () => {
        let savedInstallId = '';
        try {
            savedInstallId = await readStoredInstallIdOrThrow();
        } catch (error) {
            logger.warn('installId read failed', { error });
            return {
                installId: '',
                restoredInstallIdentity: false,
            };
        }

        if (savedInstallId) {
            installIdState.cachedInstallId = savedInstallId;
            installIdState.restoredInstallIdentity = true;
            return {
                installId: savedInstallId,
                restoredInstallIdentity: true,
            };
        }

        const installId = createUuidV4();
        try {
            await setItemOrThrow(APP_STORAGE_KEYS.identity.installId, installId);
            installIdState.cachedInstallId = installId;
            installIdState.restoredInstallIdentity = false;
            return {
                installId,
                restoredInstallIdentity: false,
            };
        } catch (error) {
            logger.warn('installId persist failed', { error });
            return {
                installId: '',
                restoredInstallIdentity: false,
            };
        }
    })();

    try {
        return await installIdState.pendingInstallIdentity;
    } finally {
        installIdState.pendingInstallIdentity = null;
    }
};

export const ensureInstallId = async () => {
    const installIdentity = await initializeInstallIdentity();
    return installIdentity.installId;
};

export const clearInstallIdMemoryCache = () => {
    installIdState.cachedInstallId = '';
    installIdState.restoredInstallIdentity = false;
    installIdState.pendingInstallIdentity = null;
};
