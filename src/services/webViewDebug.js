import erudaSource from '@/constants/erudaSource';
import vConsoleSource from '@/constants/vconsoleSource';

export function buildErudaDebugPanelInjectionScript(debugPanelScriptUrl, webViewUrl) {
    const scriptUrl = JSON.stringify(debugPanelScriptUrl);
    const loggedUrl = JSON.stringify(webViewUrl);
    return `
        (function() {
            try {
                var nativeWebViewUrl = ${loggedUrl};
                function logNativeWebViewUrl() {
                    if (nativeWebViewUrl && window.__nativeWebViewDebugConsoleUrl !== nativeWebViewUrl) {
                        window.__nativeWebViewDebugConsoleUrl = nativeWebViewUrl;
                        setTimeout(function() {
                            console.log('[WebViewDebugPanel]', 'webview url:', nativeWebViewUrl);
                        }, 0);
                    }
                }
                window.__nativeErudaEnabled = true;
                function configureEruda() {
                    var panel = document.getElementById('eruda');
                    if (panel) {
                        panel.style.zIndex = '2147483647';
                    }
                    if (!window.eruda || typeof window.eruda.get !== 'function') {
                        return;
                    }
                    var consolePanel = window.eruda.get('console');
                    if (consolePanel && consolePanel.config && consolePanel.config.set) {
                        consolePanel.config.set('jsExecution', true);
                    }
                    if (typeof window.eruda.position === 'function') {
                        window.eruda.position({
                            x: Math.max(0, window.innerWidth - 50),
                            y: Math.max(0, window.innerHeight - 150),
                        });
                    }
                }

                function createEruda() {
                    if (!window.__nativeErudaEnabled) {
                        return false;
                    }
                    if (window.__nativeEruda) {
                        configureEruda();
                        logNativeWebViewUrl();
                        return true;
                    }
                    if (window.__nativeErudaLoading) {
                        return true;
                    }
                    if (!window.eruda || typeof window.eruda.init !== 'function') {
                        return false;
                    }
                    if (document.getElementById('eruda')) {
                        window.__nativeEruda = window.eruda;
                        window.__nativeErudaOwned = false;
                        configureEruda();
                        logNativeWebViewUrl();
                        return true;
                    }
                    try {
                        window.__nativeErudaLoading = true;
                        window.eruda.init();
                        window.__nativeEruda = window.eruda;
                        window.__nativeErudaOwned = true;
                    } catch (error) {
                        if (String(error && error.message || error).indexOf('already exists') === -1) {
                            throw error;
                        }
                        window.__nativeEruda = window.eruda;
                        window.__nativeErudaOwned = false;
                    } finally {
                        window.__nativeErudaLoading = false;
                    }
                    setTimeout(configureEruda, 0);
                    logNativeWebViewUrl();
                    return true;
                }

                if (window.__nativeEruda) {
                    return;
                }

                if (window.eruda && createEruda()) {
                    return;
                }

                var debugPanelScriptUrl = ${scriptUrl};
                if (debugPanelScriptUrl) {
                    if (window.__nativeErudaLoading) {
                        return;
                    }
                    window.__nativeErudaLoading = true;
                    var script = document.createElement('script');
                    script.src = debugPanelScriptUrl;
                    script.onload = function() {
                        window.__nativeErudaLoading = false;
                        if (window.__nativeErudaEnabled) {
                            createEruda();
                        }
                    };
                    script.onerror = function() {
                        window.__nativeErudaLoading = false;
                    };
                    document.documentElement.appendChild(script);
                    return;
                }

                window.__nativeErudaLoading = true;
                ${erudaSource}
                window.__nativeErudaLoading = false;
                createEruda();
            } catch (e) {
                window.__nativeErudaLoading = false;
                return;
            }
        })();
        true;
    `;
}

export function buildVConsoleDebugPanelInjectionScript(debugPanelScriptUrl, webViewUrl) {
    const scriptUrl = JSON.stringify(debugPanelScriptUrl);
    const loggedUrl = JSON.stringify(webViewUrl);
    return `
        (function() {
            try {
                var nativeWebViewUrl = ${loggedUrl};
                function logNativeWebViewUrl() {
                    if (nativeWebViewUrl && window.__nativeWebViewDebugConsoleUrl !== nativeWebViewUrl) {
                        window.__nativeWebViewDebugConsoleUrl = nativeWebViewUrl;
                        setTimeout(function() {
                            console.log('[WebViewDebugPanel]', 'webview url:', nativeWebViewUrl);
                        }, 0);
                    }
                }
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
                    logNativeWebViewUrl();
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

                var debugPanelScriptUrl = ${scriptUrl};
                if (debugPanelScriptUrl) {
                    var script = document.createElement('script');
                    script.src = debugPanelScriptUrl;
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
                window.__nativeErudaEnabled = false;
                window.__nativeErudaLoading = false;
                if (window.__nativeErudaOwned && window.__nativeEruda && window.__nativeEruda.destroy) {
                    window.__nativeEruda.destroy();
                    var panel = document.getElementById('eruda');
                    if (panel && panel.parentNode) {
                        panel.parentNode.removeChild(panel);
                    }
                }
                window.__nativeEruda = undefined;
                window.__nativeErudaOwned = false;
                window.__nativeVConsoleEnabled = false;
                if (window.__nativeVConsole && window.__nativeVConsole.destroy) {
                    window.__nativeVConsole.destroy();
                }
                window.__nativeVConsole = undefined;
                if (window.__VCONSOLE_INSTANCE && window.__VCONSOLE_INSTANCE.destroy) {
                    window.__VCONSOLE_INSTANCE.destroy();
                }
                window.__VCONSOLE_INSTANCE = undefined;
                var vConsolePanel = document.getElementById('__vconsole');
                if (vConsolePanel && vConsolePanel.parentNode) {
                    vConsolePanel.parentNode.removeChild(vConsolePanel);
                }
            } catch (e) {
                return;
            }
        })();
        true;
    `;
}
