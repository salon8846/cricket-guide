import {
    ScrollView,
    StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppDebugActionSection from '@/components/debug/tools/ActionSection';
import AppDebugDangerZoneSection from '@/components/debug/tools/DangerZoneSection';

export default function AppDebugToolsView() {
    const insets = useSafeAreaInsets();

    return (
        <ScrollView
            style={styles.content}
            contentContainerStyle={[styles.contentInner, { paddingBottom: insets.bottom + 92 }]}
        >
            <AppDebugActionSection />
            <AppDebugDangerZoneSection />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
    },
    contentInner: {
        paddingHorizontal: 10,
        paddingTop: 10,
    },
});
