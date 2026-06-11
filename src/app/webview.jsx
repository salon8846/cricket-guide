import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Platform,
    StatusBar,
    StyleSheet,
    TouchableOpacity,
    View,
    Text
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import NetworkErrorScreen from '@/components/common/NetworkErrorScreen';
import Toast from '@/components/common/Toast';
import useWebViewAuthStore from '@/store/useWebViewAuthStore';
import { APP_SCHEME } from '@/constants/config';
import {
    WEBVIEW_DEBUG_PANEL_TAP_COUNT,
    WEBVIEW_DEBUG_PANEL_TAP_WINDOW_MS,
    WEBVIEW_DEBUG_PANEL_TYPE_VCONSOLE,
    buildErudaDebugPanelInjectionScript,
    buildVConsoleDebugPanelInjectionScript,
    buildWebViewDebugHotspotStyle,
    buildWebViewDebugPanelRemovalScript,
    getStoredWebViewDebugPanelEnabled,
    parseWebViewDebugHotspotStyle,
    parseWebViewDebugPanelType,
    parseWebViewDebugPanelSourceUrl,
    setStoredWebViewDebugPanelEnabled,
} from '@/services/webViewDebug';

// X* 控制参数的 key 列表
const X_PARAMS = ['XFullScreen', 'XShowFloatButton', 'XSafeBottom', 'XSafeTop', 'XBackgroundColor', 'XStatusBarStyle', 'XSafeBottomStatus', 'XSafeTopStatus', 'XWebViewDebug', 'XWebViewDebugPanel', 'XWebViewDebugPanelUrl', 'XWebViewDebugHotspot'];

// 默认值
const X_DEFAULTS = {
    XFullScreen: '1',
    XShowFloatButton: '0',
    XSafeBottom: '0',
    XSafeTop: '1',
    XBackgroundColor: '0xFF000000',
    // 'auto'  → 根据 XBackgroundColor 亮度自动选择（默认）
    // 'dark'  → 强制深色图标（适合浅色背景，如白色）
    // 'light' → 强制白色图标（适合深色背景）
    XStatusBarStyle: 'auto',
    XSafeBottomStatus: '0',
    XSafeTopStatus: '0',
    XWebViewDebug: '0',
    XWebViewDebugPanel: 'eruda',
    XWebViewDebugPanelUrl: '',
    XWebViewDebugHotspot: '',
};

const GOOGLE_AUTH_REDIRECT_URL = `${APP_SCHEME}://auth/google`;
const TELEGRAM_AUTH_REDIRECT_URL = `${APP_SCHEME}://auth/telegram`;
const WEBVIEW_ORIGIN_WHITELIST = ['*'];
const WEBVIEW_AUTH_SESSION_DEBOUNCE_MS = 500;

const RETRYABLE_LOAD_ERROR_CODES = new Set([
    -1009, // iOS: not connected to internet
    -1006, // iOS: DNS lookup failed
    -1005, // iOS: network connection lost
    -1004, // iOS: cannot connect to host
    -1003, // iOS: cannot find host
    -1001, // iOS: timeout
    -8, // Android: timeout
    -7, // Android: IO error
    -6, // Android: connect failed
    -2, // Android: host lookup failed
]);

function isRetryableLoadError(nativeEvent) {
    return RETRYABLE_LOAD_ERROR_CODES.has(Number(nativeEvent?.code));
}

function logWebViewDebug(enabled, eventName, payload) {
    if (!enabled) return;
    console.warn('[WebViewDebug]', eventName, payload);
}

function buildNativeSafeAreaEventScript(safeTop, safeBottom) {
    return `
        (function() {
            var e = new CustomEvent('nativeSafeArea', {
                detail: { safeTop: ${safeTop}, safeBottom: ${safeBottom} }
            });
            window.dispatchEvent(e);
        })();
        true;
    `;
}

function buildWebViewEntryUrl(cleanUrl, safeTopStatus, safeBottomStatus, safeTop, safeBottom) {
    try {
        const parsed = new URL(cleanUrl);
        if (safeTopStatus === '1') {
            parsed.searchParams.set('safeTop', String(safeTop));
        }
        if (safeBottomStatus === '1') {
            parsed.searchParams.set('safeBottom', String(safeBottom));
        }
        return parsed.toString();
    } catch {
        return cleanUrl;
    }
}

/**
 * 从 URL 中提取 X* 控制参数，并返回剥离这些参数后的干净 URL
 */
function extractXParams(rawUrl) {
    try {
        const parsed = new URL(rawUrl);
        const xParams = { ...X_DEFAULTS };
        X_PARAMS.forEach((key) => {
            if (parsed.searchParams.has(key)) {
                xParams[key] = parsed.searchParams.get(key);
                parsed.searchParams.delete(key);
            }
        });
        return { cleanUrl: parsed.toString(), xParams };
    } catch {
        return { cleanUrl: rawUrl, xParams: { ...X_DEFAULTS } };
    }
}

export default function WebViewScreen() {
    // expo-router splits unencoded `&` in the inner URL into top-level route params.
    // e.g. `/webview?url=https://h5.com?XSafeTopStatus=1&XSafeBottomStatus=1`
    // becomes { url: 'https://h5.com?XSafeTopStatus=1', XSafeBottomStatus: '1' }
    // So we must also read X* from the raw route params and merge them in.
    const rawParams = useLocalSearchParams();
    const { url } = rawParams;

    // 从 URL query string 中解析 X* 控制参数，同时得到干净的 URL
    const { cleanUrl, xParams } = useMemo(() => {
        const result = extractXParams(decodeURIComponent(url));
        // Merge any X* params that expo-router placed at route level
        X_PARAMS.forEach((key) => {
            if (rawParams[key] !== undefined) {
                result.xParams[key] = String(rawParams[key]);
            }
        });
        return result;
    }, [url, rawParams]);
    const {
        XFullScreen,
        XShowFloatButton,
        XSafeBottom,
        XSafeTop,
        XBackgroundColor,
        XStatusBarStyle,
        XSafeBottomStatus,
        XSafeTopStatus,
        XWebViewDebug,
        XWebViewDebugPanel,
        XWebViewDebugPanelUrl,
        XWebViewDebugHotspot,
    } = xParams;

    // 全屏状态（可动态切换）
    const [fullScreen, setFullScreen] = useState(XFullScreen === '1');

    // WebView 引用 & 内部历史状态
    const webViewRef = useRef(null);
    const initialLoadDoneRef = useRef(false);
    const [canGoBack, setCanGoBack] = useState(false);
    const [showInitOverlay, setShowInitOverlay] = useState(true);
    const [showLoadError, setShowLoadError] = useState(false);
    const [retryingLoad, setRetryingLoad] = useState(false);
    const [debugPanelEnabled, setDebugPanelEnabled] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const debugPanelTapCountRef = useRef(0);
    const debugPanelTapResetTimerRef = useRef(null);
    const toastTimerRef = useRef(null);
    const lastGoogleAuthResultUrlRef = useRef(null);
    const lastTelegramAuthResultUrlRef = useRef(null);
    const webViewAuthSessionTimerRef = useRef(null);
    const pendingWebViewAuthSessionRef = useRef(null);
    const webViewAuthSessionOpenRef = useRef(false);
    const latestWebViewAuthSessionIdRef = useRef(0);
    const googleAuthResultUrl = useWebViewAuthStore((state) => state.googleAuthResultUrl);
    const clearGoogleAuthResultUrl = useWebViewAuthStore((state) => state.clearGoogleAuthResultUrl);
    const telegramAuthResultUrl = useWebViewAuthStore((state) => state.telegramAuthResultUrl);
    const clearTelegramAuthResultUrl = useWebViewAuthStore((state) => state.clearTelegramAuthResultUrl);

    const showFloatButton = XShowFloatButton === '1';
    const hasSafeBottom = XSafeBottom === '1';
    const hasSafeTop = XSafeTop === '1';
    const webViewDebug = XWebViewDebug === '1';
    const debugPanelType = useMemo(() => parseWebViewDebugPanelType(XWebViewDebugPanel), [XWebViewDebugPanel]);
    const debugPanelSourceUrl = useMemo(() => parseWebViewDebugPanelSourceUrl(XWebViewDebugPanelUrl), [XWebViewDebugPanelUrl]);
    const debugHotspotStyleConfig = useMemo(() => parseWebViewDebugHotspotStyle(XWebViewDebugHotspot), [XWebViewDebugHotspot]);

    const injectDebugPanel = useCallback(() => {
        const injectionScript = debugPanelType === WEBVIEW_DEBUG_PANEL_TYPE_VCONSOLE
            ? buildVConsoleDebugPanelInjectionScript(debugPanelSourceUrl, cleanUrl)
            : buildErudaDebugPanelInjectionScript(debugPanelSourceUrl, cleanUrl);
        webViewRef.current?.injectJavaScript(injectionScript);
    }, [cleanUrl, debugPanelSourceUrl, debugPanelType]);

    const removeDebugPanel = useCallback(() => {
        webViewRef.current?.injectJavaScript(buildWebViewDebugPanelRemovalScript());
    }, []);

    // 安全区 insets
    const insets = useSafeAreaInsets();
    const currentSafeTop = Math.round(insets.top);
    const currentSafeBottom = Math.round(insets.bottom);
    const debugHotspotStyle = useMemo(() => (
        buildWebViewDebugHotspotStyle(debugHotspotStyleConfig, insets.top, insets.bottom)
    ), [debugHotspotStyleConfig, insets.top, insets.bottom]);

    const injectNativeSafeArea = useCallback(() => {
        webViewRef.current?.injectJavaScript(buildNativeSafeAreaEventScript(currentSafeTop, currentSafeBottom));
    }, [currentSafeTop, currentSafeBottom]);

    const showToast = useCallback((message) => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
        setToastMessage(message);
        toastTimerRef.current = setTimeout(() => {
            setToastMessage('');
            toastTimerRef.current = null;
        }, 1400);
    }, []);

    const handleDebugHotspotPress = useCallback(() => {
        if (debugPanelTapResetTimerRef.current) {
            clearTimeout(debugPanelTapResetTimerRef.current);
        }

        debugPanelTapCountRef.current += 1;
        if (debugPanelTapCountRef.current >= WEBVIEW_DEBUG_PANEL_TAP_COUNT) {
            debugPanelTapCountRef.current = 0;
            debugPanelTapResetTimerRef.current = null;
            const nextEnabled = !debugPanelEnabled;
            setDebugPanelEnabled(nextEnabled);
            setStoredWebViewDebugPanelEnabled(nextEnabled);
            showToast(nextEnabled ? 'on' : 'off');
            if (nextEnabled) {
                injectDebugPanel();
            } else {
                removeDebugPanel();
            }
            return;
        }

        debugPanelTapResetTimerRef.current = setTimeout(() => {
            debugPanelTapCountRef.current = 0;
            debugPanelTapResetTimerRef.current = null;
        }, WEBVIEW_DEBUG_PANEL_TAP_WINDOW_MS);
    }, [debugPanelEnabled, injectDebugPanel, removeDebugPanel, showToast]);

    useEffect(() => {
        let active = true;
        getStoredWebViewDebugPanelEnabled().then((enabled) => {
            if (!active || typeof enabled !== 'boolean') return;
            setDebugPanelEnabled(enabled);
        });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!webViewDebug || !debugPanelEnabled) return;
        injectDebugPanel();
    }, [debugPanelEnabled, injectDebugPanel, webViewDebug]);

    useEffect(() => () => {
        if (debugPanelTapResetTimerRef.current) {
            clearTimeout(debugPanelTapResetTimerRef.current);
        }
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
        if (webViewAuthSessionTimerRef.current) {
            clearTimeout(webViewAuthSessionTimerRef.current);
        }
        pendingWebViewAuthSessionRef.current = null;
    }, []);

    // 将 ARGB 16进制（0xAARRGGBB）转为 rgba(r,g,b,a) 字符串，并计算状态栏样式
    const { backgroundColor, barStyle } = useMemo(() => {
        try {
            const num = parseInt(XBackgroundColor.replace('0x', ''), 16);
            const a = ((num >>> 24) & 0xff) / 255;
            const r = (num >>> 16) & 0xff;
            const g = (num >>> 8) & 0xff;
            const b = num & 0xff;
            const bg = `rgba(${r},${g},${b},${a.toFixed(2)})`;

            // 根据背景色亮度自动选择状态栏图标颜色
            // 公式：感知亮度 = 0.299R + 0.587G + 0.114B（ITU-R BT.601）
            let style;
            if (XStatusBarStyle === 'dark') {
                style = 'dark-content';
            } else if (XStatusBarStyle === 'light') {
                style = 'light-content';
            } else {
                // auto：亮度 > 128 为浅色背景 → 深色图标，否则白色图标
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                style = luminance > 128 ? 'dark-content' : 'light-content';
            }
            return { backgroundColor: bg, barStyle: style };
        } catch {
            return { backgroundColor: 'transparent', barStyle: 'dark-content' };
        }
    }, [XBackgroundColor, XStatusBarStyle]);

    // 切换全屏
    const toggleFullScreen = useCallback(() => {
        setFullScreen((prev) => !prev);
    }, []);

    const postWebViewMessage = useCallback((messageAction, messageParams) => {
        webViewRef.current?.postMessage(JSON.stringify({
            action: messageAction,
            params: messageParams,
        }));
    }, []);

    const postGoogleAuthSuccess = useCallback((resultUrl) => {
        if (!resultUrl || lastGoogleAuthResultUrlRef.current === resultUrl) return;
        lastGoogleAuthResultUrlRef.current = resultUrl;
        if (Platform.OS === 'ios') {
            WebBrowser.dismissAuthSession();
        }
        postWebViewMessage('googleAuthSuccess', {
            url: resultUrl,
        });
    }, [postWebViewMessage]);

    const postTelegramAuthSuccess = useCallback((resultUrl) => {
        if (!resultUrl || lastTelegramAuthResultUrlRef.current === resultUrl) return;
        lastTelegramAuthResultUrlRef.current = resultUrl;
        if (Platform.OS === 'ios') {
            WebBrowser.dismissAuthSession();
        }
        postWebViewMessage('telegramAuthSuccess', {
            url: resultUrl,
        });
    }, [postWebViewMessage]);

    const closeWebViewAuthSession = useCallback(() => {
        try {
            WebBrowser.dismissAuthSession();
        } catch (e) {
            console.warn('WebView auth dismiss error:', e);
        }
    }, []);

    const openGoogleAuthSession = useCallback(async (authUrl, authSessionId) => {
        try {
            const result = await WebBrowser.openAuthSessionAsync(authUrl, GOOGLE_AUTH_REDIRECT_URL);
            if (authSessionId !== latestWebViewAuthSessionIdRef.current) return;
            if (result.type === 'success') {
                postGoogleAuthSuccess(result.url);
            } else {
                postWebViewMessage('googleAuthCancel', {
                    type: result.type,
                });
            }
        } catch (e) {
            if (authSessionId !== latestWebViewAuthSessionIdRef.current) return;
            console.warn('Google auth error:', e);
            postWebViewMessage('googleAuthError', {
                message: e?.message ?? String(e),
            });
        }
    }, [postGoogleAuthSuccess, postWebViewMessage]);

    const openTelegramAuthSession = useCallback(async (authUrl, authSessionId) => {
        try {
            const result = await WebBrowser.openAuthSessionAsync(authUrl, TELEGRAM_AUTH_REDIRECT_URL);
            if (authSessionId !== latestWebViewAuthSessionIdRef.current) return;
            if (result.type === 'success') {
                postTelegramAuthSuccess(result.url);
            } else {
                postWebViewMessage('telegramAuthCancel', {
                    type: result.type,
                });
            }
        } catch (e) {
            if (authSessionId !== latestWebViewAuthSessionIdRef.current) return;
            console.warn('Telegram auth error:', e);
            postWebViewMessage('telegramAuthError', {
                message: e?.message ?? String(e),
            });
        }
    }, [postTelegramAuthSuccess, postWebViewMessage]);

    const openPendingWebViewAuthSession = useCallback(() => {
        if (webViewAuthSessionOpenRef.current) {
            closeWebViewAuthSession();
            return;
        }

        const nextAuthSession = pendingWebViewAuthSessionRef.current;
        pendingWebViewAuthSessionRef.current = null;
        if (!nextAuthSession) return;

        webViewAuthSessionOpenRef.current = true;
        Promise.resolve(nextAuthSession()).finally(() => {
            webViewAuthSessionOpenRef.current = false;
            if (pendingWebViewAuthSessionRef.current && !webViewAuthSessionTimerRef.current) {
                webViewAuthSessionTimerRef.current = setTimeout(() => {
                    webViewAuthSessionTimerRef.current = null;
                    openPendingWebViewAuthSession();
                }, 0);
            }
        });
    }, [closeWebViewAuthSession]);

    const openWebViewAuthSessionNow = useCallback((openAuthSession) => {
        const authSessionId = latestWebViewAuthSessionIdRef.current + 1;
        latestWebViewAuthSessionIdRef.current = authSessionId;
        webViewAuthSessionOpenRef.current = true;
        Promise.resolve(openAuthSession(authSessionId)).finally(() => {
            webViewAuthSessionOpenRef.current = false;
        });
    }, []);

    const scheduleIosWebViewAuthSession = useCallback((openAuthSession) => {
        const authSessionId = latestWebViewAuthSessionIdRef.current + 1;
        latestWebViewAuthSessionIdRef.current = authSessionId;
        pendingWebViewAuthSessionRef.current = () => openAuthSession(authSessionId);

        if (webViewAuthSessionTimerRef.current) {
            clearTimeout(webViewAuthSessionTimerRef.current);
        }

        if (webViewAuthSessionOpenRef.current) {
            closeWebViewAuthSession();
        }

        webViewAuthSessionTimerRef.current = setTimeout(() => {
            webViewAuthSessionTimerRef.current = null;
            openPendingWebViewAuthSession();
        }, WEBVIEW_AUTH_SESSION_DEBOUNCE_MS);
    }, [closeWebViewAuthSession, openPendingWebViewAuthSession]);

    const scheduleAndroidWebViewAuthSession = useCallback((openAuthSession) => {
        if (webViewAuthSessionOpenRef.current) return;

        const authSessionId = latestWebViewAuthSessionIdRef.current + 1;
        latestWebViewAuthSessionIdRef.current = authSessionId;
        pendingWebViewAuthSessionRef.current = () => openAuthSession(authSessionId);

        if (webViewAuthSessionTimerRef.current) {
            clearTimeout(webViewAuthSessionTimerRef.current);
        }

        webViewAuthSessionTimerRef.current = setTimeout(() => {
            webViewAuthSessionTimerRef.current = null;
            openPendingWebViewAuthSession();
        }, WEBVIEW_AUTH_SESSION_DEBOUNCE_MS);
    }, [openPendingWebViewAuthSession]);

    const runWebViewAuthSession = useCallback((openAuthSession) => {
        if (Platform.OS === 'web') {
            openWebViewAuthSessionNow(openAuthSession);
            return;
        }

        if (Platform.OS === 'android') {
            scheduleAndroidWebViewAuthSession(openAuthSession);
            return;
        }

        scheduleIosWebViewAuthSession(openAuthSession);
    }, [openWebViewAuthSessionNow, scheduleAndroidWebViewAuthSession, scheduleIosWebViewAuthSession]);

    useEffect(() => {
        if (!googleAuthResultUrl) return;
        postGoogleAuthSuccess(googleAuthResultUrl);
        clearGoogleAuthResultUrl();
    }, [clearGoogleAuthResultUrl, googleAuthResultUrl, postGoogleAuthSuccess]);

    useEffect(() => {
        if (!telegramAuthResultUrl) return;
        postTelegramAuthSuccess(telegramAuthResultUrl);
        clearTelegramAuthResultUrl();
    }, [clearTelegramAuthResultUrl, postTelegramAuthSuccess, telegramAuthResultUrl]);

    // 处理 H5 通过 window.ReactNativeWebView.postMessage 发来的消息
    const handleMessage = useCallback(async (event) => {
        try {
            const { action, params } = JSON.parse(event.nativeEvent.data);
            if (action === 'openBrowser' && params?.url) {
                Linking.openURL(params.url);
            }
            if (action === 'openGoogleAuth' && params?.url) {
                runWebViewAuthSession((authSessionId) => openGoogleAuthSession(params.url, authSessionId));
            }
            if (action === 'openTelegramAuth' && params?.url) {
                runWebViewAuthSession((authSessionId) => openTelegramAuthSession(params.url, authSessionId));
            }
            // H5 调用：window.ReactNativeWebView.postMessage(JSON.stringify({ action: 'getSafeArea' }))
            // 响应：window 上触发 CustomEvent('nativeSafeArea')，detail 为 { safeTop, safeBottom }
            if (action === 'getSafeArea') {
                injectNativeSafeArea();
            }
        } catch (e) {
            console.warn('WebView message parse error:', e);
        }
    }, [injectNativeSafeArea, openGoogleAuthSession, openTelegramAuthSession, runWebViewAuthSession]);

    useEffect(() => {
        if (!initialLoadDoneRef.current) return;
        injectNativeSafeArea();
    }, [injectNativeSafeArea]);

    const entryUrlKey = `${cleanUrl}\n${XSafeTopStatus}\n${XSafeBottomStatus}`;
    const entryUrlRef = useRef({ key: null, url: cleanUrl });
    if (entryUrlRef.current.key !== entryUrlKey) {
        entryUrlRef.current = {
            key: entryUrlKey,
            url: buildWebViewEntryUrl(cleanUrl, XSafeTopStatus, XSafeBottomStatus, currentSafeTop, currentSafeBottom),
        };
    }
    const entryUrl = entryUrlRef.current.url;
    const webViewSource = useMemo(() => ({ uri: entryUrl }), [entryUrl]);

    const webview = (
        <WebView
            ref={webViewRef}
            source={webViewSource}
            style={[styles.webview, { backgroundColor }]}
            // 部分 H5 会使用 about:srcdoc、iframe 或跨域资源，放开来源避免被 WebView 当成外部链接拦截。
            originWhitelist={WEBVIEW_ORIGIN_WHITELIST}
            javaScriptEnabled={true}
            // H5 依赖 localStorage/sessionStorage 保存登录态和运行状态。
            domStorageEnabled={true}
            // Android 上允许 iframe 跨域携带 Cookie，避免第三方入口登录态丢失。
            thirdPartyCookiesEnabled={true}
            // 兼容 HTTPS 页面加载 HTTP 资源的场景。
            mixedContentMode="always"
            // iOS 上复用系统 Cookie，减少跨域授权或入口状态不一致。
            sharedCookiesEnabled={true}
            // 不限制 iOS WebView 只能访问 App Bound Domains，避免外部域名被拦截。
            limitsNavigationsToAppBoundDomains={false}
            // 音效、视频动效需要在授权后直接播放。
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            onMessage={handleMessage}
            webviewDebuggingEnabled={webViewDebug}
            onLoadStart={(event) => {
                logWebViewDebug(webViewDebug, 'loadStart', {
                    url: event.nativeEvent?.url,
                });
                if (!initialLoadDoneRef.current) {
                    setShowLoadError(false);
                    setShowInitOverlay(true);
                }
            }}
            onLoadEnd={(event) => {
                logWebViewDebug(webViewDebug, 'loadEnd', {
                    url: event.nativeEvent?.url,
                });
                if (webViewDebug && debugPanelEnabled) {
                    injectDebugPanel();
                }
                injectNativeSafeArea();
                if (!initialLoadDoneRef.current) {
                    initialLoadDoneRef.current = true;
                    setShowInitOverlay(false);
                    setRetryingLoad(false);
                }
            }}
            onError={(event) => {
                logWebViewDebug(webViewDebug, 'error', event.nativeEvent);
                if (!initialLoadDoneRef.current) {
                    setShowInitOverlay(false);
                    setShowLoadError(isRetryableLoadError(event.nativeEvent));
                    setRetryingLoad(false);
                }
            }}
            onHttpError={(event) => {
                logWebViewDebug(webViewDebug, 'httpError', event.nativeEvent);
                if (!initialLoadDoneRef.current) {
                    setShowInitOverlay(false);
                    setShowLoadError(false);
                    setRetryingLoad(false);
                }
            }}
            onNavigationStateChange={(navState) => {
                logWebViewDebug(webViewDebug, 'navigationStateChange', {
                    url: navState.url,
                    title: navState.title,
                    loading: navState.loading,
                    canGoBack: navState.canGoBack,
                });
                setCanGoBack(navState.canGoBack);
            }}
        />
    );

    // 计算 Header 图标颜色适配背景
    const headerIconColor = barStyle === 'light-content' ? '#ffffff' : '#333333';
    const headerBtnBackgroundColor = barStyle === 'light-content' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
    const topBarBackgroundColor = barStyle === 'light-content' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';

    const handleGoBack = useCallback(() => {
        if (canGoBack) {
            webViewRef.current?.goBack();
        }
        // canGoBack === false 时什么都不做，不允许返回首页
    }, [canGoBack]);

    return (
        <>
            {/* 声明式配置，同步生效，避免首次渲染闪烁首页 title */}
            <Stack.Screen
                options={{
                    headerShown: false,
                    gestureEnabled: false,
                }}
            />

            <View
                style={[
                    styles.container,
                    { backgroundColor },
                    { paddingTop: (fullScreen && hasSafeTop) ? insets.top : 0 },
                    { paddingBottom: hasSafeBottom ? insets.bottom : 0 },
                ]}
            >
                <StatusBar
                    translucent={!hasSafeTop}
                    backgroundColor={backgroundColor}
                    barStyle={barStyle}
                />
                {!fullScreen && (
                    <View
                        style={[
                            styles.topBar,
                            { backgroundColor },
                            { paddingTop: insets.top },
                            { borderBottomColor: topBarBackgroundColor },
                        ]}
                    >
                        <View style={styles.topBarInner}>
                            <TouchableOpacity
                                onPress={handleGoBack}
                                style={[styles.topBarBtn, { backgroundColor: headerBtnBackgroundColor }]}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons
                                    name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
                                    size={16}
                                    color={headerIconColor}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={toggleFullScreen}
                                style={[styles.topBarBtn, { backgroundColor: headerBtnBackgroundColor }]}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="expand-outline" size={16} color={headerIconColor} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                {webview}
                {showInitOverlay && (
                    <View style={styles.initOverlay} pointerEvents="none">
                        <ActivityIndicator size="large" color="#FFFFFF" />
                        <Text style={styles.jumpOverlayText}>Loading...</Text>
                    </View>
                )}
                {/* 全屏时显示悬浮退出按钮（受 showFloatButton 控制） */}
                {fullScreen && showFloatButton && (
                    <Animated.View
                        entering={FadeIn.duration(200)}
                        exiting={FadeOut.duration(200)}
                        style={[styles.floatBtn, { top: insets.top + 12 }]}
                    >
                        <TouchableOpacity onPress={toggleFullScreen} style={styles.floatBtnInner}>
                            <Ionicons name="contract-outline" size={20} color="#fff" />
                        </TouchableOpacity>
                    </Animated.View>
                )}
                {webViewDebug && (
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={handleDebugHotspotPress}
                        style={[styles.debugHotspot, debugHotspotStyle]}
                    />
                )}
                <Toast message={toastMessage} top={insets.top + 64} />
            </View>
            {showLoadError && (
                <NetworkErrorScreen
                    loading={retryingLoad}
                    onPress={() => {
                        initialLoadDoneRef.current = false;
                        setRetryingLoad(true);
                        setShowLoadError(false);
                        setShowInitOverlay(true);
                        webViewRef.current?.reload();
                    }}
                />
            )}
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    webview: {
        flex: 1,
    },
    initOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#1A1D26',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    jumpOverlayText: {
        marginTop: 12,
        color: '#FFFFFF',
        fontSize: 14,
    },
    topBar: {
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    topBarInner: {
        height: 44,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    topBarBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    floatBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
    },
    floatBtnInner: {
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderRadius: 20,
        padding: 8,
    },
    debugHotspot: {
        position: 'absolute',
        zIndex: 10000,
    },
});
