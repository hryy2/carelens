import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Mic,
  MicOff,
  RefreshCw,
  Upload,
  Sparkles,
  ArrowLeft,
  AlertCircle,
  Pause,
  Play,
  RotateCcw,
  Keyboard,
  Subtitles,
  Info,
  Send,
  Loader2,
} from 'lucide-react';
import { Language, PresetSample } from '../types';
import { seniorAudio } from '../services/audio';
import {
  GeminiLiveClient,
  LiveConnectionState,
  LiveTranscriptItem,
} from '../services/geminiLiveClient';

interface CameraAssistantProps {
  language: Language;
  onBack: () => void;
  onAnalyze: (data: { imageBase64: string; question: string }) => void;
  initialPreset?: PresetSample;
}

export const CameraAssistant: React.FC<CameraAssistantProps> = ({
  language,
  onBack,
  onAnalyze,
  initialPreset,
}) => {
  const isZh = language === 'zh';

  // Video & Stream Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveClientRef = useRef<GeminiLiveClient | null>(null);
  const sessionEpochRef = useRef<number>(0);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Mode: 'live' (Real-time continuous WebSocket) vs 'photo' (Single snapshot capture)
  const [interactionMode, setInteractionMode] = useState<'live' | 'photo'>(
    initialPreset?.imageUrl ? 'photo' : 'live'
  );

  // Live WebSocket Connection States
  const [liveState, setLiveState] = useState<LiveConnectionState>('idle');
  const [transcripts, setTranscripts] = useState<LiveTranscriptItem[]>([]);
  const [liveSubtitle, setLiveSubtitle] = useState<string>('');
  const [isLivePaused, setIsLivePaused] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Camera States
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Photo & Input States
  const [capturedImage, setCapturedImage] = useState<string | null>(
    initialPreset?.imageUrl || null
  );
  const [typedQuestion, setTypedQuestion] = useState<string>('');
  const [isRecordingSpeech, setIsRecordingSpeech] = useState(false);

  // Auto scroll conversation to bottom
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Cleanly stop camera media stream tracks
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Track stop error:', e);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsCameraStarting(false);
  }, []);

  // Request & Bind Camera Stream
  const startCameraStream = useCallback(
    async (targetFacing: 'environment' | 'user' = facingMode) => {
      stopCameraStream();
      setIsCameraStarting(true);
      setCameraError(null);

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('NOT_SUPPORTED');
        }

        let mediaStream: MediaStream | null = null;

        // Try ideal facingMode first
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: targetFacing },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch (err) {
          console.warn('Ideal facingMode failed, falling back to basic video:', err);
        }

        // Fallback to basic video: true
        if (!mediaStream) {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        if (!mediaStream) {
          throw new Error('FAILED_TO_GET_STREAM');
        }

        streamRef.current = mediaStream;

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          videoRef.current.autoplay = true;

          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.warn('Video play catch:', playErr);
          }
        }

        setCameraActive(true);
        setIsCameraStarting(false);
        setCameraError(null);
        return mediaStream;
      } catch (err: any) {
        console.error('Camera access error:', err);
        setIsCameraStarting(false);
        setCameraActive(false);

        if (err.message === 'NOT_SUPPORTED') {
          setCameraError(
            isZh ? '您的浏览器不支持直接调用摄像头' : 'Camera not supported in this browser'
          );
        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraError(
            isZh
              ? '摄像头权限已被拒绝。请在浏览器地址栏允许摄像头权限。'
              : 'Camera permission denied. Please allow camera access.'
          );
        } else {
          setCameraError(
            isZh
              ? '未能启动摄像头。您可以点击重试或从相册上传图片。'
              : 'Could not start camera. Please tap reconnect or upload a photo.'
          );
        }
        return null;
      }
    },
    [facingMode, stopCameraStream, isZh]
  );

  // Stop Live Session cleanly
  const stopLiveSession = useCallback(() => {
    if (liveClientRef.current) {
      liveClientRef.current.stop();
      liveClientRef.current = null;
    }
    GeminiLiveClient.stopActiveInstance();
    setLiveState('idle');
  }, []);

  // Initialize and Connect to Gemini Live API with Strict Epoch Guards
  const startLiveSession = useCallback(async () => {
    const currentEpoch = ++sessionEpochRef.current;

    stopLiveSession();
    setIsLivePaused(false);
    setLiveError(null);

    // Ensure camera is active
    let videoNode = videoRef.current;
    if (!streamRef.current) {
      await startCameraStream(facingMode);
      videoNode = videoRef.current;
    }

    if (sessionEpochRef.current !== currentEpoch) {
      return;
    }

    const client = new GeminiLiveClient({
      onStateChange: (st) => {
        if (sessionEpochRef.current !== currentEpoch) return;
        setLiveState(st);
      },
      onTranscript: (item) => {
        if (sessionEpochRef.current !== currentEpoch) return;

        // Update real-time subtitles bar with ongoing transcription
        setLiveSubtitle(item.text);

        // Append to conversation history bubble stream
        setTranscripts((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.sender === item.sender && Date.now() - last.timestamp < 3500) {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                text: `${last.text} ${item.text}`,
                timestamp: Date.now(),
              },
            ];
          }
          return [...prev, item];
        });
      },
      onError: (err) => {
        if (sessionEpochRef.current !== currentEpoch) return;
        setLiveError(err);
      },
      onInterrupted: () => {
        // Interruption handled in client
      },
    });

    liveClientRef.current = client;

    await client.start({
      language,
      videoElement: videoNode,
    });

    if (sessionEpochRef.current !== currentEpoch) {
      client.stop();
    }
  }, [facingMode, language, startCameraStream, stopLiveSession]);

  // Lifecycle for mode & language changes
  useEffect(() => {
    if (interactionMode === 'live') {
      startLiveSession();
    } else {
      stopLiveSession();
      if (!initialPreset?.imageUrl && !capturedImage) {
        startCameraStream(facingMode);
      }
    }

    return () => {
      sessionEpochRef.current++;
      stopLiveSession();
      stopCameraStream();
    };
  }, [interactionMode, language]);

  // Handle Pause / Resume
  const handleTogglePause = () => {
    const nextPaused = !isLivePaused;
    setIsLivePaused(nextPaused);
    if (liveClientRef.current) {
      liveClientRef.current.setPaused(nextPaused);
    }
    seniorAudio.speakText(
      nextPaused
        ? isZh
          ? '音视频传输已暂停'
          : 'Live streams paused'
        : isZh
        ? '已恢复实时视听对话'
        : 'Live conversation resumed',
      language
    );
  };

  // Handle Flip Camera
  const handleFlipCamera = async () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    await startCameraStream(nextFacing);
  };

  // Handle Reconnect
  const handleReconnect = () => {
    seniorAudio.speakText(isZh ? '正在重新连接...' : 'Reconnecting...', language);
    if (interactionMode === 'live') {
      startLiveSession();
    } else {
      startCameraStream(facingMode);
    }
  };

  // Quick Questions or typed text prompt
  const handleSendPrompt = (questionText: string) => {
    if (!questionText.trim()) return;

    // Append to conversation transcript as user message
    const userItem: LiveTranscriptItem = {
      id: 'user_' + Date.now(),
      sender: 'user',
      text: questionText.trim(),
      timestamp: Date.now(),
    };
    setTranscripts((prev) => [...prev, userItem]);

    if (interactionMode === 'live' && liveClientRef.current) {
      liveClientRef.current.sendTextPrompt(questionText.trim());
    } else if (capturedImage) {
      onAnalyze({
        imageBase64: capturedImage,
        question: questionText.trim(),
      });
    }

    setTypedQuestion('');
  };

  // Voice Input via Speech Recognition (for typing box mic button)
  const handleVoiceInputClick = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      seniorAudio.speakText(
        isZh ? '请打字输入您的问题' : 'Please type your question',
        language
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = isZh ? 'zh-CN' : 'en-NZ';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecordingSpeech(true);
        seniorAudio.speakText(isZh ? '请说话...' : 'Listening...', language);
      };

      recognition.onresult = (event: any) => {
        const text = event.results?.[0]?.[0]?.transcript;
        if (text) {
          handleSendPrompt(text);
        }
        setIsRecordingSpeech(false);
      };

      recognition.onerror = () => {
        setIsRecordingSpeech(false);
      };

      recognition.onend = () => {
        setIsRecordingSpeech(false);
      };

      recognition.start();
    } catch (e) {
      console.warn('Speech recognition error:', e);
      setIsRecordingSpeech(false);
    }
  };

  // Photo Mode Snapshot capture
  const handleCapturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const width = video.videoWidth || video.clientWidth || 1280;
      const height = video.videoHeight || video.clientHeight || 720;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (facingMode === 'user') {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(dataUrl);
        stopCameraStream();
        seniorAudio.speakText(
          isZh ? '已拍摄照片，您可以提出问题。' : 'Photo captured. Ask your question.',
          language
        );
      }
    }
  };

  const handleRetakePhoto = () => {
    setCapturedImage(null);
    startCameraStream(facingMode);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setCapturedImage(reader.result as string);
        setInteractionMode('photo');
        stopLiveSession();
        stopCameraStream();
      };
      reader.readAsDataURL(file);
    }
  };

  // Render assistant messages with bold highlights for button names, numbers, temperatures
  const renderFormattedAiText = (text: string) => {
    // Splits text recognizing markdown **bold** or key appliance indicators
    const parts = text.split(/(\*\*.*?\*\*|「.*?」|\[.*?\]|\b\d+(?:\.\d+)?(?:min|s|分钟|秒|度|°C|W|瓦)?\b)/gi);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-extrabold text-[#085041]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (
        (part.startsWith('「') && part.endsWith('」')) ||
        (part.startsWith('[') && part.endsWith(']'))
      ) {
        return (
          <strong key={index} className="font-extrabold text-[#085041]">
            {part}
          </strong>
        );
      }
      // Check numeric or time values
      if (/^\d+(?:\.\d+)?(?:min|s|分钟|秒|度|°C|W|瓦)?$/i.test(part.trim())) {
        return (
          <strong key={index} className="font-extrabold text-[#085041]">
            {part}
          </strong>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Quick Questions
  const quickQuestions = isZh
    ? [
        { label: '热多长时间？', text: '这个需要加热多长时间？' },
        { label: '这样安全吗？', text: '这个操作安全吗？有什么注意事项？' },
        { label: '按键什么意思？', text: '我指着的这个按键是什么功能？' },
      ]
    : [
        { label: 'How long?', text: 'How long should this be heated for?' },
        { label: 'Is this safe?', text: 'Is this safe to use? Any precautions?' },
        { label: 'What does this button do?', text: 'What does the button I am pointing to do?' },
      ];

  // Determine Connection Status Text
  const connectionStatus =
    liveState === 'connected' || liveState === 'listening' || liveState === 'speaking'
      ? isZh
        ? '已连接'
        : 'Connected'
      : liveState === 'connecting'
      ? isZh
        ? '连接中…'
        : 'Connecting…'
      : isLivePaused
      ? isZh
        ? '已暂停'
        : 'Paused'
      : isZh
      ? '已断开'
      : 'Disconnected';

  // Determine Voice Status Text & Styling
  const voiceStateText = isLivePaused
    ? isZh
      ? '已暂停'
      : 'Paused'
    : liveState === 'speaking'
    ? isZh
      ? 'AI 正在回答…'
      : "I'm speaking…"
    : liveState === 'listening' || liveState === 'connected'
    ? isZh
      ? '倾听中 — 请直接说话'
      : 'Listening — just speak'
    : liveState === 'connecting'
    ? isZh
      ? '正在启动实时音视频…'
      : 'Connecting…'
    : isZh
    ? '待命中 — 请直接说话'
    : 'Listening — just speak';

  return (
    <div className="w-full max-w-[1200px] mx-auto">
      {/* 1. Top Bar: Back to Home button (Outside above the big card) */}
      <div className="mb-4">
        <button
          onClick={() => {
            stopLiveSession();
            stopCameraStream();
            onBack();
          }}
          id="camera-back-home-btn"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#E1F5EE] text-[#0F6E56] rounded-full font-bold text-sm sm:text-base hover:opacity-90 active:scale-95 transition cursor-pointer shadow-2xs"
          title={isZh ? '返回首页' : 'Back to Home'}
        >
          <ArrowLeft className="w-4 h-4 text-[#0F6E56]" />
          <span>{isZh ? '返回首页' : 'Back to Home'}</span>
        </button>
      </div>

      {/* Unified Big White Card: 白底 #FFFFFF、圆角 24px、1px 极浅边框 #E3EDF7、内边距 28px */}
      <div className="bg-[#FFFFFF] rounded-[24px] border border-[#E3EDF7] p-5 sm:p-[28px] shadow-sm space-y-6">

      {/* 2. Page Title Area & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left Title Area */}
        <div className="flex items-start gap-4">
          <div className="w-[52px] h-[52px] rounded-[14px] bg-[#1D9E75] flex items-center justify-center shrink-0 shadow-sm">
            <Camera className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-[28px] font-bold text-[#1E293B] leading-tight">
              {isZh ? '家电与物品助手' : 'Appliance Assistant'}
            </h1>
            <p className="text-[15px] text-[#64748B] mt-1 leading-normal">
              {isZh
                ? '对准物品直接与我说话，我将为您实时解释看到的内容。'
                : "Point your camera at the item and just talk to me. I'll explain what I see."}
            </p>
          </div>
        </div>

        {/* Right Mode Switcher: "Live" / "Photo" */}
        <div className="flex items-center bg-white border border-[#E3EDF7] p-1 rounded-full shadow-2xs self-start sm:self-center">
          <button
            type="button"
            onClick={() => {
              setInteractionMode('live');
              setCapturedImage(null);
            }}
            id="camera-mode-live-btn"
            className={`px-4 py-1.5 rounded-full font-bold text-sm transition cursor-pointer ${
              interactionMode === 'live'
                ? 'bg-[#1D9E75] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#1E293B]'
            }`}
          >
            Live
          </button>
          <button
            type="button"
            onClick={() => {
              setInteractionMode('photo');
              stopLiveSession();
            }}
            id="camera-mode-photo-btn"
            className={`px-4 py-1.5 rounded-full font-bold text-sm transition cursor-pointer ${
              interactionMode === 'photo'
                ? 'bg-[#1D9E75] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#1E293B]'
            }`}
          >
            Photo
          </button>
        </div>
      </div>

      {/* Hidden file input for gallery upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Error alert if any */}
      {liveError && (
        <div className="bg-rose-50 border border-rose-300 text-rose-800 rounded-2xl p-3.5 flex items-center justify-between text-sm font-semibold shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{liveError}</span>
          </div>
          <button
            onClick={() => setLiveError(null)}
            className="text-xs bg-rose-200 hover:bg-rose-300 px-2.5 py-1 rounded-lg"
          >
            {isZh ? '关闭' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* 3. Left & Right Columns (52% / 48%, 20px gap, equal height) */}
      <div className="flex flex-col lg:flex-row gap-[20px] items-stretch">
        {/* Left Column (52% width): Camera Area */}
        <div className="w-full lg:w-[52%] bg-white rounded-[20px] border border-[#E3EDF7] p-4 flex flex-col justify-between shadow-2xs h-full min-h-[490px] lg:h-[500px]">
          {/* Top Row: "Your camera" and Status Badge */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] text-[#64748B] font-medium">
              {isZh ? '您的摄像头' : 'Your camera'}
            </span>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E1F5EE] text-[#0F6E56] text-[12px] font-semibold">
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'Connected' || connectionStatus === '已连接'
                    ? 'bg-[#0F6E56] animate-pulse'
                    : connectionStatus === 'Connecting…' || connectionStatus === '连接中…'
                    ? 'bg-amber-500 animate-spin'
                    : 'bg-slate-400'
                }`}
              />
              <span>{connectionStatus}</span>
            </div>
          </div>

          {/* Video Preview Box: Fixed height ~300px */}
          <div className="w-full h-[300px] min-h-[300px] max-h-[300px] relative overflow-hidden rounded-[12px] bg-slate-950 flex items-center justify-center border border-slate-200">
            {/* Captured Static Photo in Photo mode */}
            {interactionMode === 'photo' && capturedImage ? (
              <div className="relative w-full h-full flex items-center justify-center bg-slate-900">
                <img
                  src={capturedImage}
                  alt="Captured appliance"
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={handleRetakePhoto}
                  className="absolute top-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isZh ? '重拍' : 'Retake'}</span>
                </button>
              </div>
            ) : (
              /* Live Camera Stream */
              <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  onCanPlay={() => {
                    setCameraActive(true);
                    setIsCameraStarting(false);
                  }}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    cameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                  style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                />

                {/* Starting / Loading State */}
                {(isCameraStarting || (!cameraActive && !cameraError)) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-slate-100 text-slate-600 p-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-xs border border-slate-200">
                      <Camera className="w-6 h-6 text-[#1D9E75]" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      {isZh ? '正在启动摄像头…' : 'Starting camera…'}
                    </p>
                  </div>
                )}

                {/* Camera Error State */}
                {cameraError && !cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-100 text-slate-700 p-4 text-center">
                    <AlertCircle className="w-8 h-8 text-rose-500" />
                    <p className="text-xs sm:text-sm font-semibold max-w-xs">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => startCameraStream(facingMode)}
                      className="mt-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                    >
                      {isZh ? '重试摄像头' : 'Try Again'}
                    </button>
                  </div>
                )}

                {/* Paused Overlay */}
                {isLivePaused && (
                  <div className="absolute inset-0 bg-slate-950/75 flex flex-col items-center justify-center text-white p-4 space-y-2 text-center z-10">
                    <Pause className="w-8 h-8 text-amber-400" />
                    <p className="text-sm font-bold text-amber-300">
                      {isZh ? '音视频已暂停' : 'Stream Paused'}
                    </p>
                    <p className="text-xs text-slate-300">
                      {isZh ? '摄像头画面与声音传输已停止' : 'Camera and voice stopped'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Voice Status Bar (Below Video, 12px gap, height ~56px) */}
          <div
            className={`my-3 h-[56px] rounded-[12px] px-3.5 flex items-center gap-3 transition-colors ${
              isLivePaused
                ? 'bg-slate-100 text-slate-500'
                : 'bg-[#E1F5EE] text-[#085041]'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                isLivePaused
                  ? 'bg-slate-200 text-slate-500'
                  : 'bg-[#0F6E56]/10 text-[#0F6E56]'
              }`}
            >
              {isLivePaused ? (
                <Pause className="w-4 h-4" />
              ) : liveState === 'speaking' ? (
                <Sparkles className="w-4 h-4 animate-spin text-[#0F6E56]" />
              ) : (
                <Mic className="w-4 h-4 animate-pulse text-[#0F6E56]" />
              )}
            </div>

            <span className="text-[16px] font-bold leading-tight truncate">
              {voiceStateText}
            </span>
          </div>

          {/* Control Buttons Row (3 equal-width buttons, 8px gap) */}
          <div className="grid grid-cols-3 gap-2">
            {/* Pause / Resume Button */}
            <button
              type="button"
              onClick={handleTogglePause}
              id="camera-ctrl-pause-btn"
              className={`h-[48px] rounded-[10px] text-[13px] font-bold flex items-center justify-center gap-2 border transition cursor-pointer ${
                isLivePaused
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-[#1E293B] border-[#DCEEE7]'
              }`}
            >
              {isLivePaused ? (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>{isZh ? '继续' : 'Resume'}</span>
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" />
                  <span>{isZh ? '暂停' : 'Pause'}</span>
                </>
              )}
            </button>

            {/* Flip Camera Button */}
            <button
              type="button"
              onClick={handleFlipCamera}
              id="camera-ctrl-flip-btn"
              className="h-[48px] bg-white hover:bg-slate-50 text-[#1E293B] border border-[#DCEEE7] rounded-[10px] text-[13px] font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-[#64748B]" />
              <span>{isZh ? '翻转' : 'Flip'}</span>
            </button>

            {/* Reconnect Button */}
            <button
              type="button"
              onClick={handleReconnect}
              id="camera-ctrl-reconnect-btn"
              className="h-[48px] bg-white hover:bg-slate-50 text-[#1E293B] border border-[#DCEEE7] rounded-[10px] text-[13px] font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-[#1D9E75]" />
              <span>{isZh ? '重连' : 'Reconnect'}</span>
            </button>
          </div>

          {/* In Photo Mode: Extra Snapshot Trigger */}
          {interactionMode === 'photo' && !capturedImage && (
            <div className="mt-2 pt-2 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={handleCapturePhoto}
                className="flex-1 h-[42px] bg-[#1D9E75] hover:bg-[#16815f] text-white rounded-[10px] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>{isZh ? '拍摄单张照片' : 'Capture Photo'}</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 h-[42px] bg-white border border-[#E3EDF7] text-slate-700 hover:bg-slate-50 rounded-[10px] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#1D9E75]" />
                <span>{isZh ? '相册' : 'Upload'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column (48% width): Conversation Area */}
        <div className="w-full lg:w-[48%] bg-white rounded-[20px] border border-[#E3EDF7] p-4 flex flex-col justify-between shadow-2xs h-full min-h-[490px] lg:h-[500px]">
          {/* Top Row: Small Title "Conversation" */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] text-[#64748B] font-medium">
              {isZh ? '对话记录' : 'Conversation'}
            </span>
            {transcripts.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTranscripts([]);
                  setLiveSubtitle('');
                }}
                className="text-[11px] text-[#94A3B8] hover:text-[#64748B] transition cursor-pointer"
              >
                {isZh ? '清空' : 'Clear'}
              </button>
            )}
          </div>

          {/* Middle: Conversation Bubble Stream (Scrollable, flex-1) */}
          <div className="flex-1 min-h-[160px] overflow-y-auto my-2.5 pr-1 space-y-3">
            {transcripts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-400">
                <div className="w-10 h-10 rounded-full bg-[#E1F5EE] text-[#0F6E56] flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-600 max-w-xs">
                  {isZh
                    ? '摄像头已开启，直接开口说话即可实时交谈。'
                    : 'Camera is active. Speak clearly or tap a quick question below.'}
                </p>
                <p className="text-xs text-slate-400">
                  {isZh
                    ? '例如：“这个微波炉怎么热饭？”'
                    : 'E.g., "How do I heat food for 2 minutes?"'}
                </p>
              </div>
            ) : (
              transcripts.map((item) => (
                <div key={item.id} className="w-full flex">
                  {item.sender === 'user' ? (
                    /* User Bubble: Right-aligned, light green #E1F5EE, text #085041 */
                    <div className="ml-auto max-w-[85%] bg-[#E1F5EE] text-[#085041] rounded-[14px] rounded-br-[4px] px-3.5 py-2.5 text-[15px] leading-relaxed shadow-2xs font-medium">
                      {item.text}
                    </div>
                  ) : (
                    /* AI Response: Left-aligned, 28x28 green square + light gray #F8FAF9 card */
                    <div className="mr-auto max-w-[92%] flex items-start gap-2.5">
                      <div className="w-[28px] h-[28px] rounded-[8px] bg-[#1D9E75] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-[#F8FAF9] border border-slate-100 rounded-[14px] rounded-bl-[4px] p-3 text-[15px] text-[#1E293B] leading-[1.6] shadow-2xs">
                        {renderFormattedAiText(item.text)}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={conversationEndRef} />
          </div>

          {/* Real-time Subtitles Bar (Below conversation stream) */}
          <div className="w-full border border-[#E2E8F0] bg-[#FAFAFA] rounded-[10px] px-3 py-2 mb-3">
            <div className="flex items-center gap-1.5 text-[11px] text-[#94A3B8] font-medium leading-none mb-1">
              <Subtitles className="w-3.5 h-3.5 text-[#94A3B8]" />
              <span>{isZh ? '实时字幕' : 'Live subtitles'}</span>
            </div>
            <p className="text-[13px] text-[#64748B] leading-snug truncate font-medium">
              {liveSubtitle ||
                (isZh
                  ? '等待语音转录内容…'
                  : 'Listening for speech…')}
            </p>
          </div>

          {/* Bottom Input Area: Fixed at bottom of right column */}
          <div className="space-y-2">
            {/* Quick Questions Row: 2-3 Capsule Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendPrompt(q.text)}
                  className="px-3 py-1 bg-white border border-[#A7F3D0] hover:bg-[#E1F5EE] active:scale-95 text-[#0F6E56] rounded-full text-[13px] font-semibold transition cursor-pointer shadow-2xs"
                >
                  {q.label}
                </button>
              ))}
            </div>

            {/* Input Box: Height 46px, left keyboard, right green mic button */}
            <div className="relative flex items-center">
              <div className="absolute left-3 pointer-events-none text-[#94A3B8]">
                <Keyboard className="w-4 h-4" />
              </div>

              <input
                type="text"
                value={typedQuestion}
                onChange={(e) => setTypedQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSendPrompt(typedQuestion);
                  }
                }}
                id="camera-typed-question-input"
                placeholder={isZh ? '或者打字输入您的问题…' : 'Or type your question…'}
                className="w-full h-[46px] pl-9 pr-16 bg-white border border-[#E2E8F0] focus:border-[#1D9E75] rounded-[10px] text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none shadow-2xs"
              />

              <div className="absolute right-2 flex items-center gap-1">
                {typedQuestion.trim() ? (
                  <button
                    type="button"
                    onClick={() => handleSendPrompt(typedQuestion)}
                    className="p-1.5 text-white bg-[#1D9E75] hover:bg-[#16815f] rounded-lg transition cursor-pointer"
                    title={isZh ? '发送' : 'Send'}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleVoiceInputClick}
                    id="camera-mic-input-btn"
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      isRecordingSpeech
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'text-[#1D9E75] hover:bg-[#E1F5EE]'
                    }`}
                    title={isZh ? '点击语音输入' : 'Voice Input'}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Disclaimer */}
      <div className="flex items-center justify-center gap-1.5 text-center pt-2 pb-1">
        <Info className="w-4 h-4 text-[#94A3B8] shrink-0" />
        <p className="text-[13px] text-[#94A3B8]">
          {isZh
            ? '此内容仅供 AI 辅助参考。如有疑问，请查阅家电说明书或向值得信赖的人求助。'
            : "This is AI guidance only. Please check your appliance manual or ask someone you trust if you're unsure."}
        </p>
      </div>
    </div>
    </div>
  );
};
