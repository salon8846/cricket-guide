import { systemApi } from '@/services/api';
import {
    cacheAttributionDeepLinkParamsForJump,
    cacheOpenUrlRuleConfigForJump,
    cacheOpenUrlClipboardContentForJump,
    clearAttributionClipboardFallbackPending,
    getJumpFlag,
    isSupportedLinkType,
    saveDeferredJump,
    setJumpFlag,
} from '@/services/openUrlJump';
import { createDebugLogger } from '@/utils/logger';
import { getInstallTime } from '@/utils/storage';
import { isEmpty } from '@/utils';
import {
    createInternalEntryAction,
    createOpenUrlJumpAction,
} from '@/services/bootstrap/actions';

const logger = createDebugLogger('DeferredJump');

const createInternalAction = (abTest, reason) => createInternalEntryAction({
    abTest: abTest ?? null,
    reason,
});

const createJumpAction = ({ linkType, targetUrl, abTest, attributionDeepLinkParams }) => createOpenUrlJumpAction({
    linkType,
    targetUrl,
    abTest: abTest ?? null,
    attributionDeepLinkParams,
});

export const resolveOpenUrlDecision = async ({
    openUrlRes,
    base,
    clipboardContent,
    attributionDeepLinkParams,
}) => {
    const data = openUrlRes?.data;
    if (isEmpty(data)) {
        logger.info('handleOpenUrl: empty data');
        return createInternalAction(null, 'empty_open_url_data');
    }

    const {
        fingerprint,
        isOpen,
        linkType,
        targetUrl,
        abTest,
        clipboardConfig: openUrlRuleConfig,
    } = data;
    const jumped = await getJumpFlag();
    const cacheOpenUrlJumpRequestState = async (nextLinkType, nextTargetUrl) => {
        await cacheOpenUrlClipboardContentForJump({
            readClipboard: base.readClipboard,
            clipboardContent,
            isOpen,
            linkType: nextLinkType,
            targetUrl: nextTargetUrl,
        });
        await cacheOpenUrlRuleConfigForJump({
            openUrlRuleConfig,
            isOpen,
            linkType: nextLinkType,
            targetUrl: nextTargetUrl,
        });
        const attributionDeepLinkValue = String(attributionDeepLinkParams?.linkValue ?? '');
        await cacheAttributionDeepLinkParamsForJump({
            attributionDeepLinkParams: attributionDeepLinkValue === clipboardContent ? attributionDeepLinkParams : null,
            isOpen,
            linkType: nextLinkType,
            targetUrl: nextTargetUrl,
        });
    };

    if (isEmpty(targetUrl) && jumped === '1') {
        logger.info('handleOpenUrl: jumped=1 but empty targetUrl', { isOpen, linkType });
        return createInternalAction(abTest, 'jumped_empty_target');
    }

    if (jumped === '1') {
        const jumpedLinkType = String(linkType ?? '');
        if (!isSupportedLinkType(jumpedLinkType)) {
            logger.info('handleOpenUrl: jumped=1 but invalid linkType', { linkType });
            return createInternalAction(abTest, 'jumped_invalid_link_type');
        }

        // 本地已有命中标记时，只要返回 targetUrl 就直接分流
        logger.info('handleOpenUrl: jumped=1, jump now', { linkType: jumpedLinkType, targetUrl });
        await clearAttributionClipboardFallbackPending();
        await cacheOpenUrlJumpRequestState(jumpedLinkType, targetUrl);
        return createJumpAction({
            linkType: jumpedLinkType,
            targetUrl,
            abTest,
            attributionDeepLinkParams,
        });
    }

    const checkTimeSeconds = Number(base.checkTime ?? 0);
    const normalizedLinkType = String(linkType ?? '');
    const canJump = isSupportedLinkType(normalizedLinkType);

    // 静默计时：只要 init 配置了 checkTime 就开启；到点后由根 layout 再请求一次 getOpenUrl，并按最新 isOpen 判断是否跳转
    if (Number.isFinite(checkTimeSeconds) && checkTimeSeconds > 0) {
        const installTimeSeconds = await getInstallTime();
        const triggerAtMs = (Math.floor(installTimeSeconds) + Math.floor(checkTimeSeconds)) * 1000;
        const remainingMs = triggerAtMs - Date.now();
        logger.info('silent decision', {
            installTimeSeconds,
            checkTimeSeconds,
            nowMs: Date.now(),
            triggerAtMs,
            remainingMs,
            isOpen,
            linkType: normalizedLinkType,
        });

        if (remainingMs > 0) {
            await saveDeferredJump({
                triggerAtMs,
                linkType: normalizedLinkType,
                targetUrl,
                fingerprint: fingerprint ?? '',
                abTest,
                readClipboard: base.readClipboard,
            });
            logger.info('saved deferred jump', { triggerAtMs, linkType: normalizedLinkType, targetUrl });
            return createInternalAction(abTest, 'deferred_saved');
        }

        if (isOpen !== '1') {
            logger.info('silent decision: time reached but isOpen!=1, no jump', { isOpen, linkType: normalizedLinkType });
            return createInternalAction(abTest, 'deferred_is_open_disabled');
        }

        if (isEmpty(targetUrl)) {
            logger.info('silent decision: time reached but empty targetUrl', { isOpen, linkType: normalizedLinkType });
            return createInternalAction(abTest, 'deferred_empty_target');
        }

        if (!canJump) {
            logger.info('silent decision: time reached but invalid linkType, no jump', { linkType });
            return createInternalAction(abTest, 'deferred_invalid_link_type');
        }

        // 已到触发时间，直接执行跳转
        if (fingerprint) {
            systemApi.fingerprintDelete(fingerprint).catch(() => { });
        }
        await setJumpFlag();
        await clearAttributionClipboardFallbackPending();
        await cacheOpenUrlJumpRequestState(normalizedLinkType, targetUrl);
        logger.info('silent decision: time reached, jump now', { linkType: normalizedLinkType, targetUrl });
        return createJumpAction({
            linkType: normalizedLinkType,
            targetUrl,
            abTest,
            attributionDeepLinkParams,
        });
    }

    if (isOpen !== '1') {
        logger.info('handleOpenUrl: isOpen!=1, no jump', {
            isOpen,
            linkType,
            checkTimeSeconds,
        });
        return createInternalAction(abTest, 'is_open_disabled');
    }

    if (isEmpty(targetUrl)) {
        logger.info('handleOpenUrl: empty targetUrl', { isOpen, linkType, checkTimeSeconds });
        return createInternalAction(abTest, 'empty_target');
    }

    // 非静默：isOpen 已确认开启，checkTime <= 0 时立即跳转
    if (Number.isFinite(checkTimeSeconds) && checkTimeSeconds <= 0) {
        if (!canJump) {
            logger.info('handleOpenUrl: checkTime<=0 but invalid linkType, no jump', { linkType });
            return createInternalAction(abTest, 'invalid_link_type');
        }

        if (fingerprint) {
            systemApi.fingerprintDelete(fingerprint).catch(() => { });
        }
        await setJumpFlag();
        await clearAttributionClipboardFallbackPending();
        await cacheOpenUrlJumpRequestState(normalizedLinkType, targetUrl);
        logger.info('handleOpenUrl: checkTime<=0 immediate, jump now', { linkType: normalizedLinkType, targetUrl });
        return createJumpAction({
            linkType: normalizedLinkType,
            targetUrl,
            abTest,
            attributionDeepLinkParams,
        });
    }

    logger.info('handleOpenUrl: no jump', { isOpen, linkType, checkTimeSeconds });
    return createInternalAction(abTest, 'no_jump');
};
