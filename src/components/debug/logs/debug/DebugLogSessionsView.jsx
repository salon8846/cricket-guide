import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import DebugLogSessionDetailView from '@/components/debug/logs/debug/DebugLogSessionDetailView';
import DebugLogSessionListView from '@/components/debug/logs/debug/DebugLogSessionListView';
import {
    clearDebugLogFiles,
    deleteDebugLogSession,
    listDebugLogSessions,
} from '@/services/logging/debugLogSessions';
import { createLogger } from '@/utils/logger';

const logger = createLogger('DebugLogSessionsView');

export default function DebugLogSessionsView() {
    const [loading, setLoading] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [selectedSessionId, setSelectedSessionId] = useState('');

    const loadSessions = useCallback(async () => {
        setLoading(true);
        try {
            setSessions(await listDebugLogSessions());
        } catch (error) {
            logger.warn('load debug log sessions failed', { error });
            Alert.alert('Load Failed', 'Please try again later.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    const deleteSession = async (sessionId) => {
        if (loading) return;
        setLoading(true);
        try {
            await deleteDebugLogSession(sessionId);
            setSessions((currentSessions) => currentSessions.filter((session) => session.id !== sessionId));
        } catch (error) {
            logger.warn('delete debug log session failed', { error });
            Alert.alert('Delete Failed', 'Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const confirmDeleteSession = (sessionId) => {
        if (loading) return;
        Alert.alert(
            'Delete Log?',
            'This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteSession(sessionId) },
            ],
        );
    };

    const clearLogs = async () => {
        if (loading) return;
        setLoading(true);
        try {
            await clearDebugLogFiles();
            setSelectedSessionId('');
            setSessions([]);
        } catch (error) {
            logger.warn('clear debug logs failed', { error });
            Alert.alert('Clear Failed', 'Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const confirmClearLogs = () => {
        if (loading) return;
        Alert.alert(
            'Clear Logs?',
            'This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: clearLogs },
            ],
        );
    };

    if (selectedSessionId) {
        return (
            <DebugLogSessionDetailView
                sessionId={selectedSessionId}
                onBack={() => {
                    setSelectedSessionId('');
                    loadSessions();
                }}
                onDeleted={() => {
                    setSelectedSessionId('');
                    setSessions((currentSessions) => currentSessions.filter((session) => session.id !== selectedSessionId));
                }}
            />
        );
    }

    return (
        <DebugLogSessionListView
            loading={loading}
            sessions={sessions}
            onRefresh={loadSessions}
            onClear={confirmClearLogs}
            onOpenSession={setSelectedSessionId}
            onDeleteSession={confirmDeleteSession}
        />
    );
}
