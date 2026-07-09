import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppDebugCrashTestSection from '@/components/debug/tools/AppDebugCrashTestSection';
import AppDebugToolButton from '@/components/debug/tools/AppDebugToolButton';
import { useAppDebugToast } from '@/components/debug/panel/AppDebugToastContext';
import { replaceWithBootstrapRestart } from '@/services/bootstrapRestart';
import {
    resetAppDebugFloatingButtonPosition,
    setAppDebugEnabled,
    setAppDebugPanelVisible,
    useAppDebugSnapshot,
} from '@/services/appDebug/appDebugStore';
import { buildAppDebugDiagnostics } from '@/services/appDebug/appDebugDiagnostics';
import { clearAppStorageKeepingDebugState } from '@/services/appDebug/appDebugStorage';
import { clearInstallIdMemoryCache } from '@/services/installIdentity';
import { clearAllLogFiles } from '@/services/logging/jsonlLogFiles';
import { createLogger } from '@/utils/logger';
import { clearAllOrThrow } from '@/utils/storage';

const logger = createLogger('AppDebugToolsView');

const toolShadow = {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
};

export default function AppDebugToolsView() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const appDebug = useAppDebugSnapshot();
    const showToast = useAppDebugToast();
    const [copyingSnapshot, setCopyingSnapshot] = useState(false);
    const [clearingStorage, setClearingStorage] = useState(false);
    const [clearingAllStorage, setClearingAllStorage] = useState(false);
    const [closingDebug, setClosingDebug] = useState(false);
    const [resettingButtonPosition, setResettingButtonPosition] = useState(false);
    const busy = copyingSnapshot || clearingStorage || clearingAllStorage || closingDebug || resettingButtonPosition;

    const restartBootstrap = () => {
        setAppDebugPanelVisible(false);
        replaceWithBootstrapRestart(router);
    };

    const copyDebugSnapshot = async () => {
        if (busy) return;
        setCopyingSnapshot(true);
        try {
            const payload = buildAppDebugDiagnostics(appDebug);
            await Clipboard.setStringAsync(JSON.stringify(payload, null, 2));
            showToast('Debug snapshot copied.');
        } catch (error) {
            logger.warn('copy debug snapshot failed', { error });
            Alert.alert('Copy Failed', 'Please try again later.');
        } finally {
            setCopyingSnapshot(false);
        }
    };

    const resetButtonPosition = async () => {
        if (busy) return;
        setResettingButtonPosition(true);
        try {
            await resetAppDebugFloatingButtonPosition();
            showToast('Button position reset.');
        } catch (error) {
            logger.warn('reset debug button position failed', { error });
            Alert.alert('Reset Failed', 'Please try again later.');
        } finally {
            setResettingButtonPosition(false);
        }
    };

    const clearStorage = async () => {
        if (busy) return;
        setClearingStorage(true);
        try {
            await clearAppStorageKeepingDebugState();
            restartBootstrap();
        } catch (error) {
            logger.warn('clear app storage failed', { error });
            Alert.alert('Clear Failed', 'Please try again later.');
        } finally {
            setClearingStorage(false);
        }
    };

    const confirmClearStorage = () => {
        if (busy) return;
        Alert.alert(
            'Clear Local Data?',
            'Debug state, installId, and floating button position will be kept.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: clearStorage,
                },
            ],
        );
    };

    const clearAllStorage = async () => {
        if (busy) return;
        setClearingAllStorage(true);
        try {
            await clearAllOrThrow();
            await clearAllLogFiles();
            clearInstallIdMemoryCache();
            restartBootstrap();
        } catch (error) {
            logger.warn('clear all app storage failed', { error });
            Alert.alert('Clear Failed', 'Please try again later.');
        } finally {
            setClearingAllStorage(false);
        }
    };

    const confirmClearAllStorage = () => {
        if (busy) return;
        Alert.alert(
            'Clear All Local Data?',
            'The app will restart bootstrap.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: clearAllStorage,
                },
            ],
        );
    };

    const closeDebug = async () => {
        if (busy) return;
        setClosingDebug(true);
        try {
            await setAppDebugEnabled(false);
            replaceWithBootstrapRestart(router);
        } catch (error) {
            logger.warn('close app debug failed', { error });
            Alert.alert('Close Failed', 'Please try again later.');
        } finally {
            setClosingDebug(false);
        }
    };

    const confirmCloseDebug = () => {
        if (busy || !appDebug.enabled) return;
        Alert.alert(
            'Close Debug?',
            'The app will restart bootstrap and stop sending debug headers.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Close',
                    style: 'destructive',
                    onPress: closeDebug,
                },
            ],
        );
    };

    return (
        <ScrollView
            style={styles.content}
            contentContainerStyle={[styles.contentInner, { paddingBottom: insets.bottom + 92 }]}
        >
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Actions</Text>
                <AppDebugToolButton
                    disabled={busy}
                    icon="copy-outline"
                    loading={copyingSnapshot}
                    title="Copy Debug Snapshot"
                    detail="Copy redacted diagnostics"
                    onPress={copyDebugSnapshot}
                />
                <AppDebugToolButton
                    disabled={busy}
                    icon="locate-outline"
                    loading={resettingButtonPosition}
                    title="Reset Button Position"
                    detail="Move floating button to default"
                    onPress={resetButtonPosition}
                />
                <AppDebugToolButton
                    disabled={busy}
                    icon="refresh-outline"
                    title="Restart Bootstrap"
                    detail="Return to the startup chain"
                    onPress={restartBootstrap}
                />
                <AppDebugToolButton
                    danger
                    disabled={busy}
                    icon="trash-outline"
                    loading={clearingStorage}
                    title="Clear Data"
                    detail="Keep debug state"
                    onPress={confirmClearStorage}
                />
                <AppDebugToolButton
                    danger
                    disabled={busy}
                    icon="warning-outline"
                    loading={clearingAllStorage}
                    title="Clear All Data"
                    detail="Clear local app data"
                    onPress={confirmClearAllStorage}
                />
                <AppDebugToolButton
                    danger
                    disabled={!appDebug.enabled || busy}
                    icon="power-outline"
                    loading={closingDebug}
                    title="Close Debug"
                    detail="Stop sending debug headers"
                    onPress={confirmCloseDebug}
                />
            </View>
            <AppDebugCrashTestSection disabled={busy} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
    },
    contentInner: {
        paddingHorizontal: 10,
        paddingTop: 10,
    },
    section: {
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#CBD3DF',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        ...toolShadow,
    },
    sectionTitle: {
        minHeight: 38,
        paddingHorizontal: 14,
        paddingTop: 12,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E2E8F0',
        fontSize: 12,
        fontWeight: '800',
        color: '#4B5563',
        textTransform: 'uppercase',
    },
});
