import { createLogEntry } from '@/services/logging/redaction/logEntries';

const LOGGER_STATE_KEY = '__APP_LOGGER_STATE__';
const loggerState = (() => {
    if (!globalThis[LOGGER_STATE_KEY]) {
        globalThis[LOGGER_STATE_KEY] = {
            receivers: new Set(),
        };
    }

    return globalThis[LOGGER_STATE_KEY];
})();

const writeConsole = (level, args) => {
    if (level === 'error') {
        console.error(...args);
        return;
    }

    if (level === 'warn') {
        console.warn(...args);
        return;
    }

    console.log(...args);
};

const normalizeConsoleError = (error) => ({
    name: error.name,
    message: error.message,
    stack: error.stack,
});

const normalizeConsolePayload = (payload) => {
    if (payload === undefined) {
        return undefined;
    }

    if (payload instanceof Error) {
        return { error: normalizeConsoleError(payload) };
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return payload;
    }

    return Object.fromEntries(
        Object.entries(payload).map(([key, value]) => [
            key,
            value instanceof Error ? normalizeConsoleError(value) : value,
        ]),
    );
};

const emitLogEntry = (entry) => {
    loggerState.receivers.forEach((receiver) => {
        try {
            receiver(entry);
        } catch {
            // File logging must never break the app flow.
        }
    });
};

export const registerLogReceiver = (receiver) => {
    if (typeof receiver !== 'function') {
        return () => { };
    }

    loggerState.receivers.add(receiver);
    return () => {
        loggerState.receivers.delete(receiver);
    };
};

const createTaggedLogger = (tag, source) => {
    const normalizedTag = String(tag ?? '').trim() || 'App';
    const label = `[${normalizedTag}]`;
    const write = (level, message, payload) => {
        emitLogEntry(createLogEntry({
            level,
            tag: normalizedTag,
            message,
            payload,
            source,
        }));

        if (!__DEV__) {
            return;
        }

        const consolePayload = normalizeConsolePayload(payload);
        const args = consolePayload === undefined
            ? [label, message]
            : [label, message, consolePayload];
        writeConsole(level, args);
    };

    return {
        debug: (message, payload) => write('log', message, payload),
        info: (message, payload) => write('log', message, payload),
        warn: (message, payload) => write('warn', message, payload),
        error: (message, payload) => write('error', message, payload),
    };
};

export const createLogger = (tag) => createTaggedLogger(tag, 'appLogger');

export const createDebugLogger = (tag) => createTaggedLogger(tag, 'debugLogger');
