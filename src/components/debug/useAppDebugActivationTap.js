import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { setAppDebugEnabled } from '@/services/appDebug';
import {
    DEBUG_TAP_COUNT,
    DEBUG_TAP_WINDOW_MS,
} from '@/services/debugTapArea';
import { createLogger } from '@/utils/logger';

const logger = createLogger('AppDebugActivationTap');

export default function useAppDebugActivationTap(appDebugEnabled, showToast) {
    const router = useRouter();
    const tapCountRef = useRef(0);
    const tapResetTimerRef = useRef(null);
    const restartTimerRef = useRef(null);
    const toggleRunningRef = useRef(false);

    const restartBootstrap = useCallback(() => {
        if (restartTimerRef.current) {
            clearTimeout(restartTimerRef.current);
        }
        restartTimerRef.current = setTimeout(() => {
            restartTimerRef.current = null;
            router.replace('/');
        }, 500);
    }, [router]);

    const applyDebugEnabled = useCallback((enabled) => {
        setAppDebugEnabled(enabled).then((nextAppDebug) => {
            showToast(nextAppDebug.enabled ? 'debug on' : 'debug off');
            restartBootstrap();
        }).catch((error) => {
            logger.warn('app debug toggle failed', { error });
        }).finally(() => {
            toggleRunningRef.current = false;
        });
    }, [restartBootstrap, showToast]);

    const enableAppDebug = useCallback(() => {
        if (toggleRunningRef.current) return;
        toggleRunningRef.current = true;
        applyDebugEnabled(true);
    }, [applyDebugEnabled]);

    const requestDisableAppDebug = useCallback(() => {
        if (toggleRunningRef.current) return;
        toggleRunningRef.current = true;
        Alert.alert(
            'Close Debug?',
            'The app will restart bootstrap and stop sending debug headers.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: () => {
                        toggleRunningRef.current = false;
                    },
                },
                {
                    text: 'Close',
                    style: 'destructive',
                    onPress: () => {
                        applyDebugEnabled(false);
                    },
                },
            ],
            { cancelable: false },
        );
    }, [applyDebugEnabled]);

    const pressActivationArea = useCallback(() => {
        if (tapResetTimerRef.current) {
            clearTimeout(tapResetTimerRef.current);
        }

        tapCountRef.current += 1;
        if (tapCountRef.current >= DEBUG_TAP_COUNT) {
            tapCountRef.current = 0;
            tapResetTimerRef.current = null;
            if (appDebugEnabled) {
                requestDisableAppDebug();
            } else {
                enableAppDebug();
            }
            return;
        }

        tapResetTimerRef.current = setTimeout(() => {
            tapCountRef.current = 0;
            tapResetTimerRef.current = null;
        }, DEBUG_TAP_WINDOW_MS);
    }, [appDebugEnabled, enableAppDebug, requestDisableAppDebug]);

    useEffect(() => () => {
        if (tapResetTimerRef.current) {
            clearTimeout(tapResetTimerRef.current);
        }
        if (restartTimerRef.current) {
            clearTimeout(restartTimerRef.current);
        }
    }, []);

    return pressActivationArea;
}
