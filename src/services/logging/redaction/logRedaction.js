import { isSensitiveFieldKey } from '@/services/logging/redaction/sensitiveFieldRedaction';

const REDACTED = '[Redacted]';
const MAX_STRING_LENGTH = 1200;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 40;
const MAX_DEPTH = 5;

const URL_PATTERN = /^https?:\/\//i;

const isPlainObject = (value) => {
    return !!value && typeof value === 'object' && !Array.isArray(value);
};

const normalizeError = (error) => ({
    name: String(error?.name ?? 'Error'),
    message: String(error?.message ?? ''),
    stack: String(error?.stack ?? ''),
});

const sanitizeString = (value) => {
    const normalizedValue = String(value ?? '');
    const shortenedValue = normalizedValue.length > MAX_STRING_LENGTH
        ? `${normalizedValue.slice(0, MAX_STRING_LENGTH)}...[truncated]`
        : normalizedValue;

    if (!URL_PATTERN.test(shortenedValue)) {
        return shortenedValue;
    }

    try {
        const url = new URL(shortenedValue);
        return `${url.origin}${url.pathname}`;
    } catch {
        return shortenedValue;
    }
};

const sanitizeValue = (value, depth, seenObjects) => {
    if (value instanceof Error) {
        return sanitizeValue({ error: normalizeError(value) }, depth, seenObjects);
    }

    if (value === null || value === undefined) {
        return value;
    }

    if (typeof value === 'string') {
        return sanitizeString(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'bigint') {
        return value.toString();
    }

    if (typeof value === 'function' || typeof value === 'symbol') {
        return String(value);
    }

    if (depth >= MAX_DEPTH) {
        return '[MaxDepth]';
    }

    if (typeof value === 'object') {
        if (seenObjects.has(value)) {
            return '[Circular]';
        }
        seenObjects.add(value);
    }

    if (Array.isArray(value)) {
        const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1, seenObjects));
        return value.length > MAX_ARRAY_ITEMS ? [...items, '[Truncated]'] : items;
    }

    if (!isPlainObject(value)) {
        return sanitizeString(value);
    }

    const entries = Object.entries(value).slice(0, MAX_OBJECT_KEYS).map(([key, item]) => {
        if (isSensitiveFieldKey(key)) {
            return [key, REDACTED];
        }

        return [key, sanitizeValue(item, depth + 1, seenObjects)];
    });

    if (Object.keys(value).length > MAX_OBJECT_KEYS) {
        entries.push(['__truncated__', true]);
    }

    return Object.fromEntries(entries);
};

export const sanitizeLogValue = (value) => sanitizeValue(value, 0, new WeakSet());

export const normalizeLogError = (error) => sanitizeLogValue(normalizeError(error));

export const createLogEntry = ({ level, tag, message, payload, source }) => ({
    time: new Date().toISOString(),
    level: String(level ?? 'info'),
    tag: String(tag ?? 'App'),
    message: sanitizeString(message ?? ''),
    payload: sanitizeLogValue(payload),
    source: String(source ?? 'app'),
});
