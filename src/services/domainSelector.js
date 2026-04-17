import { PROD_DOMAINS, HEALTH_PATH, REQUEST_TIMEOUT, IsDev, API_BASE_URL } from '@/constants/config';

let _activeBaseURL = IsDev ? API_BASE_URL : `${PROD_DOMAINS[0]}/api`;
let _initialized = false;
let _initPromise = null;

async function checkDomain(domain) {
    const url = `${domain}${HEALTH_PATH}`;
    const timeout = Math.min(REQUEST_TIMEOUT, 3000); // health check 最多等 3s
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, { method: 'GET', signal: controller.signal });
        clearTimeout(timer);
        // HTTP 状态 2xx 即视为健康，不校验响应体（避免因格式不同误判）
        return res.ok;
    } catch {
        clearTimeout(timer);
        return false;
    }
}

async function detectDomain() {
    for (const domain of PROD_DOMAINS) {
        const isAvailable = await checkDomain(domain);
        if (isAvailable) {
            if (__DEV__) console.log(`[DomainSelector] ✅ 可用域名: ${domain}`);
            return domain;
        }
        if (__DEV__) console.warn(`[DomainSelector] ❌ 不可用: ${domain}`);
    }

    return null;
}

/**
 * 初始化域名选择器（App 启动时调用一次）
 * 支持幂等：重复调用只执行一次
 */
export async function initDomain() {
    // 开发环境：直接用配置地址，跳过所有 health check
    if (IsDev) {
        _activeBaseURL = API_BASE_URL;
        _initialized = true;
        console.log(`[DomainSelector] 🛠 Dev 模式，使用: ${_activeBaseURL}`);
        return _activeBaseURL;
    }

    if (_initialized) return _activeBaseURL;
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
        try {
            const domain = await detectDomain();
            if (domain) {
                _activeBaseURL = `${domain}/api`;
            } else {
                // 全部失败，使用优先级最高（第一个）域名兜底
                if (__DEV__) console.warn('[DomainSelector] ⚠️ 所有域名不可达，使用兜底:', PROD_DOMAINS[0]);
                _activeBaseURL = `${PROD_DOMAINS[0]}/api`;
            }
        } catch (e) {
            if (__DEV__) console.error('[DomainSelector] 检测异常:', e);
        } finally {
            _initialized = true;
            _initPromise = null;
        }
        return _activeBaseURL;
    })();

    return _initPromise;
}

export function getActiveBaseURL() {
    return _activeBaseURL;
}

/**
 * 重置域名选择器（仅测试 / 手动重试用）
 */
export function resetDomainSelector() {
    _initialized = false;
    _initPromise = null;
    _activeBaseURL = IsDev ? API_BASE_URL : `${PROD_DOMAINS[0]}/api`;
}
