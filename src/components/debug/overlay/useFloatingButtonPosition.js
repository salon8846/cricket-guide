import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder } from 'react-native';
import {
    readAppDebugFloatingButtonPosition,
    saveAppDebugFloatingButtonPosition,
} from '@/services/appDebug/store';
import { createLogger } from '@/utils/logger';

const logger = createLogger('AppDebugFloatingButtonPosition');
const APP_DEBUG_FLOATING_BUTTON_SIZE = 44;
const APP_DEBUG_FLOATING_BUTTON_MARGIN = 8;
const APP_DEBUG_FLOATING_BUTTON_START_RIGHT = 18;
const APP_DEBUG_FLOATING_BUTTON_START_BOTTOM = 24;
const APP_DEBUG_FLOATING_BUTTON_TAP_MOVE = 6;

export { APP_DEBUG_FLOATING_BUTTON_SIZE };

export default function useAppDebugFloatingButtonPosition({
    appDebugEnabled,
    floatingButtonPositionRevision,
    insets,
    windowSize,
    onPress,
}) {
    const buttonPositionRef = useRef(null);
    const buttonDragStartRef = useRef(null);
    const buttonPositionLoadedRef = useRef(false);
    const lastPositionRevisionRef = useRef(floatingButtonPositionRevision);
    const [buttonPosition, setButtonPosition] = useState(null);

    const defaultButtonPosition = useMemo(() => ({
        left: windowSize.width - APP_DEBUG_FLOATING_BUTTON_SIZE - APP_DEBUG_FLOATING_BUTTON_START_RIGHT,
        top: windowSize.height - insets.bottom - APP_DEBUG_FLOATING_BUTTON_SIZE - APP_DEBUG_FLOATING_BUTTON_START_BOTTOM,
    }), [insets.bottom, windowSize.height, windowSize.width]);

    const clampButtonPosition = useCallback((position) => {
        const minLeft = APP_DEBUG_FLOATING_BUTTON_MARGIN;
        const maxLeft = Math.max(minLeft, windowSize.width - APP_DEBUG_FLOATING_BUTTON_SIZE - APP_DEBUG_FLOATING_BUTTON_MARGIN);
        const minTop = insets.top + APP_DEBUG_FLOATING_BUTTON_MARGIN;
        const maxTop = Math.max(minTop, windowSize.height - insets.bottom - APP_DEBUG_FLOATING_BUTTON_SIZE - APP_DEBUG_FLOATING_BUTTON_MARGIN);

        return {
            left: Math.min(Math.max(position.left, minLeft), maxLeft),
            top: Math.min(Math.max(position.top, minTop), maxTop),
        };
    }, [insets.bottom, insets.top, windowSize.height, windowSize.width]);

    const currentButtonPosition = buttonPosition ?? clampButtonPosition(defaultButtonPosition);

    const panHandlers = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
            buttonDragStartRef.current = buttonPositionRef.current ?? clampButtonPosition(defaultButtonPosition);
        },
        onPanResponderMove: (_, gestureState) => {
            const startPosition = buttonDragStartRef.current ?? clampButtonPosition(defaultButtonPosition);
            const nextPosition = clampButtonPosition({
                left: startPosition.left + gestureState.dx,
                top: startPosition.top + gestureState.dy,
            });
            buttonPositionRef.current = nextPosition;
            setButtonPosition(nextPosition);
        },
        onPanResponderRelease: (_, gestureState) => {
            const moved = Math.abs(gestureState.dx) > APP_DEBUG_FLOATING_BUTTON_TAP_MOVE
                || Math.abs(gestureState.dy) > APP_DEBUG_FLOATING_BUTTON_TAP_MOVE;
            buttonDragStartRef.current = null;
            if (!moved) {
                onPress();
                return;
            }

            if (buttonPositionRef.current) {
                saveAppDebugFloatingButtonPosition(buttonPositionRef.current).catch((error) => {
                    logger.warn('app debug button position save failed', { error });
                });
            }
        },
        onPanResponderTerminate: () => {
            buttonDragStartRef.current = null;
        },
    }), [clampButtonPosition, defaultButtonPosition, onPress]);

    useEffect(() => {
        if (buttonPositionLoadedRef.current) return;
        buttonPositionLoadedRef.current = true;
        let active = true;

        readAppDebugFloatingButtonPosition().then((storedPosition) => {
            if (!active || !storedPosition) return;
            const nextPosition = clampButtonPosition(storedPosition);
            buttonPositionRef.current = nextPosition;
            setButtonPosition(nextPosition);
        }).catch((error) => {
            logger.warn('app debug button position load failed', { error });
        });

        return () => {
            active = false;
        };
    }, [clampButtonPosition]);

    useEffect(() => {
        if (!appDebugEnabled) return;
        const nextPosition = clampButtonPosition(buttonPositionRef.current ?? defaultButtonPosition);
        buttonPositionRef.current = nextPosition;
        setButtonPosition(nextPosition);
    }, [appDebugEnabled, clampButtonPosition, defaultButtonPosition]);

    useEffect(() => {
        if (lastPositionRevisionRef.current === floatingButtonPositionRevision) return;
        lastPositionRevisionRef.current = floatingButtonPositionRevision;
        const nextPosition = clampButtonPosition(defaultButtonPosition);
        buttonPositionRef.current = nextPosition;
        setButtonPosition(nextPosition);
    }, [floatingButtonPositionRevision, clampButtonPosition, defaultButtonPosition]);

    useEffect(() => {
        buttonPositionRef.current = currentButtonPosition;
    }, [currentButtonPosition]);

    return {
        buttonPosition: currentButtonPosition,
        panHandlers: panHandlers.panHandlers,
    };
}
