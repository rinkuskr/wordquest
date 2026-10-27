import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

export type SoundName =
  | 'tap'
  | 'correct'
  | 'wrong'
  | 'complete'
  | 'countdown'
  | 'swipe'
  | 'bonus'
  | 'game-over';

const sources: Record<SoundName, number> = {
  tap: require('@/assets/audio/tap.wav'),
  correct: require('@/assets/audio/correct.wav'),
  wrong: require('@/assets/audio/wrong.wav'),
  complete: require('@/assets/audio/complete.wav'),
  countdown: require('@/assets/audio/countdown.wav'),
  swipe: require('@/assets/audio/swipe.wav'),
  bonus: require('@/assets/audio/bonus.wav'),
  'game-over': require('@/assets/audio/game-over.wav'),
};

class AudioService {
  private initialized = false;
  private players = new Map<SoundName, AudioPlayer>();
  private enabled = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  async play(name: SoundName) {
    if (!this.enabled) return;
    try {
      if (!this.initialized) {
        await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
        this.initialized = true;
      }
      let player = this.players.get(name);
      if (!player) {
        player = createAudioPlayer(sources[name], { downloadFirst: true });
        this.players.set(name, player);
      }
      await player.seekTo(0);
      player.play();
    } catch {
      // Audio is optional: initialization or overlapping playback must not block gameplay.
    }
  }
}

export const audioService = new AudioService();
