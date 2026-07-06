import { Redirect, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { createLogger } from '@/utils/logger';

const logger = createLogger('Router', { devOnly: true });

export default function NotFoundRoute() {
    const pathname = usePathname();

    useEffect(() => {
        logger.warn('unmatched route redirected to bootstrap', { pathname });
    }, [pathname]);

    return <Redirect href="/" />;
}
