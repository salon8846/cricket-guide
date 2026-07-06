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

export const createLogger = (tag, options = {}) => {
    const label = `[${String(tag ?? '').trim() || 'App'}]`;
    const devOnly = options.devOnly === true;
    const write = (level, message, payload) => {
        if (devOnly && !__DEV__) {
            return;
        }

        const args = payload === undefined
            ? [label, message]
            : [label, message, payload];
        writeConsole(level, args);
    };

    return {
        debug: (message, payload) => write('log', message, payload),
        info: (message, payload) => write('log', message, payload),
        warn: (message, payload) => write('warn', message, payload),
        error: (message, payload) => write('error', message, payload),
    };
};
