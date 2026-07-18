export const WEB_VIEW_PANEL_TYPE_ERUDA = 'eruda';
export const WEB_VIEW_PANEL_TYPE_VCONSOLE = 'vconsole';
const SCRIPT_URL_PROTOCOLS = __DEV__ ? ['https:', 'http:'] : ['https:'];
const DEFAULT_SCRIPT_URL_BY_PANEL_TYPE = {
    [WEB_VIEW_PANEL_TYPE_ERUDA]: 'https://cdn.jsdelivr.net/npm/eruda@3.4.3/eruda.min.js',
    [WEB_VIEW_PANEL_TYPE_VCONSOLE]: 'https://cdn.jsdelivr.net/npm/vconsole@3.15.1/dist/vconsole.min.js',
};

export const DEFAULT_WEB_VIEW_PANEL = {
    type: WEB_VIEW_PANEL_TYPE_ERUDA,
    scriptUrl: DEFAULT_SCRIPT_URL_BY_PANEL_TYPE[WEB_VIEW_PANEL_TYPE_ERUDA],
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

    const type = parsePanelType(panel.type);
    const configuredScriptUrl = String(panel.scriptUrl ?? '').trim();

    return {
        type,
        scriptUrl: configuredScriptUrl
            ? parseScriptUrl(configuredScriptUrl)
            : DEFAULT_SCRIPT_URL_BY_PANEL_TYPE[type],
    };
}
