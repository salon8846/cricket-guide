import { systemApi } from '@/services/api';
import {
    appendNativeCrashReportsToHistory,
    clearPendingClientErrorFiles,
    readPendingClientErrorFlushBatch,
} from '@/services/logging/clientErrors/clientErrorFiles';
import { createLogger } from '@/utils/logger';

const logger = createLogger('ClientErrorUpload');

export const flushPendingClientErrors = async () => {
    const { reports, nativeReports } = await readPendingClientErrorFlushBatch();
    if (reports.length === 0) {
        return { sent: 0, hasPending: false };
    }

    await systemApi.clientError({ reports });
    await appendNativeCrashReportsToHistory(nativeReports).catch((error) => {
        logger.warn('native error history append failed', { error });
    });
    await clearPendingClientErrorFiles();
    logger.info('client errors flushed', { count: reports.length });
    return { sent: reports.length, hasPending: true };
};
