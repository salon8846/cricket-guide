import { useEffect } from 'react';
import useAppStore from '@/store/useAppStore';
import useLangStore from '@/store/useLangStore';
import { createLogger } from '@/utils/logger';

const logger = createLogger('BootstrapTranslations');

/**
 * 启动页只缓存 init 的基础信息，真正进入业务页后再按版本补拉语言
 * - 只在 bootstrapBase 存在时触发一次，随后会 clearBootstrapBase
 */
export default function useBootstrapTranslations(enabled = true) {
    const bootstrapBase = useAppStore((state) => state.bootstrapBase);
    const clearBootstrapBase = useAppStore((state) => state.clearBootstrapBase);
    const fetchTranslationsIfNeeded = useLangStore((state) => state.fetchTranslationsIfNeeded);

    useEffect(() => {
        if (!enabled || !bootstrapBase) {
            return;
        }

        const { languageVer, language, defaultLanguage } = bootstrapBase;
        fetchTranslationsIfNeeded(languageVer ?? 0, language ?? {}, defaultLanguage)
            .catch((error) => {
                logger.warn('fetch bootstrap translations failed', { error });
            })
            .finally(() => {
                clearBootstrapBase();
            });
    }, [bootstrapBase, clearBootstrapBase, enabled, fetchTranslationsIfNeeded]);
}
