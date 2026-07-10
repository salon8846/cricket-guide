import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { APP_CONFIG } from '@/constants/config';
import { readInstallId } from '@/services/installIdentity';
import {
    MAX_CLIENT_ERROR_REPORT_BYTES,
} from '@/services/logging/clientErrors/constants';
import {
    readClientErrorCurrentRoute,
} from '@/services/logging/clientErrors/runtime';
import { readBreadcrumbs } from '@/services/logging/breadcrumbs';
import {
    normalizeLogError,
    sanitizeLogValue,
} from '@/services/logging/redaction/logEntries';
import { createUuidV4 } from '@/utils/uuid';

const readErrorMessage = (error) => {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    return 'Non-error exception';
};

export const fitClientErrorReportSize = (report) => {
    const serializedReport = JSON.stringify(report);
    if (serializedReport.length <= MAX_CLIENT_ERROR_REPORT_BYTES) {
        return report;
    }

    const nextReport = {
        ...report,
        stack: String(report.stack ?? '').slice(0, 8000),
        breadcrumbs: report.breadcrumbs.slice(-20),
        extra: {
            truncated: true,
        },
    };

    const nextSerializedReport = JSON.stringify(nextReport);
    if (nextSerializedReport.length <= MAX_CLIENT_ERROR_REPORT_BYTES) {
        return nextReport;
    }

    return {
        ...nextReport,
        message: String(nextReport.message ?? '').slice(0, 1000),
        stack: String(nextReport.stack ?? '').slice(0, 4000),
        breadcrumbs: [],
    };
};

export const buildClientErrorReport = async (error, context = {}) => {
    const normalizedError = error instanceof Error
        ? normalizeLogError(error)
        : sanitizeLogValue(error);
    const errorObject = normalizedError && typeof normalizedError === 'object' && !Array.isArray(normalizedError)
        ? normalizedError
        : {};

    return {
        reportId: createUuidV4(),
        installId: await readInstallId(),
        occurredAt: new Date().toISOString(),
        appName: APP_CONFIG.name ?? '',
        appVersion: APP_CONFIG.version ?? '',
        platform: Platform.OS,
        systemVersion: `${Device.osName ?? ''} ${Device.osVersion ?? ''}`.trim(),
        deviceModel: Device.modelName ?? '',
        errorName: String(errorObject.name ?? error?.name ?? 'Error'),
        message: String(errorObject.message ?? readErrorMessage(error)),
        stack: String(errorObject.stack ?? error?.stack ?? ''),
        source: String(context.source ?? 'manual'),
        route: String(context.route ?? readClientErrorCurrentRoute() ?? ''),
        breadcrumbs: readBreadcrumbs(),
        extra: sanitizeLogValue(context.extra ?? {}),
    };
};

export const normalizeNativeCrashReport = async (report) => {
    return fitClientErrorReportSize({
        reportId: String(report.reportId ?? createUuidV4()),
        installId: await readInstallId(),
        occurredAt: String(report.occurredAt ?? new Date().toISOString()),
        appName: APP_CONFIG.name ?? '',
        appVersion: String(report.appVersion ?? APP_CONFIG.version ?? ''),
        platform: String(report.platform ?? Platform.OS),
        systemVersion: String(report.systemVersion ?? ''),
        deviceModel: String(report.deviceModel ?? ''),
        errorName: String(report.errorName ?? 'NativeCrash'),
        message: String(report.message ?? ''),
        stack: String(report.stack ?? ''),
        source: String(report.source ?? 'native_crash'),
        route: '',
        breadcrumbs: [],
        extra: sanitizeLogValue({
            nativeBuildVersion: report.nativeBuildVersion,
            thread: report.thread,
            raw: report,
        }),
    });
};

export const mergeClientErrorReportsById = (reports) => {
    const reportMap = new Map();
    reports.forEach((report) => {
        const reportId = String(report?.reportId ?? '');
        if (!reportId || reportMap.has(reportId)) {
            return;
        }
        reportMap.set(reportId, report);
    });
    return Array.from(reportMap.values());
};
