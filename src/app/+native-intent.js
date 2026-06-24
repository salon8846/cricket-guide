import Constants from 'expo-constants';

const getConfiguredScheme = () => {
    const scheme = Constants.expoConfig?.scheme;
    return Array.isArray(scheme) ? scheme[0] : scheme;
};

export function redirectSystemPath({ path }) {
    const rawPath = String(path ?? '').trim();
    const scheme = getConfiguredScheme() || 'app';

    try {
        const url = rawPath.includes('://')
            ? new URL(rawPath)
            : new URL(rawPath, `${scheme}:///`);
        const normalizedPath = url.pathname.replace(/^\/+/, '').split('/')[0];

        if (url.hostname === 'af' || normalizedPath === 'af') {
            return '/';
        }

        if (!url.hostname && !normalizedPath) {
            return '/';
        }

        return rawPath || '/';
    } catch {
        return '/';
    }
}
