export const BOOTSTRAP_ACTION_TYPES = {
    INTERNAL_ENTRY: 'internal_entry',
    OPEN_URL_JUMP: 'open_url_jump',
};

export const createInternalEntryAction = ({ abTest = null, reason }) => ({
    type: BOOTSTRAP_ACTION_TYPES.INTERNAL_ENTRY,
    abTest,
    reason,
});

export const createOpenUrlJumpAction = ({
    linkType,
    targetUrl,
    abTest = null,
    attributionDeepLinkParams = null,
}) => ({
    type: BOOTSTRAP_ACTION_TYPES.OPEN_URL_JUMP,
    linkType,
    targetUrl,
    abTest,
    attributionDeepLinkParams,
});
