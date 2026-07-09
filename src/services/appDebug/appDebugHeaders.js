import { getAppDebugSnapshot } from '@/services/appDebug/appDebugStore';

export const getAppDebugRequestHeaderValues = () => {
    const currentSnapshot = getAppDebugSnapshot();

    if (!currentSnapshot.enabled) {
        return {};
    }

    return {
        'X-App-Debug': '1',
        'X-App-Debug-Session': currentSnapshot.sessionId,
    };
};
