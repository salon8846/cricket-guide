import React from 'react';
import { usePathname } from 'expo-router';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { captureClientException } from '@/services/logging/clientErrors/capture';

class ClientErrorBoundaryInner extends React.Component {
    constructor(props) {
        super(props);
        this.state = { failed: false };
    }

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error, errorInfo) {
        captureClientException(error, {
            source: this.props.source,
            route: this.props.route,
            extra: {
                componentStack: errorInfo?.componentStack ?? '',
            },
        });
    }

    componentDidUpdate(prevProps) {
        if (
            this.state.failed
            && (prevProps.route !== this.props.route || prevProps.resetKey !== this.props.resetKey)
        ) {
            this.setState({ failed: false });
        }
    }

    render() {
        if (this.state.failed) {
            if (this.props.fallback !== undefined) {
                return this.props.fallback;
            }

            return (
                <View style={styles.fallback}>
                    <Text style={styles.title}>Something went wrong</Text>
                    <TouchableOpacity
                        activeOpacity={0.78}
                        onPress={() => this.setState({ failed: false })}
                        style={styles.button}
                    >
                        <Text style={styles.buttonText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return this.props.children;
    }
}

export default function ClientErrorBoundary({ children, fallback, resetKey, source = 'react_boundary' }) {
    const pathname = usePathname();

    return (
        <ClientErrorBoundaryInner fallback={fallback} resetKey={resetKey} route={pathname} source={source}>
            {children}
        </ClientErrorBoundaryInner>
    );
}

const styles = StyleSheet.create({
    fallback: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    title: {
        fontSize: 17,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 16,
    },
    button: {
        minHeight: 42,
        borderRadius: 8,
        paddingHorizontal: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0F766E',
    },
    buttonText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFFFFF',
    },
});
