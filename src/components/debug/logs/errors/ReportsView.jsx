import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import ErrorLogReportDetailView from '@/components/debug/logs/errors/ReportDetailView';
import ErrorLogReportListView from '@/components/debug/logs/errors/ReportListView';
import {
    clearClientErrorLogs,
    readClientErrorHistoryEntries,
    readPendingClientErrors,
} from '@/services/logging/clientErrors/files';
import { createLogger } from '@/utils/logger';

const logger = createLogger('ErrorLogReportsView');

export default function ErrorLogReportsView() {
    const [loading, setLoading] = useState(false);
    const [reports, setReports] = useState([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [selectedReportId, setSelectedReportId] = useState('');

    const loadReports = useCallback(async () => {
        setLoading(true);
        try {
            const [historyReports, pendingErrors] = await Promise.all([
                readClientErrorHistoryEntries(100),
                readPendingClientErrors(),
            ]);
            setReports(historyReports);
            setPendingCount(pendingErrors.length);
        } catch (error) {
            logger.warn('load error reports failed', { error });
            Alert.alert('Load Failed', 'Please try again later.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadReports();
    }, [loadReports]);

    const clearReports = async () => {
        if (loading) return;
        setLoading(true);
        setSelectedReportId('');
        setReports([]);
        setPendingCount(0);
        try {
            await clearClientErrorLogs();
        } catch (error) {
            await loadReports();
            logger.warn('clear error reports failed', { error });
            Alert.alert('Clear Failed', 'Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const confirmClearReports = () => {
        if (loading) return;
        Alert.alert(
            'Clear Logs?',
            'This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: clearReports },
            ],
        );
    };

    const selectedReport = reports.find((report) => report.reportId === selectedReportId);
    if (selectedReport) {
        return (
            <ErrorLogReportDetailView
                loading={loading}
                report={selectedReport}
                onBack={() => {
                    setSelectedReportId('');
                    loadReports();
                }}
                onRefresh={loadReports}
            />
        );
    }

    return (
        <ErrorLogReportListView
            loading={loading}
            pendingCount={pendingCount}
            reports={reports}
            onRefresh={loadReports}
            onClear={confirmClearReports}
            onOpenReport={setSelectedReportId}
        />
    );
}
