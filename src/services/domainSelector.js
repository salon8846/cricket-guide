/**
 * domainSelector.js
 *
 * 多域名健康检测 + 自动 Failover
 *
 * 使用方式：
 *   1. App 启动时调用 initDomain()，之后 request.js 通过 getActiveBaseURL() 动态获取 baseURL
 *   2. 若所有域名都不可用，回退到 PROD_DOMAINS[0]（兜底）
 */

import { PROD_DOMAINS, HEALTH_PATH, REQUEST_TIMEOUT, IsDev, API_BASE_URL } from '../constants/config';

/** 当前可用的 base URL（含 /api 后缀）
 *  开发环境直接用 API_BASE_URL（localhost），生产环境由 health check 决定 */
let _activeBaseURL = IsDev ? API_BASE_URL : `${PROD_DOMAINS[0]}/api`;
/** 初始化是否已完成 */
let _initialized = false;
/** 初始化中的 Promise，避免并发重复初始化 */
let _initPromise = null;

/**
 * 对单个域名发起 health check，超时视为失败
 * @param {string} domain  示例: 'https://api.zuqiuhot2026.com'
 * @returns {Promise<boolean>}
 */
async function checkDomain(domain) {
    const url = `${domain}${HEALTH_PATH}`;
    const timeout = Math.min(REQUEST_TIMEOUT, 3000); // health check 最多等 5s
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

/**
 * 并发检测所有域名，按优先级返回第一个可用的
 * @returns {Promise<string|null>}  可用域名（无 /api 后缀），全部失败返回 null
 */
async function detectDomain() {
    // 为每个域名创建 { domain, promise }
    const checks = PROD_DOMAINS.map((domain) => ({
        domain,
        promise: checkDomain(domain),
    }));

    // 按优先级依次等待，若更高优先级的已 ok 则直接返回
    // 这里的策略：并发发起，但按顺序取第一个成功的
    const results = await Promise.allSettled(checks.map((c) => c.promise));

    for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'fulfilled' && results[i].value === true) {
            if (__DEV__) console.log(`[DomainSelector] ✅ 可用域名: ${checks[i].domain}`);
            return checks[i].domain;
        }
        if (__DEV__) console.warn(`[DomainSelector] ❌ 不可用: ${checks[i].domain}`);
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

/**
 * 获取当前激活的 base URL（供 request.js 动态读取）
 * @returns {string}  示例: 'https://api2.zuqiuhot2026.com/api'
 */
export function getActiveBaseURL() {
    return _activeBaseURL;
}

/**
 * 重置域名选择器（仅测试 / 手动重试用）
 */
export function resetDomainSelector() {
    _initialized = false;
    _initPromise = null;
    _activeBaseURL = `${PROD_DOMAINS[0]}/api`;
}
