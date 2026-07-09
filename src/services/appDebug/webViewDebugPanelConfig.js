export const WEBVIEW_DEBUG_PANEL_TYPE_ERUDA = 'eruda';
export const WEBVIEW_DEBUG_PANEL_TYPE_VCONSOLE = 'vconsole';
const WEBVIEW_DEBUG_SCRIPT_PROTOCOLS = __DEV__ ? ['https:', 'http:'] : ['https:'];

export const DEFAULT_WEBVIEW_DEBUG_PANEL = {
    type: WEBVIEW_DEBUG_PANEL_TYPE_ERUDA,
    scriptUrl: '',
};

export function parseWebViewDebugPanelScriptUrl(rawUrl) {
    if (!rawUrl) return '';
    try {
        const parsed = new URL(String(rawUrl).trim());
        if (!WEBVIEW_DEBUG_SCRIPT_PROTOCOLS.includes(parsed.protocol)) return '';
        return parsed.toString();
    } catch {
        return '';
    }
}

export function parseWebViewDebugPanelType(rawType) {
    if (String(rawType).trim().toLowerCase() === WEBVIEW_DEBUG_PANEL_TYPE_VCONSOLE) {
        return WEBVIEW_DEBUG_PANEL_TYPE_VCONSOLE;
    }
    return WEBVIEW_DEBUG_PANEL_TYPE_ERUDA;
}

export function normalizeWebViewDebugPanel(panel) {
    if (!panel || typeof panel !== 'object' || Array.isArray(panel)) {
        return DEFAULT_WEBVIEW_DEBUG_PANEL;
    }

    return {
        type: parseWebViewDebugPanelType(panel.type),
        scriptUrl: parseWebViewDebugPanelScriptUrl(panel.scriptUrl),
    };
}
