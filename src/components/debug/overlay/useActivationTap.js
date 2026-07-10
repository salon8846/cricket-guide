import { useCallback, useEffect, useRef } from 'react';
import {
    DEBUG_TAP_COUNT,
    DEBUG_TAP_WINDOW_MS,
} from '@/services/appDebug/activationTapArea';

export default function useAppDebugActivationTap(onActivated) {
    const tapCountRef = useRef(0);
    const tapResetTimerRef = useRef(null);

    const pressActivationArea = useCallback(() => {
        if (tapResetTimerRef.current) {
            clearTimeout(tapResetTimerRef.current);
        }

        tapCountRef.current += 1;
        if (tapCountRef.current >= DEBUG_TAP_COUNT) {
            tapCountRef.current = 0;
            tapResetTimerRef.current = null;
            onActivated();
            return;
        }

        tapResetTimerRef.current = setTimeout(() => {
            tapCountRef.current = 0;
            tapResetTimerRef.current = null;
        }, DEBUG_TAP_WINDOW_MS);
    }, [onActivated]);

    useEffect(() => () => {
        if (tapResetTimerRef.current) {
            clearTimeout(tapResetTimerRef.current);
        }
    }, []);

    return pressActivationArea;
}
