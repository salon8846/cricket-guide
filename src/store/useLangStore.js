import { create } from 'zustand';
import { setLanguage, getLanguage, getRawLanguage, getLangCache, removeItem, setLangCache } from '@/utils/storage';
import { systemApi } from '@/services/api';
import { STORAGE_KEYS } from '@/constants/config';
import { BUILTIN_LANGUAGE_VER, getBuiltInTranslations } from '@/constants/language';
import { createLogger } from '@/utils/logger';

const logger = createLogger('LangStore');

const hasTranslations = (translations) => Object.keys(translations || {}).length > 0;

const getBuiltInLangState = (lang) => ({
    languageVer: BUILTIN_LANGUAGE_VER,
    translations: getBuiltInTranslations(lang),
});

/**
 * 语言状态管理 Store
 *
 * 用法：
 *   const { lang, switchLang } = useLangStore();
 *   switchLang('zh'); // 切换语言，按语言版本决定使用内置包或远端缓存
 */
const useLangStore = create((set, get) => ({
    // 当前语言，默认 'en'
    lang: 'en',

    // 翻译表 { '中文原文': '目标语言翻译', ... }
    translations: {},

    // 本地已缓存的翻译版本号
    languageVer: 0,

    // init 接口返回的最新语言版本
    serverLanguageVer: 0,

    // 后端返回的支持语言列表 { en: 'English', zh: '简体中文' }
    supportedLangs: {},

    /** App 启动时从本地恢复语言设置、翻译表、版本号，返回是否有本地保存的语言 */
    initLang: async () => {
        const lang = await getLanguage();
        const { ver, translations } = await getLangCache(lang, true);
        set({ lang, languageVer: ver, translations });
    },

    /**
     * 按服务端版本号决定是否拉取新翻译
     * @param {number} serverVer      - init 接口返回的 languageVer
     * @param {object} supportedLangs - init 接口返回的 language { en: 'English', ... }
     * @param {string} defaultLanguage - init 接口返回的 defaultLanguage
     */
    fetchTranslationsIfNeeded: async (serverVer, supportedLangs, defaultLanguage) => {
        const newSupportedLangs = supportedLangs || {};
        const normalizedServerVer = Number(serverVer) > 0 ? Number(serverVer) : 0;
        set({ supportedLangs: newSupportedLangs, serverLanguageVer: normalizedServerVer });

        // 若本地从未保存过语言偏好，使用服务端 defaultLanguage
        const savedRaw = await getRawLanguage();
        let activeLang = await getLanguage();
        if (savedRaw === null && defaultLanguage) {
            await setLanguage(defaultLanguage);
            activeLang = defaultLanguage;
        }

        if (normalizedServerVer <= BUILTIN_LANGUAGE_VER) {
            const builtInState = getBuiltInLangState(activeLang);
            await setLangCache(activeLang, builtInState.languageVer, builtInState.translations);
            set({ lang: activeLang, ...builtInState });
            return;
        }

        const { ver: cachedVer, translations: cachedTranslations } = await getLangCache(activeLang, true);
        const builtInState = getBuiltInLangState(activeLang);
        const fallbackTranslations = hasTranslations(cachedTranslations)
            ? cachedTranslations
            : builtInState.translations;
        const fallbackVer = cachedVer > 0 ? cachedVer : builtInState.languageVer;

        if (cachedVer <= 0 && hasTranslations(builtInState.translations)) {
            await setLangCache(activeLang, builtInState.languageVer, builtInState.translations);
        }

        set({ lang: activeLang, languageVer: fallbackVer, translations: fallbackTranslations });

        if (normalizedServerVer > fallbackVer) {
            try {
                const res = await systemApi.getTranslations();
                const t = res?.data?.language || {};
                const newVer = res?.data?.language_ver ?? normalizedServerVer;
                await setLangCache(activeLang, newVer, t);
                if (get().lang === activeLang) {
                    set({ translations: t, languageVer: newVer });
                }
            } catch (e) {
                logger.warn('fetchTranslations failed, fallback cache used', {
                    lang: activeLang,
                    serverVer: normalizedServerVer,
                    fallbackVer,
                    error: e,
                });
            }
        }
    },

    /** 手动切换语言，低版本走内置包，高版本按缓存版本决定是否拉取 */
    switchLang: async (lang) => {
        const serverLanguageVer = get().serverLanguageVer;
        const { ver, translations } = await getLangCache(lang);
        const builtInState = getBuiltInLangState(lang);
        await setLanguage(lang);

        if (serverLanguageVer <= BUILTIN_LANGUAGE_VER) {
            await setLangCache(lang, builtInState.languageVer, builtInState.translations);
            set({ lang, ...builtInState });
            return;
        }

        const nextTranslations = hasTranslations(translations) ? translations : builtInState.translations;
        const nextVer = ver > 0 ? ver : builtInState.languageVer;

        if (ver <= 0 && hasTranslations(builtInState.translations)) {
            await setLangCache(lang, builtInState.languageVer, builtInState.translations);
        }

        set({ lang, translations: nextTranslations, languageVer: nextVer });

        if (serverLanguageVer <= nextVer) {
            return;
        }

        try {
            const res = await systemApi.getTranslations();
            const t = res?.data?.language || {};
            const newVer = res?.data?.language_ver ?? serverLanguageVer;
            await setLangCache(lang, newVer, t);
            set({ translations: t, languageVer: newVer });
        } catch (e) {
            logger.warn('switchLang fetch failed, fallback cache used', {
                lang,
                serverVer: serverLanguageVer,
                fallbackVer: nextVer,
                error: e,
            });
        }
    },

    /** 清除本地语言偏好和翻译缓存，并恢复到内置默认语言 */
    resetLang: async () => {
        await Promise.all([
            removeItem(STORAGE_KEYS.LANGUAGE),
            removeItem(STORAGE_KEYS.LANG_VER),
            removeItem(STORAGE_KEYS.LANG_TRANSLATIONS),
            removeItem(STORAGE_KEYS.LANG_VER_CACHE),
            removeItem(STORAGE_KEYS.LANG_TRANSLATIONS_CACHE),
        ]);
        set({
            lang: 'en',
            ...getBuiltInLangState('en'),
        });
    },

}));

export default useLangStore;
