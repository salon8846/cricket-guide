import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import NetworkErrorScreen from '@/components/common/NetworkErrorScreen';
import useAppStore from '@/store/useAppStore';
import useLangStore from '@/store/useLangStore';
import useUserStore from '@/store/useUserStore';
import { registerAttributionUrlOpenListener } from '@/services/attribution/reporter';
import { executeBootstrapAction } from '@/services/bootstrap/navigation';
import { runBootstrapAction } from '@/services/bootstrap/runBootstrap';
import { sendInstallStatOnce } from '@/services/bootstrap/installStat';
import { captureClientException } from '@/services/logging/clientErrors/capture';
import { recordBreadcrumb } from '@/services/logging/breadcrumbs';
import { createDebugLogger } from '@/utils/logger';
import {
    BOOTSTRAP_APPEARANCE,
} from '@/constants/appCustomization';

const deferredJumpLogger = createDebugLogger('DeferredJump');

/**
 * 启动页只负责首屏状态、重试和生命周期触发。
 * 启动规则由 bootstrap services 解析，最终返回一个可执行导航 action。
 */
export default function BootstrapScreen() {
    const router = useRouter();
    const { bootstrapRestartAt } = useLocalSearchParams();
    const setBootstrapBase = useAppStore((state) => state.setBootstrapBase);
    const initUser = useUserStore((state) => state.initUser);
    const initLang = useLangStore((state) => state.initLang);
    const [status, setStatus] = useState('loading');
    const [retrying, setRetrying] = useState(false);
    const isRunningRef = useRef(false);
    const initSuccessRef = useRef(false);

    const runBootstrap = useCallback(async () => {
        if (isRunningRef.current) {
            deferredJumpLogger.info('bootstrap: skip, already running');
            return;
        }

        isRunningRef.current = true;
        // 重试和首屏进入统一走 loading 态
        setStatus('loading');

        try {
            const action = await runBootstrapAction({
                initUser,
                initLang,
                setBootstrapBase,
            });
            const navigationResult = await executeBootstrapAction(router, action);
            deferredJumpLogger.info('bootstrap: decision done', { didJump: navigationResult.didJump });
            recordBreadcrumb({
                category: 'bootstrap',
                name: 'bootstrap.decision',
                data: { didJump: navigationResult.didJump },
            });
            initSuccessRef.current = true;
        } catch (e) {
            deferredJumpLogger.warn('bootstrap: failed, show error', { error: e });
            recordBreadcrumb({
                category: 'bootstrap',
                name: 'bootstrap.failed',
                level: 'error',
                data: {
                    message: e?.message,
                },
            });
            captureClientException(e, {
                source: 'bootstrap',
                route: '/',
            });
            setStatus('error');
        } finally {
            isRunningRef.current = false;
            setRetrying(false);
            deferredJumpLogger.info('bootstrap: end');
        }
    }, [
        initLang,
        initUser,
        router,
        setBootstrapBase,
    ]);

    useEffect(() => {
        deferredJumpLogger.info('BootstrapScreen: mount');
        registerAttributionUrlOpenListener();
        sendInstallStatOnce();

        const appStateListener = AppState.addEventListener('change', (nextState) => {
            deferredJumpLogger.info('AppState change', { nextState });
            // 首次安装等场景下，系统授权弹窗可能打断启动链路，回前台后允许再触发一次
            if (nextState === 'active' && !initSuccessRef.current) {
                deferredJumpLogger.info('AppState active, rerun bootstrap');
                recordBreadcrumb({
                    category: 'bootstrap',
                    name: 'bootstrap.foreground_retry',
                });
                runBootstrap();
            }
        });

        return () => {
            deferredJumpLogger.info('BootstrapScreen: unmount');
            appStateListener.remove();
        };
    }, [runBootstrap]);

    useEffect(() => {
        runBootstrap();
    }, [bootstrapRestartAt, runBootstrap]);

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style={BOOTSTRAP_APPEARANCE.statusBarStyle} />
            <View style={styles.container}>
                <ActivityIndicator size="large" color={BOOTSTRAP_APPEARANCE.indicatorColor} />
            </View>
            {status === 'error' && (
                <NetworkErrorScreen
                    loading={retrying}
                    onPress={() => {
                        deferredJumpLogger.info('ui: retry pressed');
                        setRetrying(true);
                        runBootstrap();
                    }}
                />
            )}
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BOOTSTRAP_APPEARANCE.backgroundColor,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
