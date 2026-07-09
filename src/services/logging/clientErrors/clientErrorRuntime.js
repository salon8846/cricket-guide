import {
    MAX_CLIENT_ERROR_BREADCRUMBS,
} from '@/services/logging/clientErrors/clientErrorConstants';

const CLIENT_ERROR_RUNTIME_STATE_KEY = '__APP_CLIENT_ERROR_REPORTER__';

const clientErrorRuntimeState = (() => {
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
    if (clientErrorRuntimeState.installed) {
        return false;
    }

    clientErrorRuntimeState.installed = true;
    return true;
};

export const appendClientErrorBreadcrumbEntry = (entry) => {
    clientErrorRuntimeState.breadcrumbs.push({
        time: entry.time,
        level: entry.level,
        tag: entry.tag,
        message: entry.message,
        payload: entry.payload,
    });

    if (clientErrorRuntimeState.breadcrumbs.length > MAX_CLIENT_ERROR_BREADCRUMBS) {
        clientErrorRuntimeState.breadcrumbs.splice(
            0,
            clientErrorRuntimeState.breadcrumbs.length - MAX_CLIENT_ERROR_BREADCRUMBS,
        );
    }
};

export const readClientErrorBreadcrumbs = () => {
    return clientErrorRuntimeState.breadcrumbs.slice(-MAX_CLIENT_ERROR_BREADCRUMBS);
};

export const setClientErrorCurrentRoute = (route) => {
    clientErrorRuntimeState.currentRoute = String(route ?? '');
};

export const readClientErrorCurrentRoute = () => {
    return clientErrorRuntimeState.currentRoute;
};
