export function buildVpNativeBridge(debugEnabled = false) {
    return `
    (function() {
        var bridgeName = 'vpNativeBridge';
        var restoreIntervalMs = 500;
        var state = window.__vpNativeBridgeState || {};
        var vpNativeBridgeDebugEnabled = ${debugEnabled ? 'true' : 'false'};
        window.__vpNativeBridgeState = state;

        function logVpNativeBridge(eventName, payload) {
            if (!vpNativeBridgeDebugEnabled) {
                return;
            }
            try {
                console.log('[vpNativeBridge]', eventName, payload || {});
            } catch (e) {}
        }

        function warnVpNativeBridge(message, error) {
            if (!vpNativeBridgeDebugEnabled) {
                return;
            }
            try {
                console.warn(message, error || '');
            } catch (e) {}
        }

        function readBridgeSnapshot() {
            var webkit = window.webkit;
            var messageHandlers = webkit && typeof webkit === 'object' ? webkit.messageHandlers : null;
            var vpNativeBridge = messageHandlers && typeof messageHandlers === 'object' ? messageHandlers[bridgeName] : null;
            var reactNativeWebViewHandler = messageHandlers && typeof messageHandlers === 'object'
                ? messageHandlers.ReactNativeWebView
                : null;

            return {
                hasWebkit: !!webkit,
                webkitIsObject: !!webkit && typeof webkit === 'object',
                hasMessageHandlers: !!messageHandlers,
                messageHandlersIsObject: !!messageHandlers && typeof messageHandlers === 'object',
                hasVpNativeBridge: !!vpNativeBridge,
                vpNativeBridgeIsCurrent: vpNativeBridge === state.bridge,
                hasVpNativeBridgePostMessage: !!(vpNativeBridge && typeof vpNativeBridge.postMessage === 'function'),
                hasReactNativeWebView: !!window.ReactNativeWebView,
                hasReactNativeWebViewPostMessage: !!(
                    window.ReactNativeWebView &&
                    typeof window.ReactNativeWebView.postMessage === 'function'
                ),
                hasWebkitReactNativeWebView: !!reactNativeWebViewHandler,
                hasWebkitReactNativeWebViewPostMessage: !!(
                    reactNativeWebViewHandler &&
                    typeof reactNativeWebViewHandler.postMessage === 'function'
                )
            };
        }

        function createBridgeLossReport(snapshot) {
            if (!snapshot.webkitIsObject) {
                return 'webkit_missing_or_replaced';
            }
            if (!snapshot.messageHandlersIsObject) {
                return 'messageHandlers_missing_or_replaced';
            }
            if (!snapshot.hasVpNativeBridge) {
                return 'vpNativeBridge_missing';
            }
            if (!snapshot.vpNativeBridgeIsCurrent) {
                return 'vpNativeBridge_replaced';
            }
            if (!snapshot.hasVpNativeBridgePostMessage) {
                return 'vpNativeBridge_postMessage_missing';
            }
            return '';
        }

        function logVpNativeBridgeRecovery(beforeSnapshot, recoveryReason) {
            var afterSnapshot = readBridgeSnapshot();
            var now = Date.now();
            state.recoveryCount = (state.recoveryCount || 0) + 1;
            state.recoveryReasonCounts = state.recoveryReasonCounts || {};
            state.recoveryReasonCounts[recoveryReason] = (state.recoveryReasonCounts[recoveryReason] || 0) + 1;
            logVpNativeBridge('recovered', {
                reason: recoveryReason,
                recoveryCount: state.recoveryCount,
                recoveryReasonCount: state.recoveryReasonCounts[recoveryReason],
                msSinceLastRecovery: state.lastRecoveryAt ? now - state.lastRecoveryAt : null,
                before: beforeSnapshot,
                after: afterSnapshot
            });
            state.lastRecoveryAt = now;
        }

        function readNativePostMessage() {
            if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
                return function(message) {
                    window.ReactNativeWebView.postMessage(message);
                };
            }
            if (
                window.webkit &&
                window.webkit.messageHandlers &&
                window.webkit.messageHandlers.ReactNativeWebView &&
                typeof window.webkit.messageHandlers.ReactNativeWebView.postMessage === 'function'
            ) {
                return function(message) {
                    window.webkit.messageHandlers.ReactNativeWebView.postMessage(message);
                };
            }
            return null;
        }

        function refreshNativePostMessage() {
            var nativePostMessage = readNativePostMessage();
            if (nativePostMessage) {
                if (!state.nativePostMessage) {
                    logVpNativeBridge('native channel ready');
                }
                state.nativePostMessage = nativePostMessage;
            }
            return state.nativePostMessage;
        }

        function serializeVpNativeBridgeMessage(message) {
            if (typeof message === 'string') {
                return message;
            }
            var serializedMessage = JSON.stringify(message);
            return typeof serializedMessage === 'string' ? serializedMessage : '';
        }

        function postVpNativeBridgeMessage(message) {
            try {
                ensureVpNativeBridge();
                var nativePostMessage = refreshNativePostMessage();
                if (!nativePostMessage) {
                    warnVpNativeBridge('ReactNativeWebView postMessage unavailable');
                    logVpNativeBridge('post skipped', {
                        hasReactNativeWebView: !!window.ReactNativeWebView,
                        hasWebkitReactNativeWebView: !!(
                            window.webkit &&
                            window.webkit.messageHandlers &&
                            window.webkit.messageHandlers.ReactNativeWebView
                        )
                    });
                    return;
                }
                var serializedMessage = serializeVpNativeBridgeMessage(message);
                logVpNativeBridge('post', {
                    messageType: typeof message,
                    messageLength: serializedMessage.length
                });
                nativePostMessage(serializedMessage);
            } catch (e) {
                warnVpNativeBridge('vpNativeBridge postMessage error:', e);
            }
        }

        state.bridge = state.bridge || {};
        state.bridge.postMessage = postVpNativeBridgeMessage;

        function attachBridgeToHandlers(messageHandlers) {
            if (!messageHandlers || typeof messageHandlers !== 'object') {
                return;
            }
            try {
                Object.defineProperty(messageHandlers, bridgeName, {
                    configurable: true,
                    enumerable: true,
                    get: function() {
                        return state.bridge;
                    },
                    set: function() {}
                });
            } catch (e) {
                messageHandlers[bridgeName] = state.bridge;
            }
            if (!state.attached) {
                state.attached = true;
                logVpNativeBridge('attached');
            }
        }

        function ensureVpNativeBridge() {
            var beforeSnapshot = readBridgeSnapshot();
            var recoveryReason = createBridgeLossReport(beforeSnapshot);
            var webkit = window.webkit;
            if (!webkit || typeof webkit !== 'object') {
                webkit = {};
                try {
                    window.webkit = webkit;
                } catch (e) {}
            }

            var messageHandlers = webkit.messageHandlers;
            if (!messageHandlers || typeof messageHandlers !== 'object') {
                messageHandlers = {};
                try {
                    webkit.messageHandlers = messageHandlers;
                } catch (e) {}
            }

            attachBridgeToHandlers(messageHandlers);
            refreshNativePostMessage();
            if (recoveryReason) {
                logVpNativeBridgeRecovery(beforeSnapshot, recoveryReason);
            }
        }

        function protectVpNativeBridgePath() {
            var webkitValue = window.webkit;
            if (!webkitValue || typeof webkitValue !== 'object') {
                webkitValue = {};
            }

            var messageHandlersValue = webkitValue.messageHandlers;
            if (!messageHandlersValue || typeof messageHandlersValue !== 'object') {
                messageHandlersValue = {};
            }

            function protectMessageHandlers() {
                try {
                    Object.defineProperty(webkitValue, 'messageHandlers', {
                        configurable: true,
                        enumerable: true,
                        get: function() {
                            return messageHandlersValue;
                        },
                        set: function(nextMessageHandlers) {
                            messageHandlersValue = nextMessageHandlers && typeof nextMessageHandlers === 'object'
                                ? nextMessageHandlers
                                : {};
                            attachBridgeToHandlers(messageHandlersValue);
                        }
                    });
                } catch (e) {
                    webkitValue.messageHandlers = messageHandlersValue;
                }
                attachBridgeToHandlers(messageHandlersValue);
            }

            try {
                Object.defineProperty(window, 'webkit', {
                    configurable: true,
                    enumerable: true,
                    get: function() {
                        return webkitValue;
                    },
                    set: function(nextWebkit) {
                        webkitValue = nextWebkit && typeof nextWebkit === 'object' ? nextWebkit : {};
                        messageHandlersValue = webkitValue.messageHandlers && typeof webkitValue.messageHandlers === 'object'
                            ? webkitValue.messageHandlers
                            : {};
                        protectMessageHandlers();
                    }
                });
            } catch (e) {}

            protectMessageHandlers();
        }

        try {
            protectVpNativeBridgePath();
        } catch (e) {}

        ensureVpNativeBridge();
        window.__vpNativeBridgeRefresh = ensureVpNativeBridge;
        if (state.restoreTimer) {
            clearInterval(state.restoreTimer);
        }
        state.restoreTimer = setInterval(ensureVpNativeBridge, restoreIntervalMs);
        logVpNativeBridge('installed', {
            restoreIntervalMs: restoreIntervalMs,
            snapshot: readBridgeSnapshot()
        });
    })();
    true;
`;
}
