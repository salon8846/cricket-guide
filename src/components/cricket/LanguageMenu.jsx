import { useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Globe } from 'lucide-react-native';
import useTranslation from '@/hooks/useTranslation';
import useLangStore from '@/store/useLangStore';

const BUILT_IN_LANGUAGE_NAMES = {
    zh: '中文',
    en: 'English',
};

export default function LanguageMenu() {
    const { lang } = useTranslation();
    const switchLang = useLangStore((state) => state.switchLang);
    const supportedLangs = useLangStore((state) => state.supportedLangs);
    const [visible, setVisible] = useState(false);
    const [switchingLanguage, setSwitchingLanguage] = useState(false);

    const languageOptions = Object.entries(
        Object.keys(supportedLangs).length > 0 ? supportedLangs : BUILT_IN_LANGUAGE_NAMES,
    );

    const selectLanguage = async (languageCode) => {
        if (languageCode === lang) {
            setVisible(false);
            return;
        }

        setSwitchingLanguage(true);
        try {
            await switchLang(languageCode);
        } finally {
            setSwitchingLanguage(false);
            setVisible(false);
        }
    };

    return (
        <>
            <TouchableOpacity
                accessibilityLabel="Language"
                style={styles.trigger}
                onPress={() => setVisible(true)}
                activeOpacity={0.7}
            >
                <Globe color="#FFFFFF" size={22} />
            </TouchableOpacity>
            <Modal
                visible={visible}
                transparent
                animationType="fade"
                onRequestClose={() => setVisible(false)}
            >
                <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
                    <Pressable style={styles.menu} onPress={(event) => event.stopPropagation()}>
                        {languageOptions.map(([languageCode, languageName]) => (
                            <TouchableOpacity
                                key={languageCode}
                                style={styles.option}
                                disabled={switchingLanguage}
                                onPress={() => selectLanguage(languageCode)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.optionText}>{languageName}</Text>
                            </TouchableOpacity>
                        ))}
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    trigger: {
        minWidth: 48,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingTop: 56,
        paddingRight: 12,
    },
    menu: {
        minWidth: 100,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        overflow: 'hidden',
    },
    option: {
        minHeight: 44,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    optionText: {
        color: '#1E1F21',
        fontSize: 14,
        fontWeight: '400',
    },
});
