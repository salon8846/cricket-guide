export const replaceWithBootstrapRestart = (router) => {
    router.replace({
        pathname: '/',
        params: {
            bootstrapRestartAt: String(Date.now()),
        },
    });
};
