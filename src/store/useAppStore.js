import { create } from 'zustand';

const useAppStore = create((set) => ({
    bootstrapBase: null,
    setBootstrapBase: (bootstrapBase) => set({ bootstrapBase }),
    clearBootstrapBase: () => set({ bootstrapBase: null }),

    // openUrl 轮询配置（用于 checkTime 场景，在进入业务页后继续后台轮询）
    // { untilTs: number, readClipboard: '1' | '0' }
    openUrlPoll: null,
    setOpenUrlPoll: (openUrlPoll) => set({ openUrlPoll }),
    clearOpenUrlPoll: () => set({ openUrlPoll: null }),
}));

export default useAppStore;
