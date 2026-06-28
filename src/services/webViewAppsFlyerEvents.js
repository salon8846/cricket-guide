import { logAppsFlyerEvent } from '@/services/appsFlyerAttribution';

const normalizeWebViewAppsFlyerEventValue = (eventValue) => {
    if (!eventValue || typeof eventValue !== 'object' || Array.isArray(eventValue)) {
        return {};
    }

    return eventValue;
};

export const handleWebViewAppsFlyerEvent = async ({ eventName, eventValue } = {}) => {
    const normalizedEventName = String(eventName ?? '').trim();
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
