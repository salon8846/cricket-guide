import React from 'react';
import {
    TouchableOpacity,
    Text,
    ActivityIndicator,
    StyleSheet,
    View,
} from 'react-native';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing } from '../../constants/theme';

/**
 * 通用 Button 组件
 *
 * @param {object} props
 * @param {string} props.title - 按钮文字
 * @param {Function} props.onPress - 点击回调
 * @param {'primary' | 'secondary' | 'outline' | 'ghost'} props.variant - 样式变体
 * @param {'sm' | 'md' | 'lg'} props.size - 尺寸
 * @param {boolean} props.loading - 加载状态
 * @param {boolean} props.disabled - 禁用状态
 * @param {boolean} props.fullWidth - 宽度撑满
 * @param {object} props.style - 自定义容器样式
 * @param {object} props.textStyle - 自定义文字样式
 */
const Button = ({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    style,
    textStyle,
}) => {
    const isDisabled = disabled || loading;

    return (
        <TouchableOpacity
            style={[
                styles.base,
                styles[variant],
                styles[`size_${size}`],
                isDisabled && styles.disabled,
                fullWidth && styles.fullWidth,
                style,
            ]}
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={0.75}
        >
            {loading ? (
                <View style={styles.row}>
                    <ActivityIndicator
                        size="small"
                        color={variant === 'outline' || variant === 'ghost' ? Colors.primary : Colors.white}
                    />
                    {title ? <Text style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`], textStyle, { marginLeft: 8 }]}>{title}</Text> : null}
                </View>
            ) : (
                <Text style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`], textStyle]}>
                    {title}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    base: {
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    fullWidth: {
        width: '100%',
    },
    disabled: {
        opacity: 0.5,
    },

    // Variants
    primary: {
        backgroundColor: Colors.primary,
    },
    secondary: {
        backgroundColor: Colors.secondary,
    },
    outline: {
        backgroundColor: Colors.transparent,
        borderWidth: 1.5,
        borderColor: Colors.primary,
    },
    ghost: {
        backgroundColor: Colors.transparent,
    },

    // Sizes
    size_sm: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
    },
    size_md: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.sm + 2,
    },
    size_lg: {
        paddingHorizontal: Spacing['2xl'],
        paddingVertical: Spacing.md,
    },

    // Text base
    text: {
        fontWeight: FontWeight.semibold,
    },

    // Text by variant
    text_primary: {
        color: Colors.white,
    },
    text_secondary: {
        color: Colors.white,
    },
    text_outline: {
        color: Colors.primary,
    },
    text_ghost: {
        color: Colors.primary,
    },

    // Text by size
    textSize_sm: {
        fontSize: FontSize.sm,
    },
    textSize_md: {
        fontSize: FontSize.md,
    },
    textSize_lg: {
        fontSize: FontSize.lg,
    },
});

export default Button;
