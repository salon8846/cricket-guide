import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
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

    /**
     * 处理 H5 页面通过 window.XWebview.postMessage 发来的消息
     * 支持的 action:
     *   - openBrowser: 用系统默认浏览器打开指定 url
     */
    const handleMessage = useCallback((event) => {
        try {
            const { action, params } = JSON.parse(event.nativeEvent.data);
            if (action === 'openBrowser' && params?.url) {
                Linking.openURL(params.url);
            }
        } catch (e) {
            console.warn('WebView message parse error:', e);
        }
    }, []);

    return (
        <WebView
            source={{ uri: decodeURIComponent(url) }}
            style={styles.webview}
            startInLoadingState
            onMessage={handleMessage}
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
