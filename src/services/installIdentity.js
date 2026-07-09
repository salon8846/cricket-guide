import { STORAGE_KEYS } from '@/constants/config';
import { getItem, setItem } from '@/utils/storage';
import { createUuidV4, normalizeUuidV4 } from '@/utils/uuid';

export const readInstallId = async () => {
    return normalizeUuidV4(await getItem(STORAGE_KEYS.INSTALL_ID));
};

export const ensureInstallId = async () => {
    const savedInstallId = await readInstallId();
    if (savedInstallId) {
        return savedInstallId;
    }

    const installId = createUuidV4();
    await setItem(STORAGE_KEYS.INSTALL_ID, installId);
    return await readInstallId();
};
