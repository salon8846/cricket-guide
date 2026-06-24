import { logAppsFlyerEvent } from '@/services/appsFlyerAttribution';

const WEBVIEW_APPS_FLYER_EVENTS = new Set([
    'register',
    'submitRecharge',
    'recharge',
    'firstRecharge',
    'recharge2',
    'openWindow',
]);

const normalizeWebViewAppsFlyerEventValue = (eventValue) => {
    if (!eventValue || typeof eventValue !== 'object' || Array.isArray(eventValue)) {
        return {};
    }

    return eventValue;
};

const createUnsupportedWebViewAppsFlyerEventReport = (eventName) => ({
    status: 'failure',
    eventName,
    eventValues: {},
    reason: 'unsupported_event',
    loggedAt: new Date().toISOString(),
});

export const handleWebViewAppsFlyerEvent = async ({ eventName, eventValue } = {}) => {
    const normalizedEventName = String(eventName ?? '').trim();
    if (!WEBVIEW_APPS_FLYER_EVENTS.has(normalizedEventName)) {
        console.warn('Unsupported WebView AppsFlyer event:', normalizedEventName);
        return {
            appsFlyerEventReport: createUnsupportedWebViewAppsFlyerEventReport(normalizedEventName),
            openUrl: '',
        };
    }

    const normalizedEventValue = normalizeWebViewAppsFlyerEventValue(eventValue);

    if (normalizedEventName === 'openWindow') {
        const appsFlyerEventReport = await logAppsFlyerEvent(normalizedEventName, {});
        return {
            appsFlyerEventReport,
            openUrl: normalizedEventValue.url ? String(normalizedEventValue.url) : '',
        };
    }

    const appsFlyerEventReport = await logAppsFlyerEvent(normalizedEventName, normalizedEventValue);
    return {
        appsFlyerEventReport,
        openUrl: '',
    };
};
