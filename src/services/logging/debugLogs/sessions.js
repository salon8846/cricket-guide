import { getAppDebugSnapshot } from '@/services/appDebug/store';
import { createSessionJsonlFileStore } from '@/services/logging/jsonlFiles';
import { registerLogReceiver } from '@/utils/logger';

const DEBUG_LOG_WRITER_STATE_KEY = '__APP_DEBUG_LOG_FILE_WRITER__';
const createDebugLaunchId = () => {
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const randomPart = Math.random().toString(36).slice(2, 8);
    return `${timestamp}-${randomPart}`;
};

const writerState = (() => {
    if (!globalThis[DEBUG_LOG_WRITER_STATE_KEY]) {
        globalThis[DEBUG_LOG_WRITER_STATE_KEY] = {
            installed: false,
            launchId: createDebugLaunchId(),
        };
    }

    return globalThis[DEBUG_LOG_WRITER_STATE_KEY];
})();

const debugLogFile = createSessionJsonlFileStore({
    directoryName: 'debug',
    filePrefix: 'debug',
    currentSessionId: writerState.launchId,
    maxBytes: 512 * 1024,
    maxFiles: 20,
    createTruncatedEntry: ({ maxBytes }) => ({
        time: new Date().toISOString(),
        level: 'warn',
        tag: 'DebugLog',
        message: 'Debug log session truncated because the file size limit was reached.',
        payload: { maxBytes },
        source: 'app',
    }),
});

export const installDebugLogFileWriter = () => {
    if (writerState.installed) {
        return;
    }

    writerState.installed = true;
    registerLogReceiver((entry) => {
        if (!getAppDebugSnapshot().enabled) {
            return;
        }

        debugLogFile.append(entry).catch(() => { });
    });
};

export const listDebugLogSessions = () => {
    return debugLogFile.listSessions();
};

export const getCurrentDebugLogSessionId = () => {
    return debugLogFile.currentSessionId;
};

export const readDebugLogEntries = (sessionId = debugLogFile.currentSessionId, limit = 200) => {
    return debugLogFile.readEntries(sessionId, limit);
};

export const readDebugLogText = (sessionId = debugLogFile.currentSessionId) => {
    return debugLogFile.readText(sessionId);
};

export const deleteDebugLogSession = (sessionId) => {
    return debugLogFile.deleteSession(sessionId);
};

export const clearDebugLogFiles = () => {
    return debugLogFile.clear();
};
