import { Language } from '../types';

class SeniorAudioManager {
  private audioCtx: AudioContext | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeaking: boolean = false;
  private isMuted: boolean = false;
  private onStateChangeListeners: Array<(isSpeaking: boolean) => void> = [];
  private onMuteChangeListeners: Array<(isMuted: boolean) => void> = [];
  private currentSpeed: 'normal' | 'slow' = 'normal';

  constructor() {
    // Load persisted mute state
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('carelens_muted') === 'true') {
        this.isMuted = true;
      }
    } catch (e) {
      // ignore
    }

    // Pre-initialize voice list if speech synthesis is available
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        // Warm up voices
        window.speechSynthesis.getVoices();
      };
    }
  }

  public subscribeState(callback: (isSpeaking: boolean) => void) {
    this.onStateChangeListeners.push(callback);
    return () => {
      this.onStateChangeListeners = this.onStateChangeListeners.filter((cb) => cb !== callback);
    };
  }

  public subscribeMute(callback: (isMuted: boolean) => void) {
    this.onMuteChangeListeners.push(callback);
    return () => {
      this.onMuteChangeListeners = this.onMuteChangeListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyState(speaking: boolean) {
    this.isSpeaking = speaking;
    this.onStateChangeListeners.forEach((cb) => cb(speaking));
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('carelens_muted', muted ? 'true' : 'false');
      }
    } catch (e) {
      // ignore
    }
    if (muted) {
      this.stop();
    }
    this.onMuteChangeListeners.forEach((cb) => cb(muted));
  }

  public toggleMute(): boolean {
    const next = !this.isMuted;
    this.setMuted(next);
    return next;
  }

  public stop() {
    if (this.currentAudioElement) {
      this.currentAudioElement.pause();
      this.currentAudioElement.currentTime = 0;
      this.currentAudioElement = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;
    this.notifyState(false);
  }

  /**
   * Play text aloud via browser SpeechSynthesis with senior-tuned voice parameters:
   * - Default rate: 0.82x (comfortable, easy-to-follow pace for seniors)
   * - Slow rate: 0.70x (extra patient, distinct slower speed)
   * - Pitch: 0.88 (lower, resonant, authoritative tone suitable for presbycusis and scam-risk trust)
   */
  public async speakText(
    text: string,
    language: Language = 'en',
    speed: 'normal' | 'slow' = 'normal'
  ) {
    this.stop();
    this.currentSpeed = speed;

    if (this.isMuted) return;
    if (!text || text.trim().length === 0) return;

    // Noticeably slower for elderly clarity
    // Normal: 0.82x (standard senior pace); Slow: 0.70x (very patient pace)
    const rate = speed === 'slow' ? 0.70 : 0.82;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Clean speech text (remove markdown symbols like #, *, etc.)
      const cleaned = text
        .replace(/[#*`_~]/g, '')
        .replace(/https?:\/\/\S+/g, 'link')
        .replace(/\s+/g, ' ')
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.rate = rate;
      // Lower pitch (0.88) provides a calm, warm, authoritative baritone tone that is much easier for seniors with high-frequency hearing loss to hear clearly
      utterance.pitch = 0.88;
      utterance.lang = language === 'zh' ? 'zh-CN' : 'en-NZ';

      // Pick a calm, deep, authoritative voice persona consistent across languages
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        if (language === 'zh') {
          // Prefer high-quality Chinese mainland voices
          const zhVoice =
            voices.find((v) => v.lang === 'zh-CN' || v.lang.startsWith('zh')) ||
            voices.find((v) => v.name.toLowerCase().includes('chinese'));
          if (zhVoice) utterance.voice = zhVoice;
        } else {
          // Prefer calm, clear New Zealand, Australian, UK or US English voices
          const enVoice =
            voices.find((v) => v.lang === 'en-NZ') ||
            voices.find((v) => v.lang === 'en-AU') ||
            voices.find((v) => v.lang === 'en-GB' && (v.name.includes('George') || v.name.includes('Oliver') || v.name.includes('Male'))) ||
            voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Guy') || v.name.includes('David') || v.name.includes('Google'))) ||
            voices.find((v) => v.lang.startsWith('en'));
          if (enVoice) utterance.voice = enVoice;
        }
      }

      utterance.onstart = () => {
        this.notifyState(true);
      };

      utterance.onend = () => {
        this.notifyState(false);
      };

      utterance.onerror = () => {
        this.notifyState(false);
      };

      this.currentUtterance = utterance;

      // Small delay to ensure previous speech cancellation has settled
      setTimeout(() => {
        if (this.currentUtterance === utterance) {
          window.speechSynthesis.speak(utterance);
        }
      }, 30);
    }
  }

  /**
   * Play raw audio from Gemini API (base64 PCM / MP3)
   */
  public async playBase64Audio(base64Data: string, sampleRate = 24000) {
    this.stop();
    if (this.isMuted) return;
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate,
        });
      }
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Convert base64 to binary
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Try decoding audio buffer
      const audioBuffer = await this.audioCtx.decodeAudioData(bytes.buffer.slice(0));
      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioCtx.destination);

      source.onended = () => {
        this.notifyState(false);
      };

      this.notifyState(true);
      source.start(0);
    } catch (e) {
      console.warn('Direct audio context play failed, fallback to native SpeechSynthesis', e);
      this.notifyState(false);
    }
  }
}

export const seniorAudio = new SeniorAudioManager();
