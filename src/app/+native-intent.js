import Constants from 'expo-constants';

const ASSOCIATED_DOMAIN_PREFIX = 'applinks:';
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

const getAssociatedDomainPatterns = () => {
    const associatedDomains = Constants.expoConfig?.ios?.associatedDomains;
    if (!Array.isArray(associatedDomains)) {
        return [];
    }

    return associatedDomains
        .map((domain) => String(domain ?? '').trim())
        .filter((domain) => domain.startsWith(ASSOCIATED_DOMAIN_PREFIX))
        .map((domain) => {
            const host = domain
                .slice(ASSOCIATED_DOMAIN_PREFIX.length)
                .split('?')[0]
                .toLowerCase();

            return {
                host: host.startsWith('*.') ? host.slice(2) : host,
                includesSubdomains: host.startsWith('*.'),
            };
        })
        .filter((domain) => domain.host);
};

const isAssociatedDomainHost = (hostname) => {
    const host = normalizeUrlPart(hostname);
    if (!host) {
        return false;
    }

    return getAssociatedDomainPatterns().some((domain) => {
        if (domain.includesSubdomains) {
            return host.endsWith(`.${domain.host}`);
        }

        return host === domain.host;
    });
};

const isConfiguredSchemeUrl = (url, scheme) => {
    return normalizeUrlPart(url.protocol).replace(/:$/, '') === normalizeUrlPart(scheme);
};

const isAssociatedDomainUrl = (url) => {
    return url.protocol === 'https:' && isAssociatedDomainHost(url.hostname);
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

        if (routePath && !isAllowedExternalRoutePath(routePath) && (isConfiguredSchemeUrl(url, scheme) || isAssociatedDomainUrl(url))) {
            return '/';
        }

        return rawPath || '/';
    } catch {
        return '/';
    }
}
