import { create } from 'zustand';

const useAppStore = create((set) => ({
    bootstrapBase: null,
    setBootstrapBase: (bootstrapBase) => set({ bootstrapBase }),
    clearBootstrapBase: () => set({ bootstrapBase: null }),
}));

export default useAppStore;
