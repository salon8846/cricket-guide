import vConsoleSource from '@/constants/vconsoleSource';
import { getItem, setItem } from '@/utils/storage';

export const WEBVIEW_DEBUG_PANEL_TAP_COUNT = 10;
export const WEBVIEW_DEBUG_PANEL_TAP_WINDOW_MS = 1500;

const WEBVIEW_DEBUG_PANEL_ENABLED_STORAGE_KEY = 'webview:debug-panel-enabled';
const DEFAULT_WEBVIEW_DEBUG_HOTSPOT = {
    width: 30,
    height: 30,
    top: null,
    right: null,
    bottom: null,
    left: 0,
    backgroundColor: 'transparent',
};

export function getStoredWebViewDebugPanelEnabled() {
    return getItem(WEBVIEW_DEBUG_PANEL_ENABLED_STORAGE_KEY);
}

export function setStoredWebViewDebugPanelEnabled(enabled) {
    return setItem(WEBVIEW_DEBUG_PANEL_ENABLED_STORAGE_KEY, enabled);
}

export function parseWebViewDebugPanelSourceUrl(rawUrl) {
    if (!rawUrl) return '';
    try {
        const parsed = new URL(String(rawUrl).trim());
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
        return parsed.toString();
    } catch {
        return '';
    }
}

function parseHotspotNumber(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.min(Math.max(number, min), max);
}

function isStyleValue(value) {
    return (
        value === null
        || typeof value === 'string'
        || typeof value === 'number'
        || typeof value === 'boolean'
    );
}

function parseDebugHotspotStyleValue(key, value) {
    if (!isStyleValue(value)) return undefined;
    if (['width', 'height'].includes(key)) {
        return parseHotspotNumber(value, 1, 240);
    }
    if (['top', 'right', 'bottom', 'left'].includes(key)) {
        return parseHotspotNumber(value, 0, 2000);
    }
    if (typeof value === 'string' && value.length > 120) return undefined;
    return value;
}

export function parseWebViewDebugHotspotStyle(rawStyle) {
    if (!rawStyle) return DEFAULT_WEBVIEW_DEBUG_HOTSPOT;
    try {
        const parsed = JSON.parse(String(rawStyle));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return DEFAULT_WEBVIEW_DEBUG_HOTSPOT;
        }

        const style = { ...DEFAULT_WEBVIEW_DEBUG_HOTSPOT };
        Object.entries(parsed).forEach(([key, value]) => {
            const styleValue = parseDebugHotspotStyleValue(key, value);
            if (styleValue !== undefined) {
                style[key] = styleValue;
            }
        });

        if (style.left !== null && style.right !== null && parsed.left !== undefined) {
            delete style.right;
        }
        if (style.bottom !== null && style.top !== null && parsed.bottom !== undefined) {
            delete style.top;
        }

        return style;
    } catch {
        return DEFAULT_WEBVIEW_DEBUG_HOTSPOT;
    }
}

export function buildWebViewDebugHotspotStyle(hotspotStyle, safeTop, safeBottom) {
    const style = { ...hotspotStyle };

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

export function buildWebViewDebugPanelInjectionScript(debugPanelSourceUrl) {
    const sourceUrl = JSON.stringify(debugPanelSourceUrl);
    return `
        (function() {
            try {
                window.__nativeVConsoleEnabled = true;
                function createVConsole() {
                    if (!window.__nativeVConsoleEnabled) {
                        return false;
                    }
                    var VConsoleClass = window.VConsole && (window.VConsole.default || window.VConsole);
                    if (typeof VConsoleClass !== 'function') {
                        return false;
                    }
                    window.__nativeVConsole = new VConsoleClass();
                    if (window.__nativeVConsole.showSwitch) {
                        window.__nativeVConsole.showSwitch();
                    }
                    setTimeout(function() {
                        var panel = document.getElementById('__vconsole');
                        if (panel) {
                            panel.style.zIndex = '2147483647';
                        }
                    }, 0);
                    return true;
                }

                if (window.__nativeVConsole) {
                    return;
                }

                if (window.VConsole && createVConsole()) {
                    return;
                }

                var debugPanelSourceUrl = ${sourceUrl};
                if (debugPanelSourceUrl) {
                    var script = document.createElement('script');
                    script.src = debugPanelSourceUrl;
                    script.onload = function() {
                        if (window.__nativeVConsoleEnabled) {
                            createVConsole();
                        }
                    };
                    document.documentElement.appendChild(script);
                    return;
                }

                ${vConsoleSource}
                createVConsole();
            } catch (e) {
                return;
            }
        })();
        true;
    `;
}

export function buildWebViewDebugPanelRemovalScript() {
    return `
        (function() {
            try {
                window.__nativeVConsoleEnabled = false;
                if (window.__nativeVConsole && window.__nativeVConsole.destroy) {
                    window.__nativeVConsole.destroy();
                }
                window.__nativeVConsole = undefined;
                if (window.__VCONSOLE_INSTANCE && window.__VCONSOLE_INSTANCE.destroy) {
                    window.__VCONSOLE_INSTANCE.destroy();
                }
                window.__VCONSOLE_INSTANCE = undefined;
                var panel = document.getElementById('__vconsole');
                if (panel && panel.parentNode) {
                    panel.parentNode.removeChild(panel);
                }
            } catch (e) {
                return;
            }
        })();
        true;
    `;
}
