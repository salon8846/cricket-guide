import { create } from 'zustand';
import { setLanguage, getLanguage, getRawLanguage, setLangVer, getLangVer, setLangTranslations, getLangTranslations } from '../utils/storage';
import { systemApi } from '../services/api';

/**
 * 语言状态管理 Store
 *
 * 用法：
 *   const { lang, t, switchLang } = useLangStore();
 *   t('当前状态')  // => 'Current Status'（当 lang 为 'en' 时）
 *   switchLang('zh'); // 切换语言并重新拉取翻译
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
        const [lang, ver, translations] = await Promise.all([
            getLanguage(),
            getLangVer(),
            getLangTranslations(),
        ]);
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
        if (savedRaw === null && defaultLanguage) {
            await setLanguage(defaultLanguage);
            set({ lang: defaultLanguage });
        }

        const { languageVer } = get();
        if (serverVer > languageVer) {
            try {
                const res = await systemApi.getTranslations();
                const t = res?.data?.language || {};
                const newVer = res?.data?.language_ver ?? serverVer;
                await Promise.all([
                    setLangTranslations(t),
                    setLangVer(newVer),
                ]);
                set({ translations: t, languageVer: newVer });
            } catch (e) {
                console.warn('[LangStore] fetchTranslations 失败，继续使用本地缓存', e);
            }
        }
    },

    /** 手动切换语言并重新拉取翻译 */
    switchLang: async (lang) => {
        await setLanguage(lang);
        set({ lang, translations: {}, languageVer: 0 });
        // 语言切换后强制从服务端拉取新翻译（版本号传一个极大值触发更新）
        try {
            const res = await systemApi.getTranslations();
            const t = res?.data?.language || {};
            const newVer = res?.data?.language_ver ?? 0;
            await Promise.all([
                setLangTranslations(t),
                setLangVer(newVer),
            ]);
            set({ translations: t, languageVer: newVer });
        } catch (e) {
            console.warn('[LangStore] switchLang 拉取翻译失败', e);
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
