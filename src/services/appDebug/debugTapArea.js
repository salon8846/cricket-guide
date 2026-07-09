export const DEBUG_TAP_COUNT = 10;
export const DEBUG_TAP_WINDOW_MS = 1500;

export const DEFAULT_DEBUG_TAP_AREA = {
    width: 30,
    height: 30,
    top: null,
    right: null,
    bottom: null,
    left: 0,
    backgroundColor: 'transparent',
};

function parseTapAreaNumber(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.min(Math.max(number, min), max);
}

function isTapAreaStyleValue(value) {
    return (
        value === null
        || typeof value === 'string'
        || typeof value === 'number'
        || typeof value === 'boolean'
    );
}

function parseDebugTapAreaValue(key, value) {
    if (!isTapAreaStyleValue(value)) return undefined;
    if (['width', 'height'].includes(key)) {
        return parseTapAreaNumber(value, 1, 240);
    }
    if (['top', 'right', 'bottom', 'left'].includes(key)) {
        return parseTapAreaNumber(value, 0, 2000);
    }
    if (typeof value === 'string' && value.length > 120) return undefined;
    return value;
}

export function parseDebugTapArea(rawTapArea) {
    if (!rawTapArea) return DEFAULT_DEBUG_TAP_AREA;

    const parsed = typeof rawTapArea === 'string'
        ? JSON.parse(rawTapArea)
        : rawTapArea;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return DEFAULT_DEBUG_TAP_AREA;
    }

    const tapArea = { ...DEFAULT_DEBUG_TAP_AREA };
    Object.entries(parsed).forEach(([key, value]) => {
        const tapAreaValue = parseDebugTapAreaValue(key, value);
        if (tapAreaValue !== undefined) {
            tapArea[key] = tapAreaValue;
        }
    });

    if (tapArea.left !== null && tapArea.right !== null && parsed.left !== undefined) {
        delete tapArea.right;
    }
    if (tapArea.bottom !== null && tapArea.top !== null && parsed.bottom !== undefined) {
        delete tapArea.top;
    }

    return tapArea;
}

export function safelyParseDebugTapArea(rawTapArea) {
    try {
        return parseDebugTapArea(rawTapArea);
    } catch {
        return DEFAULT_DEBUG_TAP_AREA;
    }
}

export function buildDebugTapAreaStyle(tapArea, safeTop, safeBottom) {
    const style = { ...tapArea };

    if (style.left === null) {
        delete style.left;
    }
    if (style.right === null) {
        delete style.right;
    }
    if (style.bottom === null) {
        delete style.bottom;
    }

    if (style.bottom !== undefined) {
        style.bottom = safeBottom + style.bottom;
        if (style.top === null) {
            delete style.top;
        }
    } else {
        style.top = safeTop + (style.top === null ? 0 : style.top);
    }

    return style;
}
