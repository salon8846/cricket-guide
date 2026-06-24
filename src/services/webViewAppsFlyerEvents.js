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

export const handleWebViewAppsFlyerEvent = async ({ eventName, eventValue } = {}) => {
    const normalizedEventName = String(eventName ?? '').trim();
    if (!WEBVIEW_APPS_FLYER_EVENTS.has(normalizedEventName)) {
        console.warn('Unsupported WebView AppsFlyer event:', normalizedEventName);
        return null;
    }

    const normalizedEventValue = normalizeWebViewAppsFlyerEventValue(eventValue);

    if (normalizedEventName === 'openWindow') {
        await logAppsFlyerEvent(normalizedEventName, {});
        return {
            action: 'openUrl',
            url: normalizedEventValue.url ? String(normalizedEventValue.url) : '',
        };
    }

    await logAppsFlyerEvent(normalizedEventName, normalizedEventValue);
    return null;
};
