import { Stack, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import useWebViewAuthStore from '@/store/useWebViewAuthStore';
import { APP_SCHEME } from '@/constants/config';

const GOOGLE_AUTH_REDIRECT_BASE_URL = `${APP_SCHEME}://auth/google`;
const GOOGLE_OAUTH_AUTH_REDIRECT_BASE_URL = `${APP_SCHEME}://auth/oauth/google`;

function buildGoogleAuthResultUrl(params, redirectBaseUrl) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((item) => query.append(key, String(item)));
        } else if (value !== undefined) {
            query.set(key, String(value));
        }
    });

    const queryString = query.toString();
    return queryString ? `${redirectBaseUrl}?${queryString}` : redirectBaseUrl;
}

export default function GoogleAuthCallbackScreen() {
    const router = useRouter();
    const pathname = usePathname();
    const params = useLocalSearchParams();
    const setGoogleAuthResultUrl = useWebViewAuthStore((state) => state.setGoogleAuthResultUrl);
    const redirectBaseUrl = pathname.endsWith('/oauth/google') ? GOOGLE_OAUTH_AUTH_REDIRECT_BASE_URL : GOOGLE_AUTH_REDIRECT_BASE_URL;
    const resultUrl = useMemo(() => buildGoogleAuthResultUrl(params, redirectBaseUrl), [params, redirectBaseUrl]);

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
