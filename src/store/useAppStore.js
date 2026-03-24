import { create } from 'zustand';

const useAppStore = create((set) => ({
    jumpOverlay: true,
    showJumpOverlay: () => set({ jumpOverlay: true }),
    hideJumpOverlay: () => set({ jumpOverlay: false }),
}));

export default useAppStore;
