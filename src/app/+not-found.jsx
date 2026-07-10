import { Redirect, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { createDebugLogger } from '@/utils/logger';

const logger = createDebugLogger('Router');

export default function NotFoundRoute() {
    const pathname = usePathname();

    useEffect(() => {
        logger.warn('unmatched route redirected to bootstrap', { pathname });
    }, [pathname]);

    return <Redirect href="/" />;
}
