import { logAppsFlyerEvent } from '@/services/appsFlyerAttribution';

const normalizeWebViewAppsFlyerEventValue = (eventValue) => {
    if (!eventValue || typeof eventValue !== 'object' || Array.isArray(eventValue)) {
        return {};
    }

    return eventValue;
};

export const reportWebViewAppsFlyerEvent = async ({ eventName, eventValue } = {}) => {
    const normalizedEventName = String(eventName ?? '').trim();
    const normalizedEventValue = normalizeWebViewAppsFlyerEventValue(eventValue);

    if (normalizedEventName === 'openWindow') {
        return await logAppsFlyerEvent(normalizedEventName, {});
    }

    return await logAppsFlyerEvent(normalizedEventName, normalizedEventValue);
};

export const readWebViewOpenWindowUrl = ({ eventName, eventValue } = {}) => {
    const normalizedEventName = String(eventName ?? '').trim();
    if (normalizedEventName !== 'openWindow') {
        return '';
    }

    const normalizedEventValue = normalizeWebViewAppsFlyerEventValue(eventValue);
    return normalizedEventValue.url ? String(normalizedEventValue.url) : '';
};
