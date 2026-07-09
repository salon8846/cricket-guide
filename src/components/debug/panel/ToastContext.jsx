import { createContext, useContext } from 'react';

const missingAppDebugToastProvider = () => {
    throw new Error('AppDebugToastProvider is missing.');
};

const AppDebugToastContext = createContext(missingAppDebugToastProvider);

export function AppDebugToastProvider({ showToast, children }) {
    return (
        <AppDebugToastContext.Provider value={showToast}>
            {children}
        </AppDebugToastContext.Provider>
    );
}

export function useAppDebugToast() {
    return useContext(AppDebugToastContext);
}
