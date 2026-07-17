import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';
import { createLogger } from '@/utils/logger';

const logger = createLogger('WebViewTelegramShare');

export function openTelegramDestinationOutsideWebView(requestedUrl) {
    if (requestedUrl.startsWith('https://t.me/share/')) {
        WebBrowser.openBrowserAsync(requestedUrl, {
            toolbarColor: '#FFFFFF',
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        }).catch((error) => {
            logger.warn('share page open failed', {
                url: requestedUrl,
                error,
            });
        });
        return true;
    }

    if (!requestedUrl.startsWith('tg:')) return false;

    Linking.openURL(requestedUrl).catch((error) => {
        logger.warn('app URL open failed', {
            url: requestedUrl,
            error,
        });
    });
    return true;
}
