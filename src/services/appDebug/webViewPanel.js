export const WEB_VIEW_PANEL_TYPE_ERUDA = 'eruda';
export const WEB_VIEW_PANEL_TYPE_VCONSOLE = 'vconsole';
const SCRIPT_URL_PROTOCOLS = __DEV__ ? ['https:', 'http:'] : ['https:'];

export const DEFAULT_WEB_VIEW_PANEL = {
    type: WEB_VIEW_PANEL_TYPE_ERUDA,
    scriptUrl: '',
};

export function parseScriptUrl(rawUrl) {
    if (!rawUrl) return '';
    try {
        const parsed = new URL(String(rawUrl).trim());
        if (!SCRIPT_URL_PROTOCOLS.includes(parsed.protocol)) return '';
        return parsed.toString();
    } catch {
        return '';
    }
}

export function parsePanelType(rawType) {
    if (String(rawType).trim().toLowerCase() === WEB_VIEW_PANEL_TYPE_VCONSOLE) {
        return WEB_VIEW_PANEL_TYPE_VCONSOLE;
    }
    return WEB_VIEW_PANEL_TYPE_ERUDA;
}

export function normalizeWebViewPanel(panel) {
    if (!panel || typeof panel !== 'object' || Array.isArray(panel)) {
        return DEFAULT_WEB_VIEW_PANEL;
    }

    return {
        type: parsePanelType(panel.type),
        scriptUrl: parseScriptUrl(panel.scriptUrl),
    };
}
