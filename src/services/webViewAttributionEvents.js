import { systemApi } from '@/services/api';
import { logAttributionEvent } from '@/services/attributionReporter';
import { createLogger } from '@/utils/logger';

const eventReportLogger = createLogger('EventReport');

const normalizeWebViewAttributionEventValue = (eventValue) => {
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

export const reportWebViewAttributionEvent = async ({ eventName, eventValue } = {}) => {
    const normalizedEventName = String(eventName ?? '').trim();
    const normalizedEventValue = normalizeWebViewAttributionEventValue(eventValue);

    reportSystemEvent(normalizedEventName, normalizedEventValue);

    if (normalizedEventName === 'openWindow') {
        return await logAttributionEvent(normalizedEventName, {});
    }

    return await logAttributionEvent(normalizedEventName, normalizedEventValue);
};

export const readWebViewOpenWindowUrl = ({ eventName, eventValue } = {}) => {
    const normalizedEventName = String(eventName ?? '').trim();
    if (normalizedEventName !== 'openWindow') {
        return '';
    }

    const normalizedEventValue = normalizeWebViewAttributionEventValue(eventValue);
    return normalizedEventValue.url ? String(normalizedEventValue.url) : '';
};
