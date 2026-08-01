import { useState } from 'react';
import { Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import useTranslation from '@/hooks/useTranslation';

const RULE_NUMBERS = Array.from({ length: 39 }, (_, index) => index + 1);

export default function CricketRulesScreen() {
    const { t } = useTranslation();
    const [expandedRules, setExpandedRules] = useState({});

    const toggleRule = (ruleNumber) => {
        setExpandedRules((currentRules) => ({
            ...currentRules,
            [ruleNumber]: !currentRules[ruleNumber],
        }));
    };

    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <Stack.Screen options={{ title: t('cricket_rules_title') }} />
            <ScrollView>
                {RULE_NUMBERS.map((ruleNumber) => {
                    const isExpanded = expandedRules[ruleNumber] === true;

                    return (
                        <View key={ruleNumber} style={styles.rule}>
                            <Pressable style={styles.ruleTitle} onPress={() => toggleRule(ruleNumber)}>
                                <Text style={styles.ruleTitleText}>
                                    {t(`cricket_rule_${ruleNumber}_title`)}
                                </Text>
                                {isExpanded ? (
                                    <ChevronUp color="#1E1F21" size={20} />
                                ) : (
                                    <ChevronDown color="#1E1F21" size={20} />
                                )}
                            </Pressable>
                            {isExpanded && (
                                <View style={styles.ruleContent}>
                                    <Text style={styles.ruleContentText}>
                                        {t(`cricket_rule_${ruleNumber}_content`)}
                                    </Text>
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: '#F4F5F8',
    },
    rule: {
        borderBottomWidth: 1,
        borderBottomColor: '#232932',
    },
    ruleTitle: {
        minHeight: 48,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    ruleTitleText: {
        flex: 1,
        color: 'rgba(0, 0, 0, 0.88)',
        fontSize: 14,
        fontWeight: '400',
    },
    ruleContent: {
        padding: 16,
    },
    ruleContentText: {
        color: 'rgba(0, 0, 0, 0.88)',
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 21,
    },
});
