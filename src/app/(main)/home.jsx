import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import LanguageMenu from '@/components/cricket/LanguageMenu';
import useTranslation from '@/hooks/useTranslation';

const GUIDE_ENTRIES = [
    {
        titleKey: 'cricket_introduction_title',
        colors: ['#8A2BE2', '#4B0082'],
        route: '/introduction',
    },
    {
        titleKey: 'cricket_history_title',
        colors: ['#1E90FF', '#00008B'],
        route: '/history',
    },
    {
        titleKey: 'cricket_rules_title',
        colors: ['#FF4500', '#8B0000'],
        route: '/rules',
    },
    {
        titleKey: 'two_player_scorer',
        colors: ['#FFA500', '#8B4513'],
        route: '/scorer',
    },
];

export default function CricketHomeScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { width } = useWindowDimensions();
    const cardSize = (width - 48) / 2;

    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <Stack.Screen
                options={{
                    title: t('Cricket Guide'),
                    headerRight: () => <LanguageMenu />,
                }}
            />
            <View style={styles.content}>
                <View style={styles.grid}>
                    {GUIDE_ENTRIES.map((entry) => (
                        <TouchableOpacity
                            key={entry.route}
                            style={[styles.cardTouchTarget, { width: cardSize, height: cardSize }]}
                            onPress={() => router.push(entry.route)}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={entry.colors}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.card}
                            >
                                <Text style={styles.cardTitle}>{t(entry.titleKey)}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.disclaimer}>
                    <Text style={styles.disclaimerText}>{t('home_disclaimer')}</Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: '#F4F5F8',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    grid: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignContent: 'flex-start',
        justifyContent: 'space-between',
        rowGap: 16,
    },
    cardTouchTarget: {
        borderRadius: 12,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 4,
    },
    card: {
        flex: 1,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    cardTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
    },
    disclaimer: {
        marginTop: 16,
        padding: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(128, 128, 128, 0.5)',
    },
    disclaimerText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 12,
        textAlign: 'center',
    },
});
