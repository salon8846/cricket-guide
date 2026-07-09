export function buildNativeSafeAreaEvent(safeTop, safeBottom) {
    return `
        (function() {
            var e = new CustomEvent('nativeSafeArea', {
                detail: { safeTop: ${safeTop}, safeBottom: ${safeBottom} }
            });
            window.dispatchEvent(e);
        })();
        true;
    `;
}
