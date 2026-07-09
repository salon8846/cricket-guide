import { Ionicons } from '@expo/vector-icons';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
} from 'react-native';

export function LogModeButton({ active, title, onPress }) {
    return (
        <TouchableOpacity
            activeOpacity={0.78}
            onPress={onPress}
            style={[styles.modeButton, active && styles.modeButtonActive]}
        >
            <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>{title}</Text>
        </TouchableOpacity>
    );
}

export function LogActionButton({ icon, title, onPress, danger, disabled }) {
    return (
        <TouchableOpacity
            activeOpacity={0.78}
            disabled={disabled}
            onPress={onPress}
            style={[styles.actionButton, danger && styles.actionButtonDanger, disabled && styles.actionButtonDisabled]}
        >
            <Ionicons name={icon} size={17} color={danger ? '#B42318' : '#0F766E'} />
            <Text style={[styles.actionButtonText, danger && styles.actionButtonTextDanger]}>{title}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    modeButton: {
        flex: 1,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modeButtonActive: {
        backgroundColor: '#E6F7F4',
    },
    modeButtonText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#64748B',
    },
    modeButtonTextActive: {
        color: '#0F766E',
    },
    actionButton: {
        flex: 1,
        minHeight: 42,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#CBD3DF',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    actionButtonDanger: {
        backgroundColor: '#FFFDFD',
    },
    actionButtonDisabled: {
        opacity: 0.48,
    },
    actionButtonText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0F766E',
    },
    actionButtonTextDanger: {
        color: '#B42318',
    },
});
