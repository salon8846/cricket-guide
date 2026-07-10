import { prepareBootstrapContext } from '@/services/bootstrap/context';
import { resolveBootstrapAction } from '@/services/bootstrap/decision';

export const runBootstrapAction = async ({
    initUser,
    initLang,
    setBootstrapBase,
}) => {
    const bootstrapContext = await prepareBootstrapContext({
        initUser,
        initLang,
        setBootstrapBase,
    });

    return resolveBootstrapAction(bootstrapContext);
};
