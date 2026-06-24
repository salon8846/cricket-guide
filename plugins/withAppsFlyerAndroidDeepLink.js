const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const INTENT_IMPORT = 'import android.content.Intent';

const INTENT_FORWARDING_METHOD = `
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
  }
`;

const addKotlinImport = (source, importLine) => {
    if (source.includes(importLine)) {
        return source;
    }

    return source.replace(/(package [^\n]+\n)/, `$1${importLine}\n`);
};

const insertAppsFlyerIntentForwarding = (source) => {
    if (source.includes('override fun onNewIntent')) {
        return source;
    }

    const backButtonComment = '\n  /**\n    * Align the back button behavior';
    if (source.includes(backButtonComment)) {
        return source.replace(backButtonComment, `${INTENT_FORWARDING_METHOD}${backButtonComment}`);
    }

    const classEndIndex = source.lastIndexOf('\n}');
    if (classEndIndex === -1) {
        throw new Error('[AppsFlyerDeepLinkPlugin] MainActivity.kt class end not found');
    }

    return `${source.slice(0, classEndIndex)}${INTENT_FORWARDING_METHOD}${source.slice(classEndIndex)}`;
};

const applyAppsFlyerAndroidDeepLinkPatch = (source) => {
    const withIntentImport = addKotlinImport(source, INTENT_IMPORT);
    return insertAppsFlyerIntentForwarding(withIntentImport);
};

const getMainActivityRelativePath = (androidPackage) => {
    if (!androidPackage) {
        throw new Error('[AppsFlyerDeepLinkPlugin] android.package is required');
    }

    return path.join(
        'android',
        'app',
        'src',
        'main',
        'java',
        ...androidPackage.split('.'),
        'MainActivity.kt',
    );
};

module.exports = function withAppsFlyerAndroidDeepLink(config) {
    return withDangerousMod(config, [
        'android',
        async (cfg) => {
            const mainActivityRelativePath = getMainActivityRelativePath(cfg.android?.package);
            const mainActivityPath = path.join(cfg.modRequest.projectRoot, mainActivityRelativePath);

            if (!fs.existsSync(mainActivityPath)) {
                throw new Error(`[AppsFlyerDeepLinkPlugin] MainActivity.kt not found at ${mainActivityPath}`);
            }

            const currentSource = fs.readFileSync(mainActivityPath, 'utf8');
            const nextSource = applyAppsFlyerAndroidDeepLinkPatch(currentSource);

            if (nextSource !== currentSource) {
                fs.writeFileSync(mainActivityPath, nextSource);
            }

            return cfg;
        },
    ]);
};
