import { Ionicons } from '@expo/vector-icons';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function AppDebugToolButton({ icon, title, detail, onPress, danger, disabled, loading }) {
    return (
        <TouchableOpacity
            activeOpacity={0.78}
            disabled={disabled || loading}
            onPress={onPress}
            style={[
                styles.toolButton,
                danger && styles.toolButtonDanger,
                (disabled || loading) && styles.toolButtonDisabled,
            ]}
        >
            <View style={[styles.toolIcon, danger && styles.toolIconDanger]}>
                <Ionicons name={icon} size={20} color={danger ? '#B42318' : '#0F766E'} />
            </View>
            <View style={styles.toolText}>
                <Text style={[styles.toolTitle, danger && styles.toolTitleDanger]}>
                    {title}
                </Text>
                <Text style={styles.toolDetail}>{detail}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    toolButton: {
        minHeight: 68,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E2E6EC',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    toolButtonDanger: {
        backgroundColor: '#FFFDFD',
    },
    toolButtonDisabled: {
        opacity: 0.48,
    },
    toolIcon: {
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E6F7F4',
    },
    toolIconDanger: {
        backgroundColor: '#FEF3F2',
    },
    toolText: {
        flex: 1,
    },
    toolTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 3,
    },
    toolTitleDanger: {
        color: '#B42318',
    },
    toolDetail: {
        fontSize: 12,
        color: '#64748B',
        lineHeight: 17,
    },
});
