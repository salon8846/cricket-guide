/**
 * 通用工具函数
 */

/**
 * 格式化日期
 * @param {Date | string | number} date
 * @param {string} format 默认 'YYYY-MM-DD'
 */
export const formatDate = (date, format = 'YYYY-MM-DD') => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const map = {
        YYYY: d.getFullYear(),
        MM: String(d.getMonth() + 1).padStart(2, '0'),
        DD: String(d.getDate()).padStart(2, '0'),
        HH: String(d.getHours()).padStart(2, '0'),
        mm: String(d.getMinutes()).padStart(2, '0'),
        ss: String(d.getSeconds()).padStart(2, '0'),
    };
    return format.replace(/YYYY|MM|DD|HH|mm|ss/g, (key) => map[key]);
};

/**
 * 防抖函数
 * @param {Function} fn
 * @param {number} delay 毫秒，默认 300
 */
export const debounce = (fn, delay = 300) => {
    let timer = null;
    return (...args) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            fn(...args);
            timer = null;
        }, delay);
    };
};

/**
 * 节流函数
 * @param {Function} fn
 * @param {number} interval 毫秒，默认 300
 */
export const throttle = (fn, interval = 300) => {
    let lastTime = 0;
    return (...args) => {
        const now = Date.now();
        if (now - lastTime >= interval) {
            lastTime = now;
            fn(...args);
        }
    };
};

/**
 * 深拷贝（简单版）
 */
export const deepClone = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    return JSON.parse(JSON.stringify(obj));
};

/**
 * 截断文本
 * @param {string} text
 * @param {number} maxLength
 */
export const truncate = (text, maxLength = 50) => {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
};

/**
 * 手机号脱敏
 * @param {string} phone
 */
export const maskPhone = (phone) => {
    if (!phone || phone.length < 7) return phone;
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};

/**
 * 检查是否为空（null / undefined / '' / [] / {}）
 */
export const isEmpty = (value) => {
    if (value === null || value === undefined || value === '') return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
};
