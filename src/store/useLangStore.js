import { create } from 'zustand';
import { setLanguage, getLanguage, getRawLanguage, getLangCache, setLangCache } from '../utils/storage';
import { systemApi } from '../services/api';

/**
 * 语言状态管理 Store
 *
 * 用法：
 *   const { lang, t, switchLang } = useLangStore();
 *   t('当前状态')  // => 'Current Status'（当 lang 为 'en' 时）
 *   switchLang('zh'); // 切换语言并优先使用本地缓存
 */
const useLangStore = create((set, get) => ({
    // 当前语言，默认 'en'
    lang: 'en',

    // 翻译表 { '中文原文': '目标语言翻译', ... }
    translations: {},

    // 本地已缓存的翻译版本号
    languageVer: 0,

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
        set({ supportedLangs: newSupportedLangs });

        // 若本地从未保存过语言偏好，使用服务端 defaultLanguage
        const savedRaw = await getRawLanguage();
        let activeLang = await getLanguage();
        if (savedRaw === null && defaultLanguage) {
            await setLanguage(defaultLanguage);
            activeLang = defaultLanguage;
        }

        const { ver: languageVer, translations } = await getLangCache(activeLang, true);
        set({ lang: activeLang, languageVer, translations });

        if (serverVer > languageVer) {
            try {
                const res = await systemApi.getTranslations();
                const t = res?.data?.language || {};
                const newVer = res?.data?.language_ver ?? serverVer;
                await setLangCache(activeLang, newVer, t);
                if (get().lang === activeLang) {
                    set({ translations: t, languageVer: newVer });
                }
            } catch (e) {
                console.warn('[LangStore] fetchTranslations 失败，继续使用本地缓存', e);
            }
        }
    },

    /** 手动切换语言，优先使用本地缓存，仅在本地无缓存时首次拉取 */
    switchLang: async (lang) => {
        const { ver, translations } = await getLangCache(lang);
        await setLanguage(lang);
        set({ lang, translations, languageVer: ver });

        if (ver > 0 || Object.keys(translations).length > 0) {
            return;
        }

        try {
            const res = await systemApi.getTranslations();
            const t = res?.data?.language || {};
            const newVer = res?.data?.language_ver ?? 0;
            await setLangCache(lang, newVer, t);
            set({ translations: t, languageVer: newVer });
        } catch (e) {
            console.warn('[LangStore] switchLang 本地无缓存且拉取失败', e);
        }
    },

    /**
     * 翻译函数
     * - 无对应翻译时回退返回 key
     */
    t: (key) => {
        const { translations } = get();
        return translations[key] ?? key;
    },
}));

export default useLangStore;
