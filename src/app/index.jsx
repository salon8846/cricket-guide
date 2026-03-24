import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, Modal, Pressable, FlatList, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import Button from '../components/common/Button';
import { Colors, FontSize, FontWeight, Spacing } from '../constants/theme';
import useUserStore from '../store/useUserStore';
import useLangStore from '../store/useLangStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useAppStore from '../store/useAppStore';
/**
 * 首页 - 展示项目结构和组件示例
 */
export default function HomeScreen() {
    const isLoggedIn = useUserStore((state) => state.isLoggedIn);
    const { lang, t, switchLang, supportedLangs } = useLangStore();
    // 单独订阅 translations，使导航栏在翻译异步加载完成后也能刷新
    const translations = useLangStore((state) => state.translations);
    const navigation = useNavigation();
    const jumpOverlay = useAppStore((state) => state.jumpOverlay);
    const [langModalVisible, setLangModalVisible] = useState(false);
    const [switching, setSwitching] = useState(false);

    // 设置导航栏右侧语言切换按钮
    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: true,
            title: t('首页'),
            headerRight: () => (
                <TouchableOpacity
                    style={styles.langBtn}
                    onPress={() => setLangModalVisible(true)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.langBtnText}>
                        {supportedLangs[lang] || lang.toUpperCase()} 🌐
                    </Text>
                </TouchableOpacity>
            ),
        });
    }, [navigation, lang, supportedLangs, translations]);


    const handleSelectLang = useCallback(async (code) => {
        if (code === lang) {
            setLangModalVisible(false);
            return;
        }
        setSwitching(true);
        try {
            await switchLang(code);
        } finally {
            setSwitching(false);
            setLangModalVisible(false);
        }
    }, [lang, switchLang]);

    // 将 supportedLangs 对象转为数组
    const langList = Object.entries(supportedLangs).map(([code, name]) => ({ code, name }));

    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>🚀 baseApp</Text>
                    <Text style={styles.subtitle}>React Native + Expo {t('项目模板')}</Text>
                </View>

                {/* Status */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{t('当前状态')}</Text>
                    <Text style={styles.cardText}>
                        {t('登录状态')}：{isLoggedIn ? `✅ 已登录` : `❌ ${t('未登录')}`}
                    </Text>
                </View>

                {/* Directory */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>📁 {t('项目结构')}</Text>
                    {[
                        ['src/app/', t('路由页面')],
                        ['src/components/', t('公共组件')],
                        ['src/constants/', t('主题')],
                        ['src/hooks/', t('自定义')],
                        ['src/services/', t('请求封装')],
                        ['src/store/', t('全局状态')],
                        ['src/utils/', t('工具函数')],
                    ].map(([path, desc], i) => (
                        <Text key={i} style={styles.codeText}>{path.padEnd(18)}{desc}</Text>
                    ))}
                </View>

                {/* Button Demo */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>🧩 {t('组件示例')}</Text>
                    <View style={styles.buttonGroup}>
                        <Button title={`Primary ${t('按钮')}`} onPress={() => { }} fullWidth />
                        <Button title={`Outline ${t('按钮')}`} variant="outline" onPress={() => { }} fullWidth />
                        <Button title={`Ghost ${t('按钮')}`} variant="ghost" onPress={() => { }} fullWidth />
                        <Button title={t('加载中')} loading onPress={() => { }} fullWidth />
                        <Button title={t('禁用状态')} disabled onPress={() => { }} fullWidth />
                        <Button title="彻底清理本地数据" onPress={() => AsyncStorage.clear()} />
                    </View>
                </View>
            </ScrollView>

            {/* 语言选择弹窗 */}
            <Modal
                visible={langModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setLangModalVisible(false)}
            >
                <Pressable style={styles.overlay} onPress={() => setLangModalVisible(false)}>
                    <Pressable style={styles.langModal} onPress={(e) => e.stopPropagation()}>
                        <Text style={styles.langModalTitle}>🌐 {t('选择语言')}</Text>
                        {langList.length === 0 ? (
                            <Text style={styles.langEmptyText}>{t('暂无可切换语言')}</Text>
                        ) : (
                            <FlatList
                                data={langList}
                                keyExtractor={(item) => item.code}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.langItem,
                                            item.code === lang && styles.langItemActive,
                                        ]}
                                        onPress={() => handleSelectLang(item.code)}
                                        disabled={switching}
                                        activeOpacity={0.7}
                                    >
                                        <Text
                                            style={[
                                                styles.langItemText,
                                                item.code === lang && styles.langItemTextActive,
                                            ]}
                                        >
                                            {item.name}
                                        </Text>
                                        {item.code === lang && (
                                            <Text style={styles.checkmark}>✅</Text>
                                        )}
                                    </TouchableOpacity>
                                )}
                                ItemSeparatorComponent={() => <View style={styles.separator} />}
                            />
                        )}
                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => setLangModalVisible(false)}
                        >
                            <Text style={styles.cancelText}>{t('取消')}</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
            {/* 跳转遮罩：识别到需要跳转 webview 时，遮住首页内容，显示白屏+菊花 */}
            {jumpOverlay && (
                <View style={styles.jumpOverlay} pointerEvents="none">
                    <ActivityIndicator size="large" color="#3961FB" />
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    container: {
        padding: Spacing.lg,
        paddingBottom: Spacing['4xl'],
    },
    jumpOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    header: {
        alignItems: 'center',
        paddingVertical: Spacing['3xl'],
    },
    title: {
        fontSize: FontSize['4xl'],
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
    },
    subtitle: {
        marginTop: Spacing.xs,
        fontSize: FontSize.md,
        color: Colors.textSecondary,
    },
    card: {
        backgroundColor: Colors.white,
        borderRadius: 12,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    cardTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.semibold,
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
    },
    cardText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
    },
    codeText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        fontFamily: 'monospace',
        lineHeight: 22,
    },
    buttonGroup: {
        gap: Spacing.sm,
    },
    // 导航栏语言按钮
    langBtn: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: Colors.background,
        marginRight: 4,
    },
    langBtnText: {
        fontSize: FontSize.sm,
        color: Colors.textPrimary,
        fontWeight: FontWeight.semibold,
    },
    // 语言弹窗
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    langModal: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        width: 280,
        paddingVertical: Spacing.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 10,
    },
    langModalTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        textAlign: 'center',
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
    },
    langEmptyText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        paddingVertical: Spacing.lg,
    },
    langItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
    },
    langItemActive: {
        backgroundColor: '#F0F4FF',
    },
    langItemText: {
        fontSize: FontSize.md,
        color: Colors.textPrimary,
    },
    langItemTextActive: {
        fontWeight: FontWeight.semibold,
        color: '#4A6FFF',
    },
    checkmark: {
        fontSize: 16,
    },
    separator: {
        height: 1,
        backgroundColor: Colors.background,
    },
    cancelBtn: {
        marginTop: Spacing.md,
        paddingVertical: Spacing.sm,
        marginHorizontal: Spacing.lg,
        borderRadius: 10,
        backgroundColor: Colors.background,
        alignItems: 'center',
    },
    cancelText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        fontWeight: FontWeight.semibold,
    },
});
