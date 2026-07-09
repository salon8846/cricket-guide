import { NativeModules } from 'react-native';

const MODULE_NAME = 'AppNativeCrashReports';

const getNativeCrashReportsModule = () => {
    const nativeModule = NativeModules[MODULE_NAME];
    return nativeModule && typeof nativeModule === 'object' ? nativeModule : null;
};

export const flushPendingNativeCrashReports = async () => {
    const nativeModule = getNativeCrashReportsModule();
    if (!nativeModule?.flushPendingNativeCrashReports) {
        return { available: false };
    }

    return await nativeModule.flushPendingNativeCrashReports();
};

export const triggerNativeCrash = async () => {
    const nativeModule = getNativeCrashReportsModule();
    if (!nativeModule?.triggerNativeCrash) {
        throw new Error('Native crash test module is unavailable. Use an Expo Dev Client or release build.');
    }

    return await nativeModule.triggerNativeCrash();
};
