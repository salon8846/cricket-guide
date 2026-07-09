import { APP_STORAGE_KEYS } from '@/constants/storageKeys';
import { getItem, setItem } from '@/utils/storage';
import { createUuidV4, normalizeUuidV4 } from '@/utils/uuid';

export const readInstallId = async () => {
    return normalizeUuidV4(await getItem(APP_STORAGE_KEYS.identity.installId));
};

export const ensureInstallId = async () => {
    const savedInstallId = await readInstallId();
    if (savedInstallId) {
        return savedInstallId;
    }

    const installId = createUuidV4();
    await setItem(APP_STORAGE_KEYS.identity.installId, installId);
    return await readInstallId();
};
