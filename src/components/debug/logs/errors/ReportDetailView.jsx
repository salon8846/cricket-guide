import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { LogActionButton } from '@/components/debug/logs/LogControls';
import { formatClientErrorDetail } from '@/components/debug/logs/formatEntries';
import { useAppDebugToast } from '@/components/debug/panel/ToastContext';
import { createLogger } from '@/utils/logger';

const logger = createLogger('ErrorLogReportDetailView');

const surfaceShadow = {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
};

export default function ErrorLogReportDetailView({ loading, report, onBack, onRefresh }) {
    const showToast = useAppDebugToast();

    const copyReport = async () => {
        if (loading) return;
        try {
            await Clipboard.setStringAsync(formatClientErrorDetail(report));
            showToast('Error report copied.');
        } catch (error) {
            logger.warn('copy error report failed', { error });
            Alert.alert('Copy Failed', 'Please try again later.');
        }
    };

    return (
        <View style={styles.page}>
            <View style={styles.detailHeader}>
                <TouchableOpacity activeOpacity={0.78} onPress={onBack} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={18} color="#0F766E" />
                    <Text style={styles.backButtonText}>Errors</Text>
                </TouchableOpacity>
                <Text style={styles.detailTitle} numberOfLines={1}>{report.reportId}</Text>
            </View>

            <View style={styles.actions}>
                <LogActionButton disabled={loading} icon="refresh-outline" title="Refresh" onPress={onRefresh} />
                <LogActionButton disabled={loading} icon="copy-outline" title="Copy" onPress={copyReport} />
            </View>

            <View style={styles.reportCard}>
                <View style={styles.reportHeader}>
                    <Text style={styles.reportTitle}>Error Detail</Text>
                </View>
                <ScrollView style={styles.reportScroll} contentContainerStyle={styles.reportScrollContent}>
                    <Text style={styles.reportText} selectable>{formatClientErrorDetail(report)}</Text>
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
    },
    detailHeader: {
        minHeight: 44,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#CBD3DF',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 10,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        ...surfaceShadow,
    },
    backButton: {
        minHeight: 34,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    backButtonText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F766E',
    },
    detailTitle: {
        flex: 1,
        fontSize: 12,
        color: '#64748B',
        textAlign: 'right',
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    reportCard: {
        flex: 1,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#CBD3DF',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        ...surfaceShadow,
    },
    reportHeader: {
        minHeight: 38,
        paddingHorizontal: 14,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E2E8F0',
        justifyContent: 'center',
    },
    reportTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#4B5563',
        textTransform: 'uppercase',
    },
    reportScroll: {
        flex: 1,
    },
    reportScrollContent: {
        padding: 14,
        paddingBottom: 10,
    },
    reportText: {
        fontSize: 11,
        lineHeight: 16,
        color: '#111827',
        fontFamily: 'Courier',
    },
});
