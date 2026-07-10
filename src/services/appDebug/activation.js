import { replaceWithBootstrapRestart } from '@/services/bootstrapRestart';
import { setAppDebugEnabled } from '@/services/appDebug/store';

const APP_DEBUG_BOOTSTRAP_RESTART_DELAY_MS = 500;

const restartBootstrapSoon = (router) => {
    setTimeout(() => {
        replaceWithBootstrapRestart(router);
    }, APP_DEBUG_BOOTSTRAP_RESTART_DELAY_MS);
};

export const enableAppDebugAndRestartBootstrap = async (router) => {
    const nextAppDebug = await setAppDebugEnabled(true);
    restartBootstrapSoon(router);
    return nextAppDebug;
};

export const disableAppDebugAndRestartBootstrap = async (router) => {
    const nextAppDebug = await setAppDebugEnabled(false);
    restartBootstrapSoon(router);
    return nextAppDebug;
};
