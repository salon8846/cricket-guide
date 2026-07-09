export const APP_STORAGE_KEYS = {
    identity: {
        installId: 'app.identity.installId',
        installTime: 'app.identity.installTime',
    },
    userSession: {
        token: 'app.userSession.token',
        userInfo: 'app.userSession.userInfo',
    },
    language: {
        current: 'app.language.current',
        version: 'app.language.version',
        translations: 'app.language.translations',
        versionCache: 'app.language.versionCache',
        translationsCache: 'app.language.translationsCache',
    },
    attribution: {
        report: 'app.attribution.report',
    },
    appDebug: {
        enabled: 'app.debug.enabled',
        sessionId: 'app.debug.sessionId',
        floatingButtonPosition: 'app.debug.floatingButtonPosition',
    },
    openUrl: {
        jumped: 'app.openUrl.jumped',
        deferredJump: 'app.openUrl.deferredJump',
        clipboardContentCache: 'app.openUrl.clipboardContentCache',
        clipboardConfigCache: 'app.openUrl.clipboardConfigCache',
        attributionDeepLinkParamsCache: 'app.openUrl.attributionDeepLinkParamsCache',
        attributionClipboardFallbackPending: 'app.openUrl.attributionClipboardFallbackPending',
    },
    internalEntry: {
        stickyB: 'app.internalEntry.stickyB',
    },
    stat: {
        installed: 'app.stat.installed',
    },
};
