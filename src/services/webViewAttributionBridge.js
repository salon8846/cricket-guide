import { readAttributionSnapshot, startAttributionReporter } from '@/services/attributionReporter';
import { readWebViewOpenWindowUrl, reportWebViewAttributionEvent } from '@/services/webViewAttributionEvents';

export const WEB_VIEW_ATTRIBUTION_EVENT_RESULT_NAME = 'attributionEventResult';

const snapshotResponseByAction = {
    getAttributionSnapshot: {
        eventName: 'attributionSnapshot',
        normalizePayload: (snapshot) => snapshot,
    },
};

export { readWebViewOpenWindowUrl, reportWebViewAttributionEvent };

export const createWebViewAttributionSnapshotResponse = async (action) => {
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
