import { useState, useEffect, useCallback } from 'react';

/**
 * 通用数据请求 Hook
 * @param {Function} apiFn - 请求函数（返回 Promise）
 * @param {Object} options
 * @param {boolean} options.immediate - 是否立即执行，默认 true
 * @param {any} options.defaultData - 默认数据
 *
 * @example
 * const { data, loading, error, run } = useRequest(loadResource);
 */
const useRequest = (apiFn, options = {}) => {
    const { immediate = true, defaultData = null } = options;

    const [data, setData] = useState(defaultData);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const run = useCallback(
        async (...args) => {
            setLoading(true);
            setError(null);
            try {
                const result = await apiFn(...args);
                setData(result);
                return result;
            } catch (err) {
                setError(err);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [apiFn]
    );

    useEffect(() => {
        if (immediate) {
            run();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { data, loading, error, run };
};

export default useRequest;
