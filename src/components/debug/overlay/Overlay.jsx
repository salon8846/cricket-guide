import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    StyleSheet,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from '@/components/common/Toast';
import {
    toggleAppDebugPanelVisible,
    useAppDebugSnapshot,
} from '@/services/appDebug/store';
import { buildDebugTapAreaStyle } from '@/services/appDebug/activationTapArea';
import useAppDebugActivationTap from '@/components/debug/overlay/useActivationTap';
import useAppDebugFloatingButtonPosition, {
    APP_DEBUG_FLOATING_BUTTON_SIZE,
} from '@/components/debug/overlay/useFloatingButtonPosition';

const TOAST_VISIBLE_MS = 1400;

export default function AppDebugOverlay() {
    const appDebug = useAppDebugSnapshot();

    if (!appDebug.allowed) {
        return null;
    }

    return <AppDebugOverlayLayer appDebug={appDebug} />;
}

function AppDebugOverlayLayer({ appDebug }) {
    const insets = useSafeAreaInsets();
    const windowSize = useWindowDimensions();
    const toastTimerRef = useRef(null);
    const [toastMessage, setToastMessage] = useState('');

    const tapAreaStyle = useMemo(() => (
        buildDebugTapAreaStyle(appDebug.tapArea, insets.top, insets.bottom)
    ), [appDebug.tapArea, insets.top, insets.bottom]);

    const showToast = useCallback((message) => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
        setToastMessage(message);
        toastTimerRef.current = setTimeout(() => {
            setToastMessage('');
            toastTimerRef.current = null;
        }, TOAST_VISIBLE_MS);
    }, []);

    const toggleDebugPanel = useCallback(() => {
        toggleAppDebugPanelVisible();
    }, []);

    const pressActivationArea = useAppDebugActivationTap(appDebug.enabled, showToast);
    const {
        buttonPosition,
        panHandlers,
    } = useAppDebugFloatingButtonPosition({
        appDebugEnabled: appDebug.enabled,
        floatingButtonPositionRevision: appDebug.floatingButtonPositionRevision,
        insets,
        windowSize,
        onPress: toggleDebugPanel,
    });

    useEffect(() => () => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
    }, []);

    return (
        <>
            {!appDebug.panelVisible && (
                <TouchableOpacity
                    accessible={false}
                    activeOpacity={1}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    onPress={pressActivationArea}
                    style={[styles.tapArea, tapAreaStyle]}
                />
            )}
            {appDebug.enabled && (
                <View
                    {...panHandlers}
                    style={[styles.floatingButton, buttonPosition]}
                >
                    <Ionicons name="bug-outline" size={20} color="#FFFFFF" />
                </View>
            )}
            <Toast message={toastMessage} top={insets.top + 64} />
        </>
    );
}

const styles = StyleSheet.create({
    tapArea: {
        position: 'absolute',
        zIndex: 2147483646,
    },
    floatingButton: {
        position: 'absolute',
        width: APP_DEBUG_FLOATING_BUTTON_SIZE,
        height: APP_DEBUG_FLOATING_BUTTON_SIZE,
        borderRadius: APP_DEBUG_FLOATING_BUTTON_SIZE / 2,
        backgroundColor: 'rgba(20, 24, 34, 0.88)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2147483647,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.24,
        shadowRadius: 12,
        elevation: 20,
    },
});
