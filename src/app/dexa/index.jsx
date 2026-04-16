import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Button from '../../components/common/Button';
import { Colors, FontSize, FontWeight, Spacing } from '../../constants/theme';

/**
 * B 模块示例页（abTest=1 时落地）
 */
export default function BModuleScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <Text style={styles.title}>B模块</Text>
            <Text style={styles.desc}>abTest=1 且命中内部分流时进入此页面</Text>
            <View style={styles.actions}>
                <Button title="进入首页" onPress={() => router.replace('/home')} fullWidth />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        padding: Spacing.lg,
        paddingTop: Spacing['3xl'],
    },
    title: {
        fontSize: FontSize['3xl'],
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
    },
    desc: {
        marginTop: Spacing.sm,
        fontSize: FontSize.md,
        color: Colors.textSecondary,
    },
    actions: {
        marginTop: Spacing.xl,
    },
});
