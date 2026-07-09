export function parseBridgeMessage(rawMessage) {
    if (typeof rawMessage === 'string') {
        return JSON.parse(rawMessage);
    }
    if (rawMessage && typeof rawMessage === 'object') {
        return rawMessage;
    }
    return null;
}
