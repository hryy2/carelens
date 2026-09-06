import { Language } from '../types';

export type LiveConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'speaking'
  | 'paused'
  | 'error'
  | 'closed';

export interface LiveTranscriptItem {
  id: string;
  sender: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface LiveClientCallbacks {
  onStateChange: (state: LiveConnectionState) => void;
  onTranscript: (item: LiveTranscriptItem) => void;
  onError: (error: string) => void;
  onInterrupted: () => void;
}

export class GeminiLiveClient {
  // Static guard to enforce AT MOST ONE active Live client across the whole app
  private static activeInstance: GeminiLiveClient | null = null;

  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;
  
  private videoInterval: number | null = null;
  private nextStartTime = 0;
  private activeSourceNodes: AudioBufferSourceNode[] = [];
  
  private isDestroyed = false;
  private isPaused = false;
  private isMuted = false;
  private isVideoPaused = false;
  private language: Language = 'zh';
  private callbacks: LiveClientCallbacks;
  private state: LiveConnectionState = 'idle';

  constructor(callbacks: LiveClientCallbacks) {
    this.callbacks = callbacks;
  }

  public static getActiveInstance(): GeminiLiveClient | null {
    return GeminiLiveClient.activeInstance;
  }

  public static stopActiveInstance() {
    if (GeminiLiveClient.activeInstance) {
      GeminiLiveClient.activeInstance.stop();
      GeminiLiveClient.activeInstance = null;
    }
  }

  private setState(newState: LiveConnectionState) {
    if (this.isDestroyed) return;
    this.state = newState;
    this.callbacks.onStateChange(newState);
  }

  public async start({
    language,
    videoElement,
  }: {
    language: Language;
    videoElement: HTMLVideoElement | null;
  }) {
    // 0. Ensure any previous instance in the whole browser is strictly stopped first
    if (GeminiLiveClient.activeInstance && GeminiLiveClient.activeInstance !== this) {
      console.log('Stopping previous active GeminiLiveClient instance...');
      GeminiLiveClient.activeInstance.stop();
    }
    GeminiLiveClient.activeInstance = this;

    this.isDestroyed = false;
    this.isPaused = false;
    this.language = language;
    this.setState('connecting');

    try {
      // 1. Establish WebSocket connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live-stream`;
      
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        if (this.isDestroyed || this.ws !== ws) {
          try { ws.close(); } catch (e) {}
          return;
        }
        console.log('Gemini Live WebSocket open, sending init...');
        ws.send(
          JSON.stringify({
            type: 'init',
            language: this.language,
          })
        );
      };

      ws.onmessage = (event) => {
        if (this.isDestroyed || this.ws !== ws) return;
        this.handleServerMessage(event.data);
      };

      ws.onerror = (err) => {
        if (this.isDestroyed || this.ws !== ws) return;
        console.error('Gemini Live WebSocket error:', err);
        this.setState('error');
        this.callbacks.onError(
          this.language === 'zh'
            ? '无法连接到 Gemini 实时多模态流服务，请检查网络后重试。'
            : 'Could not connect to Gemini Live streaming service.'
        );
      };

      ws.onclose = () => {
        if (this.isDestroyed || this.ws !== ws) return;
        console.log('Gemini Live WebSocket closed');
        if (this.state !== 'error' && !this.isDestroyed) {
          this.setState('closed');
        }
      };

      if (this.isDestroyed) {
        this.stop();
        return;
      }

      // 2. Initialize Audio Output Context (24kHz for Gemini audio playback)
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });
      if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }

      if (this.isDestroyed) {
        this.stop();
        return;
      }

      // 3. Initialize Audio Input (16kHz for mic)
      await this.startMicrophone();

      if (this.isDestroyed) {
        this.stop();
        return;
      }

      // 4. Start Continuous Video Frame Streaming (1 FPS to Gemini Live)
      if (videoElement) {
        this.startVideoStreaming(videoElement);
      }
    } catch (err: any) {
      if (this.isDestroyed) return;
      console.error('Failed to start Gemini Live Client:', err);
      this.setState('error');
      this.callbacks.onError(err.message || 'Failed to start live stream');
      this.stop();
    }
  }

  private async startMicrophone() {
    if (this.isDestroyed) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (this.isDestroyed) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      this.micStream = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }

      if (this.isDestroyed) {
        this.stop();
        return;
      }

      this.audioSource = this.inputAudioCtx.createMediaStreamSource(stream);
      // Use buffer size 4096 (~250ms at 16kHz)
      this.audioProcessor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);

      this.audioProcessor.onaudioprocess = (e) => {
        // Complete silence when destroyed, paused, or muted
        if (
          this.isDestroyed ||
          this.isPaused ||
          this.isMuted ||
          !this.ws ||
          this.ws.readyState !== WebSocket.OPEN
        ) {
          return;
        }

        const inputChannelData = e.inputBuffer.getChannelData(0);
        
        // Check if there is audio volume (mic activity)
        let sum = 0;
        for (let i = 0; i < inputChannelData.length; i++) {
          sum += Math.abs(inputChannelData[i]);
        }
        const avg = sum / inputChannelData.length;
        if (avg > 0.01 && this.state !== 'speaking' && !this.isPaused) {
          this.setState('listening');
        }

        // Convert Float32Array to 16-bit signed PCM (Little-Endian)
        const pcm16 = new Int16Array(inputChannelData.length);
        for (let i = 0; i < inputChannelData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputChannelData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Convert to Base64
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Audio = btoa(binary);

        if (!this.isPaused && !this.isMuted && this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: 'audio',
              data: base64Audio,
            })
          );
        }
      };

      this.audioSource.connect(this.audioProcessor);
      this.audioProcessor.connect(this.inputAudioCtx.destination);
    } catch (err: any) {
      console.warn('Microphone stream error in Live API:', err);
    }
  }

  private startVideoStreaming(videoElement: HTMLVideoElement) {
    if (this.videoInterval) {
      clearInterval(this.videoInterval);
      this.videoInterval = null;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // 1 FPS video frame delivery to Gemini Live
    this.videoInterval = window.setInterval(() => {
      if (
        this.isDestroyed ||
        this.isPaused ||
        this.isVideoPaused ||
        !videoElement ||
        videoElement.readyState < 2 ||
        !this.ws ||
        this.ws.readyState !== WebSocket.OPEN
      ) {
        return;
      }

      const w = videoElement.videoWidth || 640;
      const h = videoElement.videoHeight || 480;

      // Scale to max width 640 for lightweight low-latency streaming
      const scale = Math.min(1, 640 / Math.max(w, h));
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);

      if (ctx) {
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
        const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

        if (!this.isPaused && this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: 'video',
              data: base64Data,
            })
          );
        }
      }
    }, 1000);
  }

  private handleServerMessage(rawData: string) {
    if (this.isDestroyed) return;

    try {
      const msg = JSON.parse(rawData);

      if (msg.type === 'ready') {
        if (!this.isPaused) {
          this.setState('connected');
        }
        return;
      }

      if (msg.type === 'error') {
        console.error('Server reported Live error:', msg.message);
        this.setState('error');
        this.callbacks.onError(msg.message || 'Live interaction error');
        return;
      }

      if (msg.type === 'interrupted') {
        this.stopAudioPlayback();
        if (!this.isPaused) {
          this.setState('connected');
        }
        this.callbacks.onInterrupted();
        return;
      }

      // Drop incoming voice / transcript if paused
      if (this.isPaused) {
        return;
      }

      // Audio Chunk from Gemini Live (24kHz 16-bit PCM little endian)
      if (msg.type === 'audio' && msg.data) {
        this.setState('speaking');
        this.playAudioChunk(msg.data);
      }

      // Model or User Transcriptions
      if (msg.type === 'output_transcription' && msg.text) {
        this.callbacks.onTranscript({
          id: 'model_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
          sender: 'model',
          text: msg.text,
          timestamp: Date.now(),
        });
      }

      if (msg.type === 'input_transcription' && msg.text) {
        this.callbacks.onTranscript({
          id: 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
          sender: 'user',
          text: msg.text,
          timestamp: Date.now(),
        });
      }

      if (msg.type === 'turn_complete') {
        // Transition back to connected once turn completes
        setTimeout(() => {
          if (this.state === 'speaking' && !this.isPaused && !this.isDestroyed) {
            this.setState('connected');
          }
        }, 1200);
      }
    } catch (err) {
      console.warn('Error parsing server live message:', err);
    }
  }

  // Play 24kHz 16-bit PCM little-endian audio seamlessly
  private playAudioChunk(base64Data: string) {
    if (this.isDestroyed || this.isPaused || !this.outputAudioCtx) return;

    try {
      const binaryStr = atob(base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const sourceNode = this.outputAudioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(this.outputAudioCtx.destination);

      const currentTime = this.outputAudioCtx.currentTime;
      const startTime = Math.max(currentTime, this.nextStartTime);
      
      sourceNode.start(startTime);
      this.nextStartTime = startTime + audioBuffer.duration;

      this.activeSourceNodes.push(sourceNode);
      sourceNode.onended = () => {
        const idx = this.activeSourceNodes.indexOf(sourceNode);
        if (idx > -1) {
          this.activeSourceNodes.splice(idx, 1);
        }
        if (this.activeSourceNodes.length === 0 && this.state === 'speaking' && !this.isPaused && !this.isDestroyed) {
          this.setState('connected');
        }
      };
    } catch (e) {
      console.warn('Error decoding or scheduling live audio chunk:', e);
    }
  }

  private stopAudioPlayback() {
    for (const node of this.activeSourceNodes) {
      try {
        node.stop();
        node.disconnect();
      } catch (e) {
        // Ignore already stopped nodes
      }
    }
    this.activeSourceNodes = [];
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
  }

  // Send a text question/command directly to the active live session
  public sendTextPrompt(text: string) {
    if (this.isDestroyed || this.isPaused) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'text',
          text,
        })
      );
      this.callbacks.onTranscript({
        id: 'user_text_' + Date.now(),
        sender: 'user',
        text,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Complete pause/resume: Stops sending audio & video, stops AI speaking immediately
   */
  public setPaused(paused: boolean) {
    if (this.isDestroyed) return;
    this.isPaused = paused;

    if (paused) {
      // 1. Cut off any active AI speech output immediately
      this.stopAudioPlayback();

      // 2. Disable microphone audio tracks so hardware stops streaming
      if (this.micStream) {
        this.micStream.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }

      // 3. Notify server to pause processing if connected
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'pause' }));
        } catch (e) {}
      }

      this.setState('paused');
    } else {
      // 1. Re-enable microphone audio tracks if unmuted
      if (this.micStream && !this.isMuted) {
        this.micStream.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
      }

      // 2. Reset audio playback timeline
      if (this.outputAudioCtx) {
        this.nextStartTime = this.outputAudioCtx.currentTime;
      }

      // 3. Notify server to resume
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'resume' }));
        } catch (e) {}
      }

      this.setState('connected');
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted && !this.isPaused;
      });
    }
  }

  public setVideoPause(paused: boolean) {
    this.isVideoPaused = paused;
  }

  public stop() {
    this.isDestroyed = true;
    this.isPaused = false;

    if (GeminiLiveClient.activeInstance === this) {
      GeminiLiveClient.activeInstance = null;
    }

    if (this.videoInterval) {
      clearInterval(this.videoInterval);
      this.videoInterval = null;
    }

    this.stopAudioPlayback();

    if (this.audioProcessor) {
      try { this.audioProcessor.disconnect(); } catch (e) {}
      this.audioProcessor = null;
    }
    if (this.audioSource) {
      try { this.audioSource.disconnect(); } catch (e) {}
      this.audioSource = null;
    }
    if (this.inputAudioCtx) {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }
    if (this.outputAudioCtx) {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => {
        try { track.stop(); } catch (e) {}
      });
      this.micStream = null;
    }

    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.onopen = null;
        this.ws.close();
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }

    this.setState('idle');
  }
}
