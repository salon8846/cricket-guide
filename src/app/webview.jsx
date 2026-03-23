import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Platform,
    StatusBar,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

// X* 控制参数的 key 列表
const X_PARAMS = ['XFullScreen', 'XShowFloatButton', 'XSafeBottom', 'XSafeTop', 'XBackgroundColor'];

// 默认值
const X_DEFAULTS = {
    XFullScreen: '1',
    XShowFloatButton: '0',
    XSafeBottom: '0',
    XSafeTop: '1',
    XBackgroundColor: '0xFF000000',
};

/**
 * 从 URL 中提取 X* 控制参数，并返回剥离这些参数后的干净 URL
 */
function extractXParams(rawUrl) {
    try {
        const parsed = new URL(rawUrl);
        const xParams = { ...X_DEFAULTS };
        X_PARAMS.forEach((key) => {
            if (parsed.searchParams.has(key)) {
                xParams[key] = parsed.searchParams.get(key);
                parsed.searchParams.delete(key);
            }
        });
        return { cleanUrl: parsed.toString(), xParams };
    } catch {
        return { cleanUrl: rawUrl, xParams: { ...X_DEFAULTS } };
    }
}

/**
 * 内嵌 WebView 页面
 *
 * 路由参数：
 *   url   - 要打开的网址（必填，需 encodeURIComponent 编码）
 *
 * X* 控制参数从 url 的 query string 中解析：
 *   XFullScreen      - 0/1  初始是否全屏（隐藏导航栏）
 *   XShowFloatButton - 0/1  是否显示悬浮按钮
 *   XSafeBottom      - 0/1  是否保留底部安全区域
 *   XSafeTop         - 0/1  是否保留顶部安全区域
 *   XBackgroundColor - ARGB 16进制背景色，如 0x42000000
 */
export default function WebViewScreen() {
    const { url } = useLocalSearchParams();

    // 从 URL query string 中解析 X* 控制参数，同时得到干净的 URL
    const { cleanUrl, xParams } = useMemo(
        () => extractXParams(decodeURIComponent(url)),
        [url],
    );
    const {
        XFullScreen,
        XShowFloatButton,
        XSafeBottom,
        XSafeTop,
        XBackgroundColor,
    } = xParams;

    const navigation = useNavigation();

    // 全屏状态（可动态切换）
    const [fullScreen, setFullScreen] = useState(XFullScreen === '1');

    const showFloatButton = XShowFloatButton === '1';
    const hasSafeBottom = XSafeBottom === '1';
    const hasSafeTop = XSafeTop === '1';

    // 安全区 insets
    const insets = useSafeAreaInsets();

    // 将 ARGB 16进制（0xAARRGGBB）转为 rgba(r,g,b,a) 字符串
    const backgroundColor = useMemo(() => {
        try {
            const num = parseInt(XBackgroundColor.replace('0x', ''), 16);
            const a = ((num >>> 24) & 0xff) / 255;
            const r = (num >>> 16) & 0xff;
            const g = (num >>> 8) & 0xff;
            const b = num & 0xff;
            return `rgba(${r},${g},${b},${a.toFixed(2)})`;
        } catch {
            return 'transparent';
        }
    }, [XBackgroundColor]);

    // 切换全屏
    const toggleFullScreen = useCallback(() => {
        setFullScreen((prev) => !prev);
    }, []);

    // 更新导航栏：无 title，右侧全屏按钮（动态更新 headerShown）
    useEffect(() => {
        navigation.setOptions({
            headerShown: !fullScreen,
        });
    }, [fullScreen]);

    // 处理 H5 通过 window.ReactNativeWebView.postMessage 发来的消息
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

    const webview = (
        <WebView
            source={{ uri: cleanUrl }}
            style={[styles.webview, { backgroundColor }]}
            startInLoadingState
            onMessage={handleMessage}
            renderLoading={() => (
                <View style={[styles.loading, { backgroundColor }]}>
                    <ActivityIndicator size="large" />
                </View>
            )}
        />
    );

    // 左侧自定义返回按钮（完全替换系统默认带文字的返回按钮）
    const HeaderLeft = useCallback(() => (
        <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.headerBtn, Platform.OS === 'ios' && { marginLeft: -8 }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
            <Ionicons
                name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
                size={24}
                color="#333"
            />
        </TouchableOpacity>
    ), [navigation]);

    // 右侧全屏按钮
    const HeaderRight = useCallback(() => (
        <TouchableOpacity onPress={toggleFullScreen} style={styles.headerBtn}>
            <Ionicons name="expand-outline" size={22} color="#333" />
        </TouchableOpacity>
    ), [toggleFullScreen]);

    return (
        <>
            {/* 声明式配置，同步生效，避免首次渲染闪烁首页 title */}
            <Stack.Screen
                options={{
                    title: '',
                    headerTitle: () => null,
                    headerLeft: HeaderLeft,
                    headerRight: HeaderRight,
                    headerStyle: { backgroundColor },
                }}
            />

            <View
                style={[
                    styles.container,
                    { backgroundColor },
                    { paddingTop: (fullScreen && hasSafeTop) ? insets.top : 0 },
                    { paddingBottom: hasSafeBottom ? insets.bottom : 0 },
                ]}
            >
                <StatusBar
                    translucent={!hasSafeTop}
                    backgroundColor={backgroundColor}
                />
                {webview}

                {/* 全屏时显示悬浮退出按钮（受 showFloatButton 控制） */}
                {fullScreen && showFloatButton && (
                    <Animated.View
                        entering={FadeIn.duration(200)}
                        exiting={FadeOut.duration(200)}
                        style={[styles.floatBtn, { top: insets.top + 12 }]}
                    >
                        <TouchableOpacity onPress={toggleFullScreen} style={styles.floatBtnInner}>
                            <Ionicons name="contract-outline" size={20} color="#fff" />
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    webview: {
        flex: 1,
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    floatBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
    },
    floatBtnInner: {
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderRadius: 20,
        padding: 8,
    },
});
