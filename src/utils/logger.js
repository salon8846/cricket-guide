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

const isError = (value) => value instanceof Error;

const normalizeError = (error) => ({
    name: error.name,
    message: error.message,
    stack: error.stack,
});

const normalizePayload = (payload) => {
    if (payload === undefined) {
        return undefined;
    }

    if (isError(payload)) {
        return { error: normalizeError(payload) };
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return payload;
    }

    return Object.fromEntries(
        Object.entries(payload).map(([key, value]) => [
            key,
            isError(value) ? normalizeError(value) : value,
        ]),
    );
};

export const createLogger = (tag, options = {}) => {
    const label = `[${String(tag ?? '').trim() || 'App'}]`;
    const devOnly = options.devOnly === true;
    const write = (level, message, payload) => {
        if (devOnly && !__DEV__) {
            return;
        }

        const normalizedPayload = normalizePayload(payload);
        const args = normalizedPayload === undefined
            ? [label, message]
            : [label, message, normalizedPayload];
        writeConsole(level, args);
    };

    return {
        debug: (message, payload) => write('log', message, payload),
        info: (message, payload) => write('log', message, payload),
        warn: (message, payload) => write('warn', message, payload),
        error: (message, payload) => write('error', message, payload),
    };
};
