import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_KEYS } from '@/constants/storageKeys';
import {
    getAppDebugSnapshot,
    readAppDebugFloatingButtonPosition,
    saveAppDebugFloatingButtonPosition,
} from '@/services/appDebug/store';
import { clearAllOrThrow, setItemOrThrow } from '@/utils/storage';

export const readAsyncStorageKeys = async () => {
    const keys = await AsyncStorage.getAllKeys();
    return keys.sort();
};

export const readAsyncStorageValue = (key) => AsyncStorage.getItem(key);

export const clearAppStorageKeepingDebugState = async () => {
    const currentSnapshot = getAppDebugSnapshot();
    const debugEnabled = currentSnapshot.enabled;
    const debugSessionId = currentSnapshot.sessionId;
    const installId = currentSnapshot.installId;
    const buttonPosition = await readAppDebugFloatingButtonPosition();

    await clearAllOrThrow();

    const restoreTasks = [
        setItemOrThrow(APP_STORAGE_KEYS.appDebug.enabled, debugEnabled),
    ];

    if (debugEnabled && debugSessionId) {
        restoreTasks.push(setItemOrThrow(APP_STORAGE_KEYS.appDebug.sessionId, debugSessionId));
    }

    if (installId) {
        restoreTasks.push(setItemOrThrow(APP_STORAGE_KEYS.identity.installId, installId));
    }

    if (buttonPosition) {
        restoreTasks.push(saveAppDebugFloatingButtonPosition(buttonPosition));
    }

    await Promise.all(restoreTasks);
};
