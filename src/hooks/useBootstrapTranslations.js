import { useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';
import useAppStore from '@/store/useAppStore';
import useLangStore from '@/store/useLangStore';
import { createLogger } from '@/utils/logger';

const logger = createLogger('BootstrapTranslations');

export default function useBootstrapTranslations() {
    const pathname = usePathname();
    const bootstrapBase = useAppStore((state) => state.bootstrapBase);
    const clearBootstrapBase = useAppStore((state) => state.clearBootstrapBase);
    const fetchTranslationsIfNeeded = useLangStore((state) => state.fetchTranslationsIfNeeded);
    const activeBootstrapTranslationBaseRef = useRef(null);

    useEffect(() => {
        const isInternalRoute = pathname !== '/' && !pathname.startsWith('/webview');
        if (!isInternalRoute || !bootstrapBase) {
            return;
        }
        if (activeBootstrapTranslationBaseRef.current === bootstrapBase) {
            return;
        }
        activeBootstrapTranslationBaseRef.current = bootstrapBase;

        const { languageVer, language, defaultLanguage } = bootstrapBase;
        fetchTranslationsIfNeeded(languageVer ?? 0, language ?? {}, defaultLanguage)
            .catch((error) => {
                logger.warn('fetch bootstrap translations failed', { error });
            })
            .finally(() => {
                if (activeBootstrapTranslationBaseRef.current !== bootstrapBase) {
                    return;
                }
                activeBootstrapTranslationBaseRef.current = null;
                if (useAppStore.getState().bootstrapBase === bootstrapBase) {
                    clearBootstrapBase();
                }
            });
    }, [bootstrapBase, clearBootstrapBase, fetchTranslationsIfNeeded, pathname]);
}
