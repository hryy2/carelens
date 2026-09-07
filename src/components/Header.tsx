import React, { useState, useEffect } from "react";
import { Sparkles, Globe, Volume2, VolumeX, Home } from "lucide-react";
import { AppMode, FontSize, Language } from "../types";
import { seniorAudio } from "../services/audio";

interface HeaderProps {
  currentMode: AppMode;
  onNavigateHome: () => void;
  language: Language;
  onToggleLanguage: () => void;
  fontSize: FontSize;
  onChangeFontSize: (size: FontSize) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentMode,
  onNavigateHome,
  language,
  onToggleLanguage,
  fontSize,
  onChangeFontSize,
}) => {
  const isZh = language === "zh";
  const [isMuted, setIsMuted] = useState<boolean>(seniorAudio.getIsMuted());

  useEffect(() => {
    const unsub = seniorAudio.subscribeMute((muted) => {
      setIsMuted(muted);
    });
    return unsub;
  }, []);

  const handleToggleMute = () => {
    const nextMuted = seniorAudio.toggleMute();
    setIsMuted(nextMuted);
    if (!nextMuted) {
      seniorAudio.speakText(
        isZh ? "语音播报已开启。" : "Voice sound enabled.",
        language,
      );
    }
  };

  return (
    <header className="bg-white/95 backdrop-blur-xs text-slate-900 shadow-2xs border-b border-amber-200/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Home */}
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateHome}
            id="header-home-btn"
            className="flex items-center gap-3 text-left focus:outline-none focus-visible:ring-3 focus-visible:ring-emerald-500 rounded-2xl p-1 transition hover:bg-slate-50 cursor-pointer"
            title={isZh ? "返回主页" : "Return to Home"}
          >
            {/* Swirl / Leaf Lens Logo */}
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-400 to-emerald-300 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-2xl sm:text-[26px] tracking-tight text-slate-900">
                  CareLens
                </span>
                <span className="text-[11px] sm:text-xs bg-[#FFEDD5] text-[#C2410C] font-bold px-2 py-0.5 rounded-full">
                  NZ Senior AI
                </span>
              </div>
              <p className="text-xs sm:text-[13px] text-slate-500 font-medium">
                {isZh
                  ? "您的日常好帮手，生活更安全、更轻松"
                  : "Your Everyday Helper for a Safer, Easier Life"}
              </p>
            </div>
          </button>
        </div>

        {/* Action Controls: Font Size, Language & Sound Mute */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          {/* Home Button if not on home */}
          {currentMode !== "home" && (
            <button
              onClick={onNavigateHome}
              id="nav-home-btn"
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs sm:text-sm border border-slate-200 transition active:scale-95 cursor-pointer"
            >
              <Home className="w-4 h-4 text-emerald-600" />
              <span>{isZh ? "首页" : "Home"}</span>
            </button>
          )}

          {/* Font Scaler (A / A+ / A++) */}
          <div
            className="flex items-center bg-slate-100/90 rounded-xl p-1 border border-slate-200 shadow-2xs"
            role="group"
            aria-label={isZh ? "字号切换" : "Font size toggle"}
          >
            <button
              onClick={() => onChangeFontSize("normal")}
              id="font-size-normal-btn"
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                fontSize === "normal"
                  ? "bg-white text-slate-900 font-black shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title={isZh ? "标准字号 (A)" : "Standard Font Size (A)"}
            >
              A
            </button>
            <button
              onClick={() => onChangeFontSize("large")}
              id="font-size-large-btn"
              className={`px-3 py-1 rounded-lg text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                fontSize === "large"
                  ? "bg-white text-slate-900 font-black shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title={isZh ? "大字号 (A+)" : "Large Font Size (A+)"}
            >
              A+
            </button>
            <button
              onClick={() => onChangeFontSize("extra-large")}
              id="font-size-xlarge-btn"
              className={`px-3 py-1 rounded-lg text-sm font-black transition-all cursor-pointer ${
                fontSize === "extra-large"
                  ? "bg-white text-slate-900 font-black shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title={isZh ? "特大字号 (A++)" : "Extra Large Font Size (A++)"}
            >
              A++
            </button>
          </div>

          {/* Language Switch Pill */}
          {/* Language Switch — segmented control */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Globe className="w-4 h-4 text-slate-500 ml-1.5 mr-0.5 shrink-0" />
            <button
              onClick={() => {
                if (isZh) onToggleLanguage();
              }}
              id="lang-en-btn"
              className={`px-2.5 py-1 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                !isZh
                  ? "bg-white text-slate-900 font-black shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Switch to English"
            >
              EN
            </button>
            <button
              onClick={() => {
                if (!isZh) onToggleLanguage();
              }}
              id="lang-zh-btn"
              className={`px-2.5 py-1 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                isZh
                  ? "bg-white text-slate-900 font-black shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="切换至中文"
            >
              中文
            </button>
          </div>

          {/* Global Mute / Unmute Button */}
          <button
            onClick={handleToggleMute}
            id="global-mute-btn"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs sm:text-sm transition min-w-[130px] justify-center active:scale-95 border cursor-pointer ${
              isMuted
                ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 shadow-2xs"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs"
            }`}
            title={
              isMuted
                ? isZh
                  ? "当前已静音（点击开启声音）"
                  : "Currently Muted (Tap to turn sound on)"
                : isZh
                  ? "点击静音（适合医院/图书馆等静音场所）"
                  : "Mute Voice (For quiet places like hospitals/libraries)"
            }
          >
            {isMuted ? (
              <>
                <VolumeX className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{isZh ? "已静音" : "Muted"}</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{isZh ? "声音" : "Sound"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};