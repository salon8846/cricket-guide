import { create } from 'zustand';
import { setLanguage, getLanguage } from '../utils/storage';

/**
 * 语言状态管理 Store
 *
 * 用法：
 *   const { lang, switchLang } = useLangStore();
 *   switchLang('zh'); // 切换为中文，下次请求自动带 Accept-Language: zh
 */
const useLangStore = create((set) => ({
    // 当前语言，默认 'en'
    lang: 'en',

    /** App 启动时从本地恢复语言设置 */
    initLang: async () => {
        const saved = await getLanguage();
        set({ lang: saved });
    },

    /** 切换语言并持久化 */
    switchLang: async (lang) => {
        await setLanguage(lang);
        set({ lang });
    },
}));

export default useLangStore;
