import { isSensitiveFieldKey } from '@/services/logging/redaction/sensitiveFieldRedaction';

export const redactAppDebugValue = (key, value) => {
    if (isSensitiveFieldKey(key)) {
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
