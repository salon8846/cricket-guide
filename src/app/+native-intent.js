import Constants from 'expo-constants';

const IOS_APP_LINK_DOMAIN_PREFIX = 'applinks:';
const ROUTE_WILDCARD_SUFFIX = '/*';
const ALLOWED_EXTERNAL_ROUTE_PATTERNS = [
    'auth/*',
];

const getConfiguredScheme = () => {
    const scheme = Constants.expoConfig?.scheme;
    return Array.isArray(scheme) ? scheme[0] : scheme;
};

const normalizeUrlPart = (value) => {
    return String(value ?? '').trim().toLowerCase();
};

const createHttpsLinkHostPattern = (host) => {
    const normalizedHost = normalizeUrlPart(host);

    return {
        host: normalizedHost.startsWith('*.') ? normalizedHost.slice(2) : normalizedHost,
        includesSubdomains: normalizedHost.startsWith('*.'),
    };
};

const getIosUniversalLinkHostPatterns = () => {
    const associatedDomains = Constants.expoConfig?.ios?.associatedDomains;
    if (!Array.isArray(associatedDomains)) {
        return [];
    }

    return associatedDomains
        .map((domain) => String(domain ?? '').trim())
        .filter((domain) => domain.startsWith(IOS_APP_LINK_DOMAIN_PREFIX))
        .map((domain) => createHttpsLinkHostPattern(domain.slice(IOS_APP_LINK_DOMAIN_PREFIX.length).split('?')[0]))
        .filter((domain) => domain.host);
};

const getAndroidAppLinkHostPatterns = () => {
    const intentFilters = Constants.expoConfig?.android?.intentFilters;
    if (!Array.isArray(intentFilters)) {
        return [];
    }

    return intentFilters.flatMap((intentFilter) => {
        const data = intentFilter?.data;
        const dataEntries = Array.isArray(data) ? data : [data];

        return dataEntries
            .filter((entry) => normalizeUrlPart(entry?.scheme) === 'https')
            .map((entry) => createHttpsLinkHostPattern(entry?.host))
            .filter((domain) => domain.host);
    });
};

const getConfiguredHttpsLinkHostPatterns = () => {
    return [
        ...getIosUniversalLinkHostPatterns(),
        ...getAndroidAppLinkHostPatterns(),
    ];
};

const matchesHttpsLinkHostPattern = (host, domain) => {
    if (domain.includesSubdomains) {
        return host.endsWith(`.${domain.host}`);
    }

    return host === domain.host;
};

const isConfiguredHttpsLinkHost = (hostname) => {
    const host = normalizeUrlPart(hostname);
    if (!host) {
        return false;
    }

    return getConfiguredHttpsLinkHostPatterns().some((domain) => matchesHttpsLinkHostPattern(host, domain));
};

const isConfiguredSchemeUrl = (url, scheme) => {
    return normalizeUrlPart(url.protocol).replace(/:$/, '') === normalizeUrlPart(scheme);
};

const isConfiguredHttpsLinkUrl = (url) => {
    return url.protocol === 'https:' && isConfiguredHttpsLinkHost(url.hostname);
};

const getIntentRoutePath = (url, scheme) => {
    const pathSegments = url.pathname.replace(/^\/+/, '').split('/').filter(Boolean);

    if (isConfiguredSchemeUrl(url, scheme) && url.hostname) {
        return [url.hostname, ...pathSegments].join('/').toLowerCase();
    }

    return pathSegments.join('/').toLowerCase();
};

const matchesExternalRoutePattern = (routePath, routePattern) => {
    if (routePattern.endsWith(ROUTE_WILDCARD_SUFFIX)) {
        const routePrefix = routePattern.slice(0, -1);
        return routePath.startsWith(routePrefix);
    }

    return routePath === routePattern;
};

const isAllowedExternalRoutePath = (routePath) => {
    return ALLOWED_EXTERNAL_ROUTE_PATTERNS.some((routePattern) => matchesExternalRoutePattern(routePath, routePattern));
};

export function redirectSystemPath({ path }) {
    const rawPath = String(path ?? '').trim();
    const scheme = getConfiguredScheme() || 'app';

    try {
        const url = rawPath.includes('://')
            ? new URL(rawPath)
            : new URL(rawPath, `${scheme}:///`);
        const routePath = getIntentRoutePath(url, scheme);

        if (routePath && !isAllowedExternalRoutePath(routePath) && (isConfiguredSchemeUrl(url, scheme) || isConfiguredHttpsLinkUrl(url))) {
            return '/';
        }

        return rawPath || '/';
    } catch {
        return '/';
    }
}
