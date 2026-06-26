import { Redirect, usePathname } from 'expo-router';
import { useEffect } from 'react';

export default function NotFoundRoute() {
    const pathname = usePathname();

    useEffect(() => {
        if (__DEV__) {
            console.warn('[Router] unmatched route redirected to bootstrap:', pathname);
        }
    }, [pathname]);

    return <Redirect href="/" />;
}
