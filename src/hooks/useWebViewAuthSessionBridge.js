import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { APP_SCHEME } from '@/constants/config';
import useWebViewAuthStore from '@/store/useWebViewAuthStore';

const GOOGLE_AUTH_REDIRECT_URL = `${APP_SCHEME}://auth/google`;
const TELEGRAM_AUTH_REDIRECT_URL = `${APP_SCHEME}://auth/telegram`;
const WEBVIEW_AUTH_SESSION_DEBOUNCE_MS = 500;

export default function useWebViewAuthSessionBridge({ postWebViewMessage, logger }) {
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
        } catch (error) {
            logger.warn('auth session dismiss failed', { error });
        }
    }, [logger]);

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
        } catch (error) {
            if (authSessionId !== latestWebViewAuthSessionIdRef.current) return;
            logger.warn('google auth failed', { error });
            postWebViewMessage('googleAuthError', {
                message: error?.message ?? String(error),
            });
        }
    }, [logger, postGoogleAuthSuccess, postWebViewMessage]);

    const openTelegramAuthSession = useCallback(async (authUrl, authSessionId) => {
        try {
            const result = await WebBrowser.openAuthSessionAsync(authUrl, TELEGRAM_AUTH_REDIRECT_URL);
            if (authSessionId !== latestWebViewAuthSessionIdRef.current) return;
            if (result.type === 'success') {
                postTelegramAuthSuccess(result.url);
            } else if (!lastTelegramAuthResultUrlRef.current) {
                postWebViewMessage('telegramAuthCancel', {
                    type: result.type,
                });
            }
        } catch (error) {
            if (authSessionId !== latestWebViewAuthSessionIdRef.current) return;
            logger.warn('telegram auth failed', { error });
            postWebViewMessage('telegramAuthError', {
                message: error?.message ?? String(error),
            });
        }
    }, [logger, postTelegramAuthSuccess, postWebViewMessage]);

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

    const runGoogleAuthSession = useCallback((authUrl) => {
        runWebViewAuthSession((authSessionId) => openGoogleAuthSession(authUrl, authSessionId));
    }, [openGoogleAuthSession, runWebViewAuthSession]);

    const runTelegramAuthSession = useCallback((authUrl) => {
        lastTelegramAuthResultUrlRef.current = null;
        runWebViewAuthSession((authSessionId) => openTelegramAuthSession(authUrl, authSessionId));
    }, [openTelegramAuthSession, runWebViewAuthSession]);

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

    useEffect(() => () => {
        if (webViewAuthSessionTimerRef.current) {
            clearTimeout(webViewAuthSessionTimerRef.current);
        }
        pendingWebViewAuthSessionRef.current = null;
    }, []);

    return {
        runGoogleAuthSession,
        runTelegramAuthSession,
    };
}
