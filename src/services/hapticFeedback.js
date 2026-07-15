import * as Haptics from 'expo-haptics';

export const triggerSelectionHaptic = () => {
    return Haptics.selectionAsync();
};

export const triggerLightImpactHaptic = () => {
    return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export const triggerMediumImpactHaptic = () => {
    return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

export const triggerSuccessNotificationHaptic = () => {
    return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

export const triggerErrorNotificationHaptic = () => {
    return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
};
