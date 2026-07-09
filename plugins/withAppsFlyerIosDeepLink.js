const fs = require('fs');
const path = require('path');
const { withAppDelegate, withDangerousMod } = require('@expo/config-plugins');

const RN_APPS_FLYER_HEADER_IMPORT = '#import <RNAppsFlyer.h>';
const APPS_FLYER_OPEN_URL_FORWARDING = 'AppsFlyerAttribution.shared().handleOpen(url, options: options)';
const APPS_FLYER_UNIVERSAL_LINK_FORWARDING = 'AppsFlyerAttribution.shared().continue(userActivity, restorationHandler: nil)';

const APPS_FLYER_OPEN_URL_METHOD = `
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    AppsFlyerAttribution.shared().handleOpen(url, options: options)
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }
`;

const APPS_FLYER_UNIVERSAL_LINK_METHOD = `
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    AppsFlyerAttribution.shared().continue(userActivity, restorationHandler: nil)
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
`;

const insertSwiftMethodBeforeClassEnd = (source, methodSource) => {
    const classEndIndex = source.lastIndexOf('\n}');
    if (classEndIndex === -1) {
        throw new Error('[AppsFlyerIosDeepLinkPlugin] AppDelegate.swift class end not found');
    }

    return `${source.slice(0, classEndIndex)}${methodSource}${source.slice(classEndIndex)}`;
};

const addAppsFlyerOpenUrlForwarding = (source) => {
    if (source.includes(APPS_FLYER_OPEN_URL_FORWARDING)) {
        return source;
    }

    const openUrlReturnPattern = /(\s*)return super\.application\(app, open: url, options: options\) \|\| RCTLinkingManager\.application\(app, open: url, options: options\)/;
    if (openUrlReturnPattern.test(source)) {
        return source.replace(openUrlReturnPattern, (match, indent) => (
            `${indent}${APPS_FLYER_OPEN_URL_FORWARDING}\n${match}`
        ));
    }

    if (source.includes('open url: URL')) {
        throw new Error('[AppsFlyerIosDeepLinkPlugin] AppDelegate.swift openURL method shape is unsupported');
    }

    return insertSwiftMethodBeforeClassEnd(source, APPS_FLYER_OPEN_URL_METHOD);
};

const removeAppsFlyerUniversalLinkSelectorForwarding = (source) => {
    const selectorForwardingPattern = /\n\s*let selector = NSSelectorFromString\("continueUserActivity:restorationHandler:"\)\n(?:\s*\n)?\s*let appsFlyerAttribution = AppsFlyerAttribution\.shared\(\)\n(?:\s*\n)?\s*if appsFlyerAttribution\.responds\(to: selector\) \{\n(?:\s*\n)?\s*_ = appsFlyerAttribution\.perform\(selector, with: userActivity, with: restorationHandler\)\n(?:\s*\n)?\s*\}\n/g;
    return source.replace(selectorForwardingPattern, '\n');
};

const addAppsFlyerUniversalLinkForwarding = (source) => {
    const withoutSelectorForwarding = removeAppsFlyerUniversalLinkSelectorForwarding(source);

    if (withoutSelectorForwarding.includes(APPS_FLYER_UNIVERSAL_LINK_FORWARDING)) {
        return withoutSelectorForwarding;
    }

    const universalLinkAnchorPattern = /(\s*)let result = RCTLinkingManager\.application\(application, continue: userActivity, restorationHandler: restorationHandler\)/;
    if (universalLinkAnchorPattern.test(withoutSelectorForwarding)) {
        return withoutSelectorForwarding.replace(universalLinkAnchorPattern, (match, indent) => (
            `${indent}${APPS_FLYER_UNIVERSAL_LINK_FORWARDING}\n${match}`
        ));
    }

    if (withoutSelectorForwarding.includes('continue userActivity: NSUserActivity')) {
        throw new Error('[AppsFlyerIosDeepLinkPlugin] AppDelegate.swift Universal Link method shape is unsupported');
    }

    return insertSwiftMethodBeforeClassEnd(withoutSelectorForwarding, APPS_FLYER_UNIVERSAL_LINK_METHOD);
};

const applyAppsFlyerIosDeepLinkPatch = (source) => {
    return addAppsFlyerUniversalLinkForwarding(addAppsFlyerOpenUrlForwarding(source));
};

const isAppsFlyerBridgingHeaderImport = (line) => {
    return /^#import\s+[<"]RNAppsFlyer\.h[>"]\s*$/.test(line);
};

const applyAppsFlyerBridgingHeaderImport = (source) => {
    const trimmedSource = source
        .split('\n')
        .filter((line) => !isAppsFlyerBridgingHeaderImport(line))
        .join('\n')
        .replace(/\s*$/, '');
    return `${trimmedSource}\n${RN_APPS_FLYER_HEADER_IMPORT}\n`;
};

const collectBridgingHeaderPaths = (directoryPath) => {
    if (!fs.existsSync(directoryPath)) {
        return [];
    }

    return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'Pods' || entry.name === 'build') {
                return [];
            }
            return collectBridgingHeaderPaths(entryPath);
        }

        return entry.name.endsWith('Bridging-Header.h') ? [entryPath] : [];
    });
};

const withAppsFlyerIosAppDelegate = (config) => {
    return withAppDelegate(config, (cfg) => {
        if (cfg.modResults.language !== 'swift') {
            throw new Error(`[AppsFlyerIosDeepLinkPlugin] AppDelegate language is unsupported: ${cfg.modResults.language}`);
        }

        cfg.modResults.contents = applyAppsFlyerIosDeepLinkPatch(cfg.modResults.contents);
        return cfg;
    });
};

const withAppsFlyerIosBridgingHeader = (config) => {
    return withDangerousMod(config, [
        'ios',
        async (cfg) => {
            const iosProjectRoot = path.join(cfg.modRequest.projectRoot, 'ios');
            const bridgingHeaderPaths = collectBridgingHeaderPaths(iosProjectRoot);
            if (bridgingHeaderPaths.length === 0) {
                throw new Error('[AppsFlyerIosDeepLinkPlugin] iOS bridging header not found');
            }

            bridgingHeaderPaths.forEach((bridgingHeaderPath) => {
                const currentSource = fs.readFileSync(bridgingHeaderPath, 'utf8');
                const nextSource = applyAppsFlyerBridgingHeaderImport(currentSource);
                if (nextSource !== currentSource) {
                    fs.writeFileSync(bridgingHeaderPath, nextSource);
                }
            });

            return cfg;
        },
    ]);
};

module.exports = function withAppsFlyerIosDeepLink(config) {
    return withAppsFlyerIosBridgingHeader(withAppsFlyerIosAppDelegate(config));
};
