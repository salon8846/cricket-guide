import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * 内嵌 WebView 页面
 * 参数：url - 要打开的网址
 */
export default function WebViewScreen() {
    const { url, title } = useLocalSearchParams();
    const navigation = useNavigation();

    useEffect(() => {
        navigation.setOptions({
            headerShown: false,
            ...(title ? { title } : {}),
        });
    }, [title]);

    return (
        <WebView
            source={{ uri: decodeURIComponent(url) }}
            style={styles.webview}
            startInLoadingState
            renderLoading={() => (
                <View style={styles.loading}>
                    <ActivityIndicator size="large" />
                </View>
            )}
        />
    );
}

const styles = StyleSheet.create({
    webview: {
        flex: 1,
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
