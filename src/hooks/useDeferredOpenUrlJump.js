import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { systemApi } from '../services/api';
import {
    OPEN_URL_DEBUG_TAG,
    clearDeferredJump,
    devLog,
    devWarn,
    getJumpFlag,
    jumpByLinkType,
    readDeferredJump,
    setJumpFlag,
} from '../services/openUrlJump';

const MAX_TIMEOUT_MS = 2147483647;

/**
 * 静默跳转到点检测
 *
 * 说明：
 * - 这里不负责“是否需要静默跳转”的决策，决策由启动页 `src/app/index.jsx` 的首次 getOpenUrl 完成。
 * - 这里仅负责读取 `OPEN_URL_DEFERRED_JUMP`，并在到点后执行跳转（以及相关副作用）。
 *
 * 为什么要有 enabled：
 * - 这个检测不应该在 `/`(启动页) 或 `/webview` 内运行，避免打断启动链路或导致 webview 重载。
 */
export default function useDeferredOpenUrlJump(router, enabled = true) {
    const deferredTimerRef = useRef(null);

    useEffect(() => {
        if (!router || !enabled) {
            return () => { };
        }

        let canceled = false;
        devLog(OPEN_URL_DEBUG_TAG, 'deferred: enabled');
        // 注意：JS timer 在后台可能会被系统挂起，因此同时监听 AppState active 进行复核。

        const clearTimer = () => {
            if (deferredTimerRef.current) {
                clearTimeout(deferredTimerRef.current);
                deferredTimerRef.current = null;
            }
        };

        const runDeferredJump = async () => {
            const jumped = await getJumpFlag();
            if (jumped === '1') {
                await clearDeferredJump();
                devLog(OPEN_URL_DEBUG_TAG, 'deferred: jumped=1, cleared deferred');
                return;
            }

            const deferred = await readDeferredJump();
            if (!deferred) {
                devLog(OPEN_URL_DEBUG_TAG, 'deferred: none');
                return;
            }

            const { triggerAtMs, linkType, targetUrl, fingerprint } = deferred;

            const remaining = triggerAtMs - Date.now();
            devLog(OPEN_URL_DEBUG_TAG, 'deferred: check', {
                nowMs: Date.now(),
                triggerAtMs,
                remainingMs: remaining,
                linkType,
            });

            if (remaining <= 0) {
                if (fingerprint) {
                    systemApi.fingerprintDelete(fingerprint).catch(() => { });
                }
                await setJumpFlag();
                await clearDeferredJump();
                devLog(OPEN_URL_DEBUG_TAG, 'deferred: triggered, jump now', { linkType, targetUrl });
                await jumpByLinkType({ router, linkType, targetUrl });
                return;
            }

            clearTimer();
            const delay = Math.min(remaining, MAX_TIMEOUT_MS);
            devLog(OPEN_URL_DEBUG_TAG, 'deferred: scheduled', { delayMs: delay });
            deferredTimerRef.current = setTimeout(() => {
                if (canceled) {
                    return;
                }
                runDeferredJump().catch((e) => devWarn(OPEN_URL_DEBUG_TAG, 'deferred: trigger failed', e));
            }, delay);
        };

        const appStateListener = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                devLog(OPEN_URL_DEBUG_TAG, 'deferred: AppState active, re-check');
                runDeferredJump().catch((e) => devWarn(OPEN_URL_DEBUG_TAG, 'deferred: active check failed', e));
            }
        });

        runDeferredJump().catch((e) => devWarn(OPEN_URL_DEBUG_TAG, 'deferred: init failed', e));

        return () => {
            canceled = true;
            clearTimer();
            appStateListener.remove();
            devLog(OPEN_URL_DEBUG_TAG, 'deferred: disabled');
        };
    }, [enabled, router]);
}
