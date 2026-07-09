import {
    MAX_CLIENT_ERROR_BREADCRUMBS,
} from '@/services/logging/clientErrors/constants';

const CLIENT_ERROR_RUNTIME_STATE_KEY = '__APP_CLIENT_ERROR_REPORTER__';

const runtimeState = (() => {
    if (!globalThis[CLIENT_ERROR_RUNTIME_STATE_KEY]) {
        globalThis[CLIENT_ERROR_RUNTIME_STATE_KEY] = {
            installed: false,
            currentRoute: '',
            breadcrumbs: [],
        };
    }

    return globalThis[CLIENT_ERROR_RUNTIME_STATE_KEY];
})();

export const claimClientErrorReporterInstall = () => {
    if (runtimeState.installed) {
        return false;
    }

    runtimeState.installed = true;
    return true;
};

export const appendClientErrorBreadcrumbEntry = (entry) => {
    runtimeState.breadcrumbs.push({
        time: entry.time,
        level: entry.level,
        tag: entry.tag,
        message: entry.message,
        payload: entry.payload,
    });

    if (runtimeState.breadcrumbs.length > MAX_CLIENT_ERROR_BREADCRUMBS) {
        runtimeState.breadcrumbs.splice(
            0,
            runtimeState.breadcrumbs.length - MAX_CLIENT_ERROR_BREADCRUMBS,
        );
    }
};

export const readClientErrorBreadcrumbs = () => {
    return runtimeState.breadcrumbs.slice(-MAX_CLIENT_ERROR_BREADCRUMBS);
};

export const setClientErrorCurrentRoute = (route) => {
    runtimeState.currentRoute = String(route ?? '');
};

export const readClientErrorCurrentRoute = () => {
    return runtimeState.currentRoute;
};
