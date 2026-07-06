import { systemApi } from '@/services/api';
import { logAppsFlyerEvent } from '@/services/appsFlyerAttribution';
import { createLogger } from '@/utils/logger';

const eventReportLogger = createLogger('EventReport');

const normalizeWebViewAppsFlyerEventValue = (eventValue) => {
    if (!eventValue || typeof eventValue !== 'object' || Array.isArray(eventValue)) {
        return {};
    }

    return eventValue;
};

const reportSystemEvent = (eventName, eventValue) => {
    if (!eventName) {
        return;
    }

    systemApi.report({ eventName, eventValue })
        .catch((error) => {
            eventReportLogger.warn('system event report failed', {
                eventName,
                error,
            });
        });
};

export const reportWebViewAppsFlyerEvent = async ({ eventName, eventValue } = {}) => {
    const normalizedEventName = String(eventName ?? '').trim();
    const normalizedEventValue = normalizeWebViewAppsFlyerEventValue(eventValue);

    reportSystemEvent(normalizedEventName, normalizedEventValue);

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
