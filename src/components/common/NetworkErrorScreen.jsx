import { ActivityIndicator, Image, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useLangStore from '../../store/useLangStore';

const imgNetworkError = require('../../../assets/images/networkError.png');

export default function NetworkErrorScreen({
    title = '请求失败，请重试!',
    subtitle = 'Request failed, please try again!',
    buttonText = '重新请求',
    buttonSubText = 'Re-request',
    loading = false,
    onPress,
}) {
    const insets = useSafeAreaInsets();
    const { t } = useLangStore();

    return (
        <View style={styles.overlay}>
            <StatusBar barStyle="light-content" translucent={false} backgroundColor="#1A1D26" />
            <View
                style={[
                    styles.container,
                    {
                        paddingTop: insets.top + 24,
                        paddingBottom: insets.bottom + 32,
                    },
                ]}
            >
                <View style={styles.content}>
                    <View style={styles.topGroup}>
                        <Image source={imgNetworkError} style={styles.illustration} resizeMode="contain" />
                        <View style={styles.textGroup}>
                            <Text style={styles.title}>{t(title)}</Text>
                            <Text style={styles.subtitle}>{t(subtitle)}</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        activeOpacity={0.88}
                        disabled={loading}
                        onPress={onPress}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <View style={styles.buttonTextGroup}>
                                <Text style={styles.buttonText}>{buttonText}</Text>
                                <Text style={styles.buttonSubText}>{buttonSubText}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#1A1D26',
        zIndex: 10000,
    },
    container: {
        flex: 1,
        backgroundColor: '#1A1D26',
        paddingHorizontal: 24,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 90,
    },
    topGroup: {
        alignItems: 'center',
    },
    illustration: {
        width: 200,
        height: 200,
        marginBottom: 20,
    },
    textGroup: {
        alignItems: 'center',
        gap: 6,
    },
    title: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 22,
        textAlign: 'center',
    },
    subtitle: {
        color: '#fff',
        fontSize: 12,
        lineHeight: 18,
        textAlign: 'center',
    },
    button: {
        minWidth: 160,
        minHeight: 56,
        borderRadius: 10,
        backgroundColor: '#0FBA81',
        paddingHorizontal: 24,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 50,
    },
    buttonDisabled: {
        opacity: 0.9,
    },
    buttonTextGroup: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 14,
        lineHeight: 18,
        fontWeight: '600',
        textAlign: 'center',
    },
    buttonSubText: {
        color: '#FFFFFF',
        fontSize: 12,
        lineHeight: 14,
        textAlign: 'center',
    },
});
