import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, RotateCcw, Square, FastForward, Snail } from 'lucide-react';
import { seniorAudio } from '../services/audio';
import { Language } from '../types';

interface AudioControlBarProps {
  textToRead: string;
  language: Language;
  autoPlay?: boolean;
}

export const AudioControlBar: React.FC<AudioControlBarProps> = ({
  textToRead,
  language,
  autoPlay = true,
}) => {
  const isZh = language === 'zh';
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(seniorAudio.getIsMuted());
  const [speechSpeed, setSpeechSpeed] = useState<'normal' | 'slow'>('normal');

  useEffect(() => {
    const unsubState = seniorAudio.subscribeState((speaking) => {
      setIsSpeaking(speaking);
    });
    const unsubMute = seniorAudio.subscribeMute((muted) => {
      setIsMuted(muted);
    });

    if (autoPlay && textToRead && !seniorAudio.getIsMuted()) {
      seniorAudio.speakText(textToRead, language, speechSpeed);
    }

    return () => {
      unsubState();
      unsubMute();
      seniorAudio.stop();
    };
  }, [textToRead, language]);

  const handlePlayOrResume = () => {
    if (isMuted) {
      seniorAudio.setMuted(false);
    }
    seniorAudio.speakText(textToRead, language, speechSpeed);
  };

  const handleStop = () => {
    seniorAudio.stop();
  };

  const handleToggleSpeed = () => {
    const nextSpeed = speechSpeed === 'normal' ? 'slow' : 'normal';
    setSpeechSpeed(nextSpeed);
    if (!isMuted) {
      seniorAudio.speakText(textToRead, language, nextSpeed);
    }
  };

  return (
    <div
      id="senior-audio-player-bar"
      className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 my-3"
    >
      {/* Audio Status & Waves */}
      <div className="flex items-center gap-3.5 w-full sm:w-auto">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0 ${
            isMuted
              ? 'bg-rose-50 text-rose-600 border border-rose-200'
              : isSpeaking
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5" />
          ) : isSpeaking ? (
            <Volume2 className="w-5 h-5 animate-pulse" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base sm:text-lg text-slate-900">
              {isMuted
                ? isZh
                  ? '当前处于静音模式'
                  : 'Sound is muted'
                : isSpeaking
                ? isZh
                  ? '正在语音播报中...'
                  : 'Reading aloud now...'
                : isZh
                ? '语音播报已就绪'
                : 'Voice audio ready'}
            </span>
            {isSpeaking && !isMuted && (
              <span className="flex gap-0.5 items-end h-3.5">
                <span className="w-1 bg-emerald-500 rounded-full h-2 animate-bounce" />
                <span className="w-1 bg-emerald-500 rounded-full h-3.5 animate-bounce delay-100" />
                <span className="w-1 bg-emerald-500 rounded-full h-2.5 animate-bounce delay-200" />
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {isMuted
              ? isZh
                ? '在安静场所可静音阅读；点击右侧按钮可开启语音'
                : 'Quiet mode active. Tap play to unmute and listen'
              : isZh
              ? '清晰慢速朗读，点击按钮可暂停、重听或放慢语速'
              : 'Senior voice tuned. Tap to replay, pause, or slow down'}
          </p>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center flex-wrap justify-end gap-2 w-full sm:w-auto">
        {/* Play / Replay / Unmute */}
        <button
          onClick={handlePlayOrResume}
          id="audio-play-btn"
          className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm sm:text-base shadow-xs transition active:scale-95 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>
            {isMuted
              ? isZh
                ? '开启声音'
                : 'Turn Sound On'
              : isSpeaking
              ? isZh
                ? '重听'
                : 'Replay'
              : isZh
              ? '朗读'
              : 'Play Voice'}
          </span>
        </button>

        {/* Stop */}
        {isSpeaking && (
          <button
            onClick={handleStop}
            id="audio-stop-btn"
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-sm sm:text-base transition active:scale-95 cursor-pointer"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>{isZh ? '暂停' : 'Pause'}</span>
          </button>
        )}

        {/* Speed Toggle */}
        <button
          onClick={handleToggleSpeed}
          id="audio-speed-btn"
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs sm:text-sm border transition active:scale-95 cursor-pointer ${
            speechSpeed === 'slow'
              ? 'bg-amber-50 text-amber-900 border-amber-300'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
          title={isZh ? '切换播报语速' : 'Toggle voice speed'}
        >
          {speechSpeed === 'slow' ? (
            <>
              <Snail className="w-4 h-4 text-amber-700" />
              <span>{isZh ? '慢速中' : 'Slow'}</span>
            </>
          ) : (
            <>
              <FastForward className="w-4 h-4 text-slate-500" />
              <span>{isZh ? '慢速朗读' : 'Slower'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
