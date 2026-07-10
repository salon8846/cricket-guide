import { getJumpFlag, readDeferredJump } from '@/services/openUrlJump';
import { recordBreadcrumb } from '@/services/logging/breadcrumbs';
import { createDebugLogger } from '@/utils/logger';
import { createInternalEntryAction } from '@/services/bootstrap/actions';
import { requestBootstrapOpenUrl } from '@/services/bootstrap/openUrlRequest';
import { resolveOpenUrlDecision } from '@/services/bootstrap/openUrlDecision';

const logger = createDebugLogger('DeferredJump');

const normalizeOpenUrlVerifyFlag = (jumpFlag) => {
    if (jumpFlag === null) {
        return '';
    }

    return String(jumpFlag);
};

const resolveDeferredJumpAction = async () => {
    const h5Verify = normalizeOpenUrlVerifyFlag(await getJumpFlag());
    if (h5Verify === '1') {
        return null;
    }

    // 已有静默计时任务时，不需要重复请求 getOpenUrl。
    const deferred = await readDeferredJump();
    if (!deferred) {
        return null;
    }

    logger.info('bootstrap: deferred exists, skip getOpenUrl and go internal', deferred);
    return createInternalEntryAction({
        abTest: deferred.abTest,
        reason: 'deferred_exists',
    });
};

const resolveOpenUrlAction = async ({ base, attributionConfig }) => {
    logger.info('bootstrap: api.getOpenUrl');
    const openUrlRequest = await requestBootstrapOpenUrl({ base, attributionConfig });
    const openUrlRes = openUrlRequest.openUrlRes;
    logger.info('bootstrap: api.getOpenUrl done', {
        hasData: !!openUrlRes?.data,
        isOpen: openUrlRes?.data?.isOpen,
        linkType: openUrlRes?.data?.linkType,
        hasTargetUrl: !!openUrlRes?.data?.targetUrl,
    });
    recordBreadcrumb({
        category: 'bootstrap',
        name: 'bootstrap.open_url_success',
        data: {
            hasData: !!openUrlRes?.data,
            isOpen: openUrlRes?.data?.isOpen,
            linkType: openUrlRes?.data?.linkType,
            hasTargetUrl: !!openUrlRes?.data?.targetUrl,
        },
    });

    return resolveOpenUrlDecision({
        openUrlRes,
        base,
        clipboardContent: openUrlRequest.clipboardContent,
        attributionDeepLinkParams: openUrlRequest.attributionDeepLinkParams,
    });
};

/**
 * 启动策略只在这里排序：每个客户端策略节点要么返回完整 action，要么返回 null 让下一个节点接管。
 */
export const resolveBootstrapAction = async ({ base, attributionConfig }) => {
    const deferredJumpAction = await resolveDeferredJumpAction();
    if (deferredJumpAction) {
        return deferredJumpAction;
    }

    return resolveOpenUrlAction({ base, attributionConfig });
};
