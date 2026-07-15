import { systemApi } from '@/services/api/system';
import {
    logAttributionEvent,
    readAttributionSnapshot,
    startAttributionReporter,
} from '@/services/attribution/reporter';
import { createLogger } from '@/utils/logger';

export const ATTRIBUTION_EVENT_RESULT_NAME = 'attributionEventResult';

const eventReportLogger = createLogger('WebViewAttribution');

const snapshotResponseByAction = {
    getAttributionSnapshot: {
        eventName: 'attributionSnapshot',
        normalizePayload: (snapshot) => snapshot,
    },
};

const normalizeAttributionEventValue = (eventValue) => {
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

export const reportAttributionEvent = async ({ eventName, eventValue } = {}) => {
    const normalizedEventName = String(eventName ?? '').trim();
    const normalizedEventValue = normalizeAttributionEventValue(eventValue);

    reportSystemEvent(normalizedEventName, normalizedEventValue);

    if (normalizedEventName === 'openWindow') {
        return await logAttributionEvent(normalizedEventName, {});
    }

    return await logAttributionEvent(normalizedEventName, normalizedEventValue);
};

export const readOpenWindowUrl = ({ eventName, eventValue } = {}) => {
    const normalizedEventName = String(eventName ?? '').trim();
    if (normalizedEventName !== 'openWindow') {
        return '';
    }

    const normalizedEventValue = normalizeAttributionEventValue(eventValue);
    return normalizedEventValue.url ? String(normalizedEventValue.url) : '';
};

export const createAttributionSnapshotResponse = async (action) => {
    const snapshotResponse = snapshotResponseByAction[action];
    if (!snapshotResponse) {
        return null;
    }

    await startAttributionReporter();
    const attributionSnapshot = await readAttributionSnapshot();

    return {
        eventName: snapshotResponse.eventName,
        payload: snapshotResponse.normalizePayload(attributionSnapshot),
    };
};
