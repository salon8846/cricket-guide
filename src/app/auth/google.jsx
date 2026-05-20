import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import useWebViewAuthStore from '@/store/useWebViewAuthStore';

const GOOGLE_AUTH_REDIRECT_BASE_URL = 'pzbox://auth/google';

function buildGoogleAuthResultUrl(params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((item) => query.append(key, String(item)));
        } else if (value !== undefined) {
            query.set(key, String(value));
        }
    });

    const queryString = query.toString();
    return queryString ? `${GOOGLE_AUTH_REDIRECT_BASE_URL}?${queryString}` : GOOGLE_AUTH_REDIRECT_BASE_URL;
}

export default function GoogleAuthCallbackScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const setGoogleAuthResultUrl = useWebViewAuthStore((state) => state.setGoogleAuthResultUrl);
    const resultUrl = useMemo(() => buildGoogleAuthResultUrl(params), [params]);

    useEffect(() => {
        setGoogleAuthResultUrl(resultUrl);
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/');
        }
    }, [resultUrl, router, setGoogleAuthResultUrl]);

    return (
        <>
            <Stack.Screen options={{ headerShown: false, animation: 'none' }} />
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#1A1D26" />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
});
