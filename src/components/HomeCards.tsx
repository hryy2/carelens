import React, { useState, useRef } from 'react';
import {
  Camera,
  FileText,
  ShieldAlert,
  ArrowRight,
  ChevronRight,
  Zap,
  Upload,
  Sparkles,
} from 'lucide-react';
import { AppMode, Language, PresetSample } from '../types';
import { PRESET_SAMPLES } from '../data/presets';
import defaultHeroIllustration from '../assets/images/home_illustration_1788569782594.jpg';

interface HomeCardsProps {
  language: Language;
  onSelectMode: (mode: AppMode) => void;
  onSelectPreset: (preset: PresetSample) => void;
}

export const HomeCards: React.FC<HomeCardsProps> = ({
  language,
  onSelectMode,
  onSelectPreset,
}) => {
  const isZh = language === 'zh';
  const [activePresetTab, setActivePresetTab] = useState<'all' | 'camera' | 'document' | 'scam'>('all');

  // Support user uploading their own custom illustration (like home.png) directly
  const [customIllustration, setCustomIllustration] = useState<string | null>(() => {
    try {
      return localStorage.getItem('carelens_custom_hero_illustration');
    } catch {
      return null;
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCustomIllustration(dataUrl);
      try {
        localStorage.setItem('carelens_custom_hero_illustration', dataUrl);
      } catch (err) {
        console.warn('Unable to persist custom illustration in localStorage:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetIllustration = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomIllustration(null);
    try {
      localStorage.removeItem('carelens_custom_hero_illustration');
    } catch {}
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const displayedPresets =
    activePresetTab === 'all'
      ? PRESET_SAMPLES
      : PRESET_SAMPLES.filter((p) => p.mode === activePresetTab);

  return (
    <div className="space-y-8 sm:space-y-10 py-2 sm:py-4">
      {/* HERO SECTION: Left Headline & Subtitle, Right Warm Elderly Couple Illustration */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center pt-2 pb-2">
        {/* Left Column: Friendly Warm Greeting & Description */}
        <div className="lg:col-span-7 space-y-4 text-left">
          <div className="space-y-1 sm:space-y-2">
            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-black text-slate-900 tracking-tight leading-[1.12]">
              {isZh ? '您好！' : 'Hello!'}
            </h1>
            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-black text-slate-900 tracking-tight leading-[1.16]">
              {isZh ? '今天有什么可以帮您？' : 'How can I help you today?'}
            </h2>
          </div>

          <p className="text-base sm:text-lg lg:text-[19px] text-slate-700 font-medium leading-relaxed max-w-xl pt-1">
            {isZh
              ? '拍张照片、上传文件、粘贴短信，或者直接开口说话。我会为您清晰讲解，帮您守护日常生活与资金安全。'
              : "Take a photo, upload a document, paste a message or just speak. I'll explain it clearly and help you stay safe."}
          </p>

          {/* Quick Voice Prompt & NZ Senior Companion badge */}
          <div className="inline-flex items-center gap-2 pt-1 text-xs sm:text-sm font-semibold text-amber-900 bg-amber-100/70 px-3.5 py-1.5 rounded-full border border-amber-300/60 shadow-2xs">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {isZh
                ? '大字号、温和语音播报，专为新西兰长者贴心设计'
                : 'Large text & warm voice guidance tailored for NZ seniors'}
            </span>
          </div>
        </div>

        {/* Right Column: Illustration blending seamlessly into the warm yellow background */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end">
          <div className="relative w-full max-w-[440px] aspect-[3/2] flex items-center justify-center group">
            {/* Subtle soft organic shape behind the illustration */}
            <div className="absolute inset-2 -z-10 bg-gradient-to-tr from-emerald-100/40 via-amber-100/50 to-orange-100/30 rounded-[36px] blur-xs transform -rotate-1 scale-95" />

            {/* Illustration Image with mix-blend-multiply to blend perfectly on yellow background */}
            <div className="w-full h-full relative flex items-center justify-center">
              <img
                src={customIllustration || defaultHeroIllustration}
                alt={isZh ? 'CareLens 关怀相伴' : 'CareLens Senior Companion'}
                className="w-full h-full object-contain mix-blend-multiply drop-shadow-xs transition-transform duration-500 group-hover:scale-[1.02]"
                referrerPolicy="no-referrer"
              />

              {/* Upload/Replace Overlay Button (Convenient for user to load original home.png if desired) */}
              <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 backdrop-blur-xs rounded-xl p-1 shadow-sm border border-amber-200/80 flex items-center gap-1">
                <label
                  htmlFor="hero-illustration-upload"
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-emerald-700 px-2 py-1 bg-amber-50 hover:bg-emerald-50 rounded-lg cursor-pointer transition"
                  title={isZh ? '点击上传您本地的 home.png 插画' : 'Upload custom illustration'}
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isZh ? '更换插画' : 'Upload image'}</span>
                </label>
                <input
                  id="hero-illustration-upload"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {customIllustration && (
                  <button
                    onClick={handleResetIllustration}
                    className="text-[11px] font-bold text-slate-500 hover:text-rose-600 px-1.5 py-1 rounded-lg transition cursor-pointer"
                    title={isZh ? '恢复默认插画' : 'Reset illustration'}
                  >
                    {isZh ? '还原' : 'Reset'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 CORE ACTION CARDS: Crisp white cards on warm yellow background */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-7">
        {/* CARD 1: UNDERSTAND AN ITEM (GREEN ACCENT) */}
        <div
          id="card-camera-mode"
          className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-emerald-100 hover:border-emerald-400/80 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between group cursor-pointer"
          onClick={() => onSelectMode('camera')}
        >
          <div className="space-y-4">
            {/* Green Rounded Square Icon */}
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Camera className="w-6 h-6 text-white" />
            </div>

            <div>
              <div className="inline-block text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md mb-1.5 border border-emerald-200/60">
                {isZh ? '实时视频 • 拍照指导' : 'Live Video & Photo Q&A'}
              </div>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight group-hover:text-emerald-800 transition-colors">
                {isZh ? '看懂物品与家电' : 'Understand an Item'}
              </h3>
              <p className="text-slate-600 text-[15px] font-medium leading-relaxed mt-2.5">
                {isZh
                  ? '手机摄像头对准微波炉、空调热泵遥控器或药瓶，开口提问即可获得通俗易懂的逐步操作指导。'
                  : 'Point your camera at appliances, heat pump remotes, or medicine bottles. Get clear voice guidance step-by-step.'}
              </p>
            </div>
          </div>

          <div className="pt-6 mt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectMode('camera');
              }}
              id="btn-open-camera-main"
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-base shadow-xs flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
            >
              <span>{isZh ? '拍照提问' : 'Take a Photo'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* CARD 2: READ LETTERS & BILLS (BLUE ACCENT) */}
        <div
          id="card-document-mode"
          className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-sky-100 hover:border-sky-400/80 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between group cursor-pointer"
          onClick={() => onSelectMode('document')}
        >
          <div className="space-y-4">
            {/* Blue Rounded Square Icon */}
            <div className="w-12 h-12 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <FileText className="w-6 h-6 text-white" />
            </div>

            <div>
              <div className="inline-block text-[11px] font-bold uppercase tracking-wider text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md mb-1.5 border border-sky-200/60">
                {isZh ? '拍照解读 • 语音朗读' : 'Scan & Explain Aloud'}
              </div>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight group-hover:text-sky-800 transition-colors">
                {isZh ? '官方信件与账单' : 'Read Letters & Bills'}
              </h3>
              <p className="text-slate-600 text-[15px] font-medium leading-relaxed mt-2.5">
                {isZh
                  ? '工收局(WINZ)补助信、医院门诊单、电费单或市政通知，拍照上传为您提炼关键金额、日期与行动。'
                  : 'Upload or photograph WINZ letters, hospital clinic notices, or power bills. Extract key dates, amounts, and actions.'}
              </p>
            </div>
          </div>

          <div className="pt-6 mt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectMode('document');
              }}
              id="btn-open-document-main"
              className="w-full py-3.5 px-4 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold text-base shadow-xs flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{isZh ? '上传文件' : 'Upload a Document'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* CARD 3: CHECK SCAM & MESSAGES (ORANGE ACCENT) */}
        <div
          id="card-scam-mode"
          className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-orange-100 hover:border-orange-400/80 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between group cursor-pointer"
          onClick={() => onSelectMode('scam')}
        >
          <div className="space-y-4">
            {/* Orange Rounded Square Icon */}
            <div className="w-12 h-12 rounded-xl bg-[#EA580C] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>

            <div>
              <div className="inline-block text-[11px] font-bold uppercase tracking-wider text-orange-800 bg-orange-50 px-2 py-0.5 rounded-md mb-1.5 border border-orange-200/60">
                {isZh ? '风险排查 • 防诈守护' : 'Risk Check & Fraud Guard'}
              </div>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight group-hover:text-orange-800 transition-colors">
                {isZh ? '核验短信与防诈' : 'Check Scam Messages'}
              </h3>
              <p className="text-slate-600 text-[15px] font-medium leading-relaxed mt-2.5">
                {isZh
                  ? '收到催缴高速费、邮政补交包裹费或退税可疑短信？粘贴文字或截图，AI帮您鉴别真伪并指导防骗。'
                  : 'Received suspicious texts about motorway toll fees, parcel delays, or bank links? Check risks safely.'}
              </p>
            </div>
          </div>

          <div className="pt-6 mt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectMode('scam');
              }}
              id="btn-open-scam-main"
              className="w-full py-3.5 px-4 bg-[#EA580C] hover:bg-[#C2410C] text-white rounded-xl font-bold text-base shadow-xs flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>{isZh ? '核验短信' : 'Check a Message'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* PRESET SCENARIOS SECTION: Clean white container with NZ examples */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 border border-amber-200/70 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-amber-100">
          <div>
            <h4 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-600" />
              <span>{isZh ? '新西兰常见生活范例一键体验' : 'Try Real New Zealand Examples'}</span>
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
              {isZh
                ? '点击任意范例卡片，无需打字即可直接体验 AI 图像识别与语音解读：'
                : 'Select any real-life scenario below to test instant AI visual recognition & audio explanation:'}
            </p>
          </div>

          {/* Preset Category Filter Tabs */}
          <div className="flex flex-wrap gap-1 bg-amber-50/80 p-1 rounded-xl border border-amber-200/60">
            <button
              onClick={() => setActivePresetTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activePresetTab === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isZh ? '全部' : 'All'}
            </button>
            <button
              onClick={() => setActivePresetTab('camera')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activePresetTab === 'camera'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isZh ? '家电操作' : 'Appliances'}
            </button>
            <button
              onClick={() => setActivePresetTab('document')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activePresetTab === 'document'
                  ? 'bg-white text-sky-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isZh ? '信件账单' : 'Letters & Bills'}
            </button>
            <button
              onClick={() => setActivePresetTab('scam')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activePresetTab === 'scam'
                  ? 'bg-white text-orange-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isZh ? '可疑短信' : 'Scam Texts'}
            </button>
          </div>
        </div>

        {/* Preset Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {displayedPresets.map((preset) => {
            const badgeColor =
              preset.mode === 'camera'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : preset.mode === 'document'
                ? 'bg-sky-50 text-sky-700 border-sky-200'
                : 'bg-orange-50 text-orange-700 border-orange-200';

            return (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset)}
                className="group text-left p-4 rounded-2xl bg-amber-50/40 hover:bg-white border border-amber-200/60 hover:border-emerald-400 shadow-2xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between space-y-2.5 cursor-pointer"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${badgeColor}`}>
                      {preset.category}
                    </span>
                    <span className="text-xs text-slate-400 group-hover:text-emerald-600 font-semibold flex items-center gap-0.5">
                      {isZh ? '立即体验' : 'Try sample'}
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>

                  <h5 className="text-base font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                    {preset.title[language]}
                  </h5>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {preset.description[language]}
                  </p>
                </div>

                <div className="pt-2 border-t border-amber-200/50 text-xs font-medium text-slate-500 italic truncate">
                  "{preset.defaultQuestion?.[language]}"
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
