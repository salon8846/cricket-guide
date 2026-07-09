import { APP_STORAGE_KEYS } from '@/constants/storageKeys';
import { clearLogDirectory, createJsonlQueueFile, createRotatingJsonlFile } from '@/services/logging/jsonlFiles';
import {
    CLIENT_ERRORS_LOG_DIRECTORY,
    MAX_PENDING_CLIENT_ERRORS,
    NATIVE_CRASHES_LOG_DIRECTORY,
} from '@/services/logging/clientErrors/constants';
import {
    fitClientErrorReportSize,
    mergeClientErrorReportsById,
    normalizeNativeCrashReport,
} from '@/services/logging/clientErrors/reports';
import { removeItemOrThrow } from '@/utils/storage';

const pendingClientErrorFile = createJsonlQueueFile({
    directoryName: CLIENT_ERRORS_LOG_DIRECTORY,
    fileName: 'pending.jsonl',
    maxEntries: MAX_PENDING_CLIENT_ERRORS,
});

const clientErrorHistoryFile = createRotatingJsonlFile({
    directoryName: CLIENT_ERRORS_LOG_DIRECTORY,
    fileName: 'history.log',
    maxBytes: 256 * 1024,
    rotatedFiles: 2,
});

const pendingNativeCrashFile = createJsonlQueueFile({
    directoryName: NATIVE_CRASHES_LOG_DIRECTORY,
    fileName: 'pending.jsonl',
    maxEntries: MAX_PENDING_CLIENT_ERRORS,
});

export const saveClientErrorReport = async (report) => {
    const nextReport = fitClientErrorReportSize(report);
    await pendingClientErrorFile.append(nextReport);
    await clientErrorHistoryFile.append(nextReport);
    return nextReport;
};

const readNativeCrashReports = async () => {
    const reports = await pendingNativeCrashFile.readEntries();
    return await Promise.all(reports.map(normalizeNativeCrashReport));
};

export const readPendingClientErrors = () => {
    return Promise.all([
        pendingClientErrorFile.readEntries(),
        readNativeCrashReports(),
    ]).then(([jsReports, nativeReports]) => mergeClientErrorReportsById([...jsReports, ...nativeReports]));
};

export const readClientErrorHistoryEntries = async (limit = 100) => {
    const [historyReports, nativeReports] = await Promise.all([
        clientErrorHistoryFile.readEntries(limit),
        readNativeCrashReports(),
    ]);
    return mergeClientErrorReportsById([...nativeReports, ...historyReports]).slice(-limit);
};

export const clearClientErrorLogs = async () => {
    await Promise.all([
        clearLogDirectory(CLIENT_ERRORS_LOG_DIRECTORY),
        clearLogDirectory(NATIVE_CRASHES_LOG_DIRECTORY),
        removeItemOrThrow(APP_STORAGE_KEYS.clientError.uploadState),
    ]);
};

export const readPendingClientErrorFlushBatch = async () => {
    const [jsReports, nativeReports] = await Promise.all([
        pendingClientErrorFile.readEntries(),
        readNativeCrashReports(),
    ]);

    return {
        reports: mergeClientErrorReportsById([...jsReports, ...nativeReports]),
        nativeReports,
    };
};

export const appendNativeCrashReportsToHistory = async (reports) => {
    await Promise.all(reports.map((report) => clientErrorHistoryFile.append(report)));
};

export const clearPendingClientErrorFiles = async () => {
    await Promise.all([
        pendingClientErrorFile.clear(),
        pendingNativeCrashFile.clear(),
    ]);
};
