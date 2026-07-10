import { getCurrentDebugLogSessionId } from '@/services/logging/debugLogs/sessions';

export function formatDebugLogSessionLabel(session) {
    return session.id === getCurrentDebugLogSessionId() ? 'Current Launch' : session.id.slice(0, 14);
}

export function formatDebugLogEntry(entry) {
    const prefix = [
        entry.time,
        String(entry.level ?? '').toUpperCase(),
        entry.tag ? `[${entry.tag}]` : '',
    ].filter(Boolean).join(' ');
    const payload = entry.payload === undefined ? '' : ` ${JSON.stringify(entry.payload)}`;
    return `${prefix} ${entry.message ?? ''}${payload}`;
}

export function formatClientErrorEntry(entry) {
    const prefix = [
        entry.occurredAt,
        entry.source,
        entry.route,
    ].filter(Boolean).join(' ');
    return `${prefix}\n${entry.errorName ?? 'Error'}: ${entry.message ?? ''}\n# ${entry.reportId ?? ''}`;
}

export function formatClientErrorDetail(entry) {
    return [
        formatClientErrorEntry(entry),
        '',
        `App: ${entry.appName ?? ''} ${entry.appVersion ?? ''}`.trim(),
        `Platform: ${entry.platform ?? ''} ${entry.systemVersion ?? ''}`.trim(),
        `Device: ${entry.deviceModel ?? ''}`.trim(),
        '',
        'Stack:',
        entry.stack ?? '',
        '',
        'Breadcrumbs:',
        JSON.stringify(entry.breadcrumbs ?? [], null, 2),
        '',
        'Extra:',
        JSON.stringify(entry.extra ?? {}, null, 2),
    ].join('\n');
}

export function formatClientErrorBreadcrumb(breadcrumb) {
    const prefix = [
        breadcrumb.time,
        String(breadcrumb.level ?? '').toUpperCase(),
        breadcrumb.category ? `[${breadcrumb.category}]` : '',
        breadcrumb.name,
    ].filter(Boolean).join(' ');
    const data = breadcrumb.data === undefined ? '' : ` ${JSON.stringify(breadcrumb.data)}`;
    return `${prefix}${data}`;
}
