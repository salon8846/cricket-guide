import { getAppDebugSnapshot } from '@/services/appDebug/store';

export const getAppDebugRequestHeaderValues = () => {
    const currentSnapshot = getAppDebugSnapshot();

    if (!currentSnapshot.enabled) {
        return {};
    }

    return {
        ...currentSnapshot.debugRequestHeaders,
        'X-App-Debug-Session': currentSnapshot.sessionId,
    };
};
