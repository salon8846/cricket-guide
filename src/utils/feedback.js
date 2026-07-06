import { Asset } from 'expo-asset';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Vibration } from 'react-native';
import { createLogger } from '@/utils/logger';

const clickSoundAsset = require('@/assets/main/audio/click.mp3');
const logger = createLogger('Feedback');

let audioModeReady = false;

const ensureAudioMode = async () => {
    if (audioModeReady) {
        return;
    }

    await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
    });
    audioModeReady = true;
};

const releasePlayer = (player, subscription) => {
    subscription?.remove();
    player?.remove();
};

const playAsset = async (asset) => {
    let player = null;
    let subscription = null;

    try {
        await ensureAudioMode();
        const assetRef = Asset.fromModule(asset);
        if (!assetRef.localUri) {
            await assetRef.downloadAsync();
        }

        player = createAudioPlayer({
            uri: assetRef.localUri ?? assetRef.uri,
            assetId: asset,
        }, {
            updateInterval: 100,
            keepAudioSessionActive: false,
        });
        subscription = player.addListener('playbackStatusUpdate', (status) => {
            if (!status.didJustFinish) {
                return;
            }
            releasePlayer(player, subscription);
        });
        player.play();
    } catch (error) {
        releasePlayer(player, subscription);
        logger.error('播放音效失败', error);
        throw error;
    }
};

export const playClickSound = async () => {
    await playAsset(clickSoundAsset);
};

export const triggerClickVibration = () => {
    Vibration.vibrate(100);
};
