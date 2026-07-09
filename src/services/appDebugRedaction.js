const APP_DEBUG_SENSITIVE_KEY_PATTERN = /token|password|secret|authorization|credential|private|key/i;

export const redactAppDebugValue = (key, value) => {
    if (APP_DEBUG_SENSITIVE_KEY_PATTERN.test(String(key))) {
        return value ? 'configured' : '-';
    }

    if (!value || typeof value !== 'object') {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => redactAppDebugValue('', item));
    }

    return Object.fromEntries(
        Object.entries(value).map(([childKey, childValue]) => [
            childKey,
            redactAppDebugValue(childKey, childValue),
        ]),
    );
};
