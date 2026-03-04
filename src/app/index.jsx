import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/common/Button';
import { Colors, FontSize, FontWeight, Spacing } from '../constants/theme';
import useUserStore from '../store/useUserStore';

/**
 * 首页 - 展示项目结构和组件示例
 */
export default function HomeScreen() {
    const isLoggedIn = useUserStore((state) => state.isLoggedIn);

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>🚀 baseApp</Text>
                    <Text style={styles.subtitle}>React Native + Expo 项目模板</Text>
                </View>

                {/* Status */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>当前状态</Text>
                    <Text style={styles.cardText}>
                        登录状态：{isLoggedIn ? '✅ 已登录' : '❌ 未登录'}
                    </Text>
                </View>

                {/* Directory */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>📁 项目结构</Text>
                    {[
                        'src/app/        路由页面 (expo-router)',
                        'src/components/ 公共组件',
                        'src/constants/  主题/配置常量',
                        'src/hooks/      自定义 Hooks',
                        'src/services/   API 请求封装',
                        'src/store/      全局状态 (zustand)',
                        'src/utils/      工具函数',
                    ].map((item, i) => (
                        <Text key={i} style={styles.codeText}>{item}</Text>
                    ))}
                </View>

                {/* Button Demo */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>🧩 Button 组件示例</Text>
                    <View style={styles.buttonGroup}>
                        <Button title="Primary 按钮" onPress={() => { }} fullWidth />
                        <Button title="Outline 按钮" variant="outline" onPress={() => { }} fullWidth />
                        <Button title="Ghost 按钮" variant="ghost" onPress={() => { }} fullWidth />
                        <Button title="加载中..." loading onPress={() => { }} fullWidth />
                        <Button title="禁用状态" disabled onPress={() => { }} fullWidth />
                    </View>
                </View>
            </ScrollView>
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
});
