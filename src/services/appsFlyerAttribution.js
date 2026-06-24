import Constants from 'expo-constants';
import { Linking, NativeModules, Platform } from 'react-native';
import { STORAGE_KEYS } from '@/constants/config';
import { getItem, setItem } from '@/utils/storage';

const APPS_FLYER_DEBUG_TAG = '[AppsFlyer]';
const APPS_FLYER_OPEN_URL_WAIT_MS = 5000;
const APPS_FLYER_OPEN_URL_POLL_MS = 250;
const APPS_FLYER_EVENT_LOG_TIMEOUT_MS = 8000;
export const APPS_FLYER_DEEP_LINK_PARAM_KEYS = [
    'deep_link_value',
    'deep_link_sub1',
    'deep_link_sub2',
    'deep_link_sub3',
    'deep_link_sub4',
    'deep_link_sub5',
    'deep_link_sub6',
    'deep_link_sub7',
    'deep_link_sub8',
    'deep_link_sub9',
    'deep_link_sub10',
];

const createEmptyAppsFlyerConfig = () => ({
    enabled: false,
    devKey: '',
    iosAppId: '',
    debug: false,
});

let appsFlyerStartTask = null;
let appsFlyerAttributionId = null;
let appsFlyerAttributionSnapshot = null;
let appsFlyerRuntimeConfig = createEmptyAppsFlyerConfig();
let attributionListenersRegistered = false;
let urlOpenListenerRegistered = false;
let latestAppsFlyerDeepLink = null;

const devLog = (...args) => {
    if (__DEV__) console.log(...args);
};

const devWarn = (...args) => {
    if (__DEV__) console.warn(...args);
};

const wait = (timeoutMs) => new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
});

const withTimeout = (task, timeoutMs, timeoutReason) => Promise.race([
    task,
    wait(timeoutMs).then(() => {
        throw new Error(timeoutReason);
    }),
]);

const hasConfiguredValue = (value) => {
    const normalizedValue = String(value ?? '').trim();
    return normalizedValue.length > 0;
};

export const normalizeAppsFlyerDeepLinkParams = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const deepLinkParams = {};
    APPS_FLYER_DEEP_LINK_PARAM_KEYS.forEach((key) => {
        const normalizedValue = String(value[key] ?? '').trim();
        if (normalizedValue) {
            deepLinkParams[key] = normalizedValue;
        }
    });

    return Object.keys(deepLinkParams).length > 0 ? deepLinkParams : null;
};

const normalizeAppsFlyerConfig = (config) => {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return createEmptyAppsFlyerConfig();
    }

    return {
        enabled: config.enabled === true,
        devKey: String(config.devKey ?? ''),
        iosAppId: String(config.iosAppId ?? ''),
        debug: config.debug === true,
    };
};

const getEmptyAppsFlyerAttributionSnapshot = () => ({
    appsFlyerId: appsFlyerAttributionId,
    installConversion: null,
    installConversionFailure: null,
    deepLink: null,
    initialUrl: null,
    latestUrlOpen: null,
    updatedAt: null,
});

const normalizeStoredAppsFlyerAttribution = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return getEmptyAppsFlyerAttributionSnapshot();
    }

    return {
        ...getEmptyAppsFlyerAttributionSnapshot(),
        ...value,
        appsFlyerId: value.appsFlyerId ?? appsFlyerAttributionId,
    };
};

const saveAppsFlyerAttributionSnapshot = async (patch) => {
    const storedSnapshot = appsFlyerAttributionSnapshot
        ?? normalizeStoredAppsFlyerAttribution(await getItem(STORAGE_KEYS.APPS_FLYER_ATTRIBUTION));

    const nextSnapshot = {
        ...storedSnapshot,
        ...patch,
        updatedAt: new Date().toISOString(),
    };

    appsFlyerAttributionSnapshot = nextSnapshot;
    await setItem(STORAGE_KEYS.APPS_FLYER_ATTRIBUTION, nextSnapshot);
    return nextSnapshot;
};

const saveUrlOpenSnapshot = (url, source) => {
    const normalizedUrl = String(url ?? '').trim();
    if (!normalizedUrl) {
        return;
    }

    saveAppsFlyerAttributionSnapshot({
        latestUrlOpen: {
            source,
            url: normalizedUrl,
            openedAt: new Date().toISOString(),
        },
    }).catch((error) => {
        devWarn(APPS_FLYER_DEBUG_TAG, 'url open save failed', error);
    });
};

const readAppsFlyerDeepLinkParams = (deepLink) => {
    if (
        deepLink?.status !== 'success'
        || deepLink?.deepLinkStatus !== 'FOUND'
        || !deepLink?.data
        || typeof deepLink.data !== 'object'
        || Array.isArray(deepLink.data)
    ) {
        return null;
    }

    return normalizeAppsFlyerDeepLinkParams(deepLink.data);
};

export const registerAppsFlyerUrlOpenListener = () => {
    if (urlOpenListenerRegistered || Platform.OS === 'web') {
        return;
    }

    urlOpenListenerRegistered = true;

    Linking.getInitialURL()
        .then((url) => {
            const normalizedUrl = String(url ?? '').trim();
            if (!normalizedUrl) {
                return;
            }

            const openedAt = new Date().toISOString();
            saveAppsFlyerAttributionSnapshot({
                initialUrl: {
                    url: normalizedUrl,
                    openedAt,
                },
                latestUrlOpen: {
                    source: 'initial',
                    url: normalizedUrl,
                    openedAt,
                },
            }).catch((error) => {
                devWarn(APPS_FLYER_DEBUG_TAG, 'initial url save failed', error);
            });
        })
        .catch((error) => {
            devWarn(APPS_FLYER_DEBUG_TAG, 'initial url read failed', error);
        });

    Linking.addEventListener('url', (event) => {
        saveUrlOpenSnapshot(event?.url, 'event');
    });
};

const canLoadAppsFlyerSdk = () => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        return false;
    }

    if (Constants.appOwnership === 'expo') {
        return false;
    }

    return !!NativeModules.RNAppsFlyer;
};

const readAppsFlyerModule = () => {
    if (!canLoadAppsFlyerSdk()) {
        devLog(APPS_FLYER_DEBUG_TAG, 'native module unavailable, skipped');
        return null;
    }

    const module = require('react-native-appsflyer');
    return module?.default ?? module;
};

const normalizeAppsFlyerEventValues = (eventValues) => {
    if (!eventValues || typeof eventValues !== 'object' || Array.isArray(eventValues)) {
        return {};
    }

    const nextEventValues = { ...eventValues };
    const amount = Number(eventValues.amount);
    const currency = String(eventValues.currency ?? '').trim();

    if (Number.isFinite(amount)) {
        nextEventValues.af_revenue = amount;
    }

    if (currency) {
        nextEventValues.af_currency = currency;
    }

    return nextEventValues;
};

const validateAppsFlyerConfig = (config) => {
    if (!config.enabled) {
        devLog(APPS_FLYER_DEBUG_TAG, 'disabled by config');
        return false;
    }

    if (!hasConfiguredValue(config.devKey)) {
        devWarn(APPS_FLYER_DEBUG_TAG, 'missing devKey, skipped');
        return false;
    }

    if (Platform.OS === 'ios' && !hasConfiguredValue(config.iosAppId)) {
        devWarn(APPS_FLYER_DEBUG_TAG, 'missing iosAppId, skipped');
        return false;
    }

    return true;
};

export const configureAppsFlyerAttribution = (config) => {
    const nextConfig = normalizeAppsFlyerConfig(config);
    const configChanged = JSON.stringify(appsFlyerRuntimeConfig) !== JSON.stringify(nextConfig);

    appsFlyerRuntimeConfig = nextConfig;

    if (configChanged && !appsFlyerStartTask) {
        devLog(APPS_FLYER_DEBUG_TAG, 'config updated');
    }

    return appsFlyerRuntimeConfig;
};

const registerAppsFlyerAttributionListeners = (appsFlyer) => {
    if (attributionListenersRegistered) {
        return;
    }

    appsFlyer.onInstallConversionData((data) => {
        devLog(APPS_FLYER_DEBUG_TAG, 'install conversion', data);
        saveAppsFlyerAttributionSnapshot({
            installConversion: data,
            installConversionFailure: null,
        }).catch((error) => {
            devWarn(APPS_FLYER_DEBUG_TAG, 'install conversion save failed', error);
        });
    });

    appsFlyer.onInstallConversionFailure((error) => {
        devWarn(APPS_FLYER_DEBUG_TAG, 'install conversion failure', error);
        saveAppsFlyerAttributionSnapshot({
            installConversionFailure: error,
        }).catch((saveError) => {
            devWarn(APPS_FLYER_DEBUG_TAG, 'install conversion failure save failed', saveError);
        });
    });

    appsFlyer.onDeepLink((data) => {
        latestAppsFlyerDeepLink = data;
        devLog(APPS_FLYER_DEBUG_TAG, 'deep link', data);
        saveAppsFlyerAttributionSnapshot({
            deepLink: data,
        }).catch((error) => {
            devWarn(APPS_FLYER_DEBUG_TAG, 'deep link save failed', error);
        });
    });

    attributionListenersRegistered = true;
};

const readAppsFlyerUidFromSdk = (appsFlyer) => {
    return new Promise((resolve) => {
        appsFlyer.getAppsFlyerUID((error, uid) => {
            if (error) {
                devWarn(APPS_FLYER_DEBUG_TAG, 'uid read failed', error);
                resolve(null);
                return;
            }

            appsFlyerAttributionId = uid ?? null;
            saveAppsFlyerAttributionSnapshot({
                appsFlyerId: appsFlyerAttributionId,
            }).catch((saveError) => {
                devWarn(APPS_FLYER_DEBUG_TAG, 'uid save failed', saveError);
            });
            devLog(APPS_FLYER_DEBUG_TAG, 'uid', appsFlyerAttributionId);
            resolve(appsFlyerAttributionId);
        });
    });
};

export const startAppsFlyerAttribution = () => {
    if (appsFlyerStartTask) {
        return appsFlyerStartTask;
    }

    const config = appsFlyerRuntimeConfig;
    if (!validateAppsFlyerConfig(config)) {
        return Promise.resolve(null);
    }

    appsFlyerStartTask = (async () => {
        const appsFlyer = readAppsFlyerModule();
        if (!appsFlyer) {
            return null;
        }

        registerAppsFlyerAttributionListeners(appsFlyer);

        const initOptions = {
            devKey: config.devKey,
            isDebug: config.debug,
            onInstallConversionDataListener: true,
            onDeepLinkListener: true,
        };

        if (Platform.OS === 'ios') {
            initOptions.appId = config.iosAppId;
        }

        await appsFlyer.initSdk(initOptions);
        devLog(APPS_FLYER_DEBUG_TAG, 'initialized');

        return await readAppsFlyerUidFromSdk(appsFlyer);
    })().catch((error) => {
        appsFlyerStartTask = null;
        devWarn(APPS_FLYER_DEBUG_TAG, 'init failed', error);
        return null;
    });

    return appsFlyerStartTask;
};

export const readAppsFlyerAttributionId = () => appsFlyerAttributionId;

export const readAppsFlyerAttributionSnapshot = async () => {
    if (appsFlyerAttributionSnapshot) {
        return appsFlyerAttributionSnapshot;
    }

    appsFlyerAttributionSnapshot = normalizeStoredAppsFlyerAttribution(
        await getItem(STORAGE_KEYS.APPS_FLYER_ATTRIBUTION),
    );
    return appsFlyerAttributionSnapshot;
};

export const readCurrentAppsFlyerDeepLinkParams = async () => {
    if (!validateAppsFlyerConfig(appsFlyerRuntimeConfig) || !canLoadAppsFlyerSdk()) {
        return null;
    }

    await startAppsFlyerAttribution();

    const deadlineAt = Date.now() + APPS_FLYER_OPEN_URL_WAIT_MS;
    while (Date.now() <= deadlineAt) {
        if (!latestAppsFlyerDeepLink) {
            await wait(APPS_FLYER_OPEN_URL_POLL_MS);
            continue;
        }

        const deepLinkParams = readAppsFlyerDeepLinkParams(latestAppsFlyerDeepLink);
        if (deepLinkParams) {
            devLog(APPS_FLYER_DEBUG_TAG, 'deep link params ready', {
                keys: Object.keys(deepLinkParams),
            });
            return deepLinkParams;
        }

        devWarn(APPS_FLYER_DEBUG_TAG, 'openUrl deep link params unavailable', {
            deepLinkStatus: latestAppsFlyerDeepLink?.deepLinkStatus,
        });
        return null;
    }

    devWarn(APPS_FLYER_DEBUG_TAG, 'openUrl deep link callback unavailable');
    return null;
};

export const logAppsFlyerEvent = async (eventName, eventValues = {}) => {
    const normalizedEventName = String(eventName ?? '').trim();
    if (!normalizedEventName) {
        return {
            status: 'failure',
            eventName: normalizedEventName,
            eventValues: {},
            reason: 'empty_event_name',
            loggedAt: new Date().toISOString(),
        };
    }

    const normalizedEventValues = normalizeAppsFlyerEventValues(eventValues);

    if (!validateAppsFlyerConfig(appsFlyerRuntimeConfig)) {
        return {
            status: 'failure',
            eventName: normalizedEventName,
            eventValues: normalizedEventValues,
            reason: 'invalid_config',
            loggedAt: new Date().toISOString(),
        };
    }

    await startAppsFlyerAttribution();

    const appsFlyer = readAppsFlyerModule();
    if (!appsFlyer) {
        return {
            status: 'failure',
            eventName: normalizedEventName,
            eventValues: normalizedEventValues,
            reason: 'native_module_unavailable',
            loggedAt: new Date().toISOString(),
        };
    }

    try {
        const sdkResponse = await withTimeout(
            appsFlyer.logEvent(normalizedEventName, normalizedEventValues),
            APPS_FLYER_EVENT_LOG_TIMEOUT_MS,
            'event_log_timeout',
        );
        devLog(APPS_FLYER_DEBUG_TAG, 'event logged', {
            eventName: normalizedEventName,
            eventValues: normalizedEventValues,
            sdkResponse,
        });
        return {
            status: 'success',
            eventName: normalizedEventName,
            eventValues: normalizedEventValues,
            sdkResponse,
            loggedAt: new Date().toISOString(),
        };
    } catch (error) {
        devWarn(APPS_FLYER_DEBUG_TAG, 'event log failed', {
            eventName: normalizedEventName,
            error,
        });
        return {
            status: 'failure',
            eventName: normalizedEventName,
            eventValues: normalizedEventValues,
            reason: error?.message === 'event_log_timeout' ? 'sdk_timeout' : 'sdk_rejected',
            error: error?.message ?? String(error),
            loggedAt: new Date().toISOString(),
        };
    }
};
