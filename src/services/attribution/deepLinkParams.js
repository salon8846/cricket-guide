export const normalizeAttributionDeepLinkParams = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const linkValue = String(value.linkValue ?? '').trim();
    if (!linkValue) {
        return null;
    }

    const rawUrlParams = value.urlParams && typeof value.urlParams === 'object' && !Array.isArray(value.urlParams)
        ? value.urlParams
        : value;
    const urlParams = {};

    Object.entries(rawUrlParams).forEach(([key, paramValue]) => {
        const normalizedKey = String(key ?? '').trim();
        const normalizedValue = String(paramValue ?? '').trim();
        if (normalizedKey && normalizedValue && normalizedKey !== 'linkValue' && normalizedKey !== 'urlParams') {
            urlParams[normalizedKey] = normalizedValue;
        }
    });

    return {
        linkValue,
        urlParams,
    };
};
