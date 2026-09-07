import React from 'react';
import { Mic, MicOff, Loader2, Sparkles } from 'lucide-react';

type Theme = 'blue' | 'orange' | 'green';

const THEMES = {
  blue:   { main: '#2B7FD4', hover: '#236bb3', tint: '#F1F7FE', border: '#E2E8F0' },
  orange: { main: '#E8590C', hover: '#c94a08', tint: '#FEF6F0', border: '#F0E4DA' },
  green:  { main: '#1D9E75', hover: '#178562', tint: '#F0FAF6', border: '#DCEEE7' },
};

interface QuestionInputProps {
  theme: Theme;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (q?: string) => void;
  onVoiceInput: () => void;
  isRecording: boolean;
  isBusy: boolean;
  placeholder: string;
  quickQuestions: string[];
  quickLabel: string;
  submitLabel: string;
  busyLabel: string;
  disabled?: boolean;
}

export const QuestionInput: React.FC<QuestionInputProps> = ({
  theme, value, onChange, onSubmit, onVoiceInput,
  isRecording, isBusy, placeholder, quickQuestions,
  quickLabel, submitLabel, busyLabel, disabled,
}) => {
  const c = THEMES[theme];

  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-2.5">
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
            placeholder={placeholder}
            className="w-full h-[56px] pl-4 pr-12 bg-white rounded-[14px] border text-[#1E293B] text-[15px] sm:text-[16px] font-medium placeholder:text-[#94A3B8] outline-none transition shadow-2xs"
            style={{ borderColor: c.border }}
          />
          <button
            type="button"
            onClick={onVoiceInput}
            className={`absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-[10px] flex items-center justify-center transition cursor-pointer ${isRecording ? 'animate-pulse' : ''}`}
            style={isRecording
              ? { background: '#f43f5e', color: '#fff' }
              : { color: '#64748B' }}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        </div>

        <button
          type="button"
          onClick={() => onSubmit()}
          disabled={isBusy || disabled}
          className="shrink-0 h-[56px] px-6 min-w-[180px] text-white rounded-[14px] text-[16px] font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer whitespace-nowrap active:scale-98 disabled:opacity-60"
          style={{ background: c.main }}
        >
          {isBusy ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="hidden sm:inline">{busyLabel}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span className="hidden sm:inline">{submitLabel}</span>
            </>
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-[#64748B] font-semibold mr-1">{quickLabel}</span>
        {quickQuestions.map((q, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { onChange(q); onSubmit(q); }}
            className="bg-white border text-[13px] font-semibold px-3.5 py-1.5 rounded-full transition cursor-pointer shadow-2xs active:scale-95"
            style={{ borderColor: c.main, color: c.main }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
};