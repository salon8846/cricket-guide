import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useTranslation from '@/hooks/useTranslation';

export default function ArticleScreen({ titleKey, contentKey }) {
    const { t } = useTranslation();

    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <Stack.Screen options={{ title: t(titleKey) }} />
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.text}>{t(contentKey)}</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: '#F4F5F8',
    },
    content: {
        padding: 16,
    },
    text: {
        color: 'rgba(0, 0, 0, 0.88)',
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 21,
    },
});
