import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, Volume2, AlertCircle } from 'lucide-react';
import { AnalysisResult, AppMode, FontSize, Language, PresetSample } from './types';
import { Header } from './components/Header';
import { HomeCards } from './components/HomeCards';
import { CameraAssistant } from './components/CameraAssistant';
import { DocumentExplainer } from './components/DocumentExplainer';
import { ScamChecker } from './components/ScamChecker';
import { ResultView } from './components/ResultView';
import { analyzeContent, translateResult } from './services/api';
import { seniorAudio } from './services/audio';

export default function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>('home');
  const [language, setLanguage] = useState<Language>('en');
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    try {
      const saved = localStorage.getItem('carelens_font_size') as FontSize;
      if (saved && (saved === 'normal' || saved === 'large' || saved === 'extra-large')) {
        return saved;
      }
    } catch (e) {
      // ignore
    }
    return 'large';
  });
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<PresetSample | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFollowUpLoading, setIsFollowUpLoading] = useState<boolean>(false);

  // Keep track of the raw analysis payload so switching language can re-analyze freshly with native AI generation
  const lastAnalysisPayloadRef = React.useRef<{
    mode: AppMode;
    imageBase64?: string;
    text?: string;
    question?: string;
  } | null>(null);

  const isZh = language === 'zh';

  // Synchronize font size across entire DOM documentElement and persist
  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize);
    document.body.setAttribute('data-font-size', fontSize);
    const zoomValue = fontSize === 'normal' ? '1' : fontSize === 'large' ? '1.15' : '1.32';
    (document.documentElement.style as any).zoom = zoomValue;
    try {
      localStorage.setItem('carelens_font_size', fontSize);
    } catch (e) {
      // ignore
    }
  }, [fontSize]);

  const handleFontSizeChange = (newSize: FontSize) => {
    setFontSize(newSize);
    if (newSize === 'extra-large') {
      seniorAudio.speakText(isZh ? '已开启特大字号' : 'Switched to extra large font size', language);
    } else if (newSize === 'large') {
      seniorAudio.speakText(isZh ? '已开启大字号' : 'Switched to large font size', language);
    } else {
      seniorAudio.speakText(isZh ? '已开启标准字号' : 'Switched to standard font size', language);
    }
  };

  const handleSelectMode = (mode: AppMode) => {
    setSelectedPreset(null);
    setCurrentResult(null);
    setErrorMessage(null);
    setCurrentMode(mode);

    if (mode === 'camera') {
      seniorAudio.speakText(
        isZh ? '家电与物品助手已打开。请对准物品拍照提问。' : 'Appliance assistant opened. Point camera and ask.',
        language
      );
    } else if (mode === 'document') {
      seniorAudio.speakText(
        isZh ? '信件解读已打开。请上传信件或账单照片。' : 'Document reader opened. Please upload letter photo.',
        language
      );
    } else if (mode === 'scam') {
      seniorAudio.speakText(
        isZh ? '防诈骗检查已打开。请粘贴短信或上传截图。' : 'Scam guard opened. Paste message to check.',
        language
      );
    }
  };

  const handleSelectPreset = (preset: PresetSample) => {
    setSelectedPreset(preset);
    setCurrentResult(null);
    setErrorMessage(null);
    setCurrentMode(preset.mode);
  };

  const handleNavigateHome = () => {
    seniorAudio.stop();
    setSelectedPreset(null);
    setCurrentResult(null);
    setErrorMessage(null);
    setCurrentMode('home');
  };

  const handleAnalyze = async (data: {
    imageBase64?: string;
    text?: string;
    question?: string;
  }) => {
    setIsLoading(true);
    setErrorMessage(null);
    lastAnalysisPayloadRef.current = {
      mode: currentMode,
      imageBase64: data.imageBase64,
      text: data.text,
      question: data.question,
    };

    const spokenLoadingMsg =
      currentMode === 'camera'
        ? isZh
          ? '正在识别家电面板与按键，请稍等...'
          : 'Examining appliance panel buttons, please wait...'
        : currentMode === 'document'
        ? isZh
          ? '正在仔细阅读官方信件与账单，请稍等...'
          : 'Reading letter details and due dates, please wait...'
        : isZh
        ? '正在核验短信网址与安全风险，请稍等...'
        : 'Verifying link security and scam indicators, please wait...';

    setLoadingMessage(spokenLoadingMsg);
    seniorAudio.speakText(spokenLoadingMsg, language);

    try {
      const result = await analyzeContent({
        mode: currentMode,
        language,
        imageBase64: data.imageBase64,
        text: data.text,
        question: data.question,
      });

      setCurrentResult(result);
    } catch (err: any) {
      console.error('Analysis error:', err);
      const errMsg =
        err.message ||
        (isZh
          ? '分析遇到了一点小问题，请再试一次。'
          : 'Encountered an issue analyzing the item. Please try again.');
      setErrorMessage(errMsg);
      seniorAudio.speakText(errMsg, language);
    } finally {
      setIsLoading(false);
    }
  };

  // Follow-up question on current result
  const handleFollowUpQuestion = async (question: string) => {
    if (!currentResult) return;
    setIsFollowUpLoading(true);
    try {
      const result = await analyzeContent({
        mode: currentResult.mode,
        language,
        question: `Previous Context: ${currentResult.title}. ${currentResult.summary}. User follow-up question: ${question}`,
      });
      lastAnalysisPayloadRef.current = {
        mode: currentResult.mode,
        question: `Previous Context: ${currentResult.title}. ${currentResult.summary}. User follow-up question: ${question}`,
      };
      setCurrentResult(result);
    } catch (err: any) {
      console.error('Follow-up error:', err);
    } finally {
      setIsFollowUpLoading(false);
    }
  };

  const handleToggleLanguage = async () => {
    const nextLanguage: Language = language === 'en' ? 'zh' : 'en';
    const isNextZh = nextLanguage === 'zh';
    setLanguage(nextLanguage);

    // If an analysis result is currently open, translate it seamlessly into the new language
    if (currentResult) {
      setIsLoading(true);
      const switchMsg = isNextZh
        ? '正在为您以中文重新解读并播报内容...'
        : 'Translating explanation to English...';
      setLoadingMessage(switchMsg);
      seniorAudio.speakText(switchMsg, nextLanguage);

      try {
        const translated = await translateResult(currentResult, nextLanguage);
        setCurrentResult(translated);
      } catch (err: any) {
        console.warn('Direct translation failed, attempting re-analysis in target language:', err);
        try {
          if (
            lastAnalysisPayloadRef.current &&
            (lastAnalysisPayloadRef.current.imageBase64 ||
              lastAnalysisPayloadRef.current.text ||
              lastAnalysisPayloadRef.current.question)
          ) {
            const reAnalyzed = await analyzeContent({
              mode: lastAnalysisPayloadRef.current.mode || currentResult.mode,
              language: nextLanguage,
              imageBase64: lastAnalysisPayloadRef.current.imageBase64,
              text: lastAnalysisPayloadRef.current.text,
              question: lastAnalysisPayloadRef.current.question,
            });
            setCurrentResult(reAnalyzed);
          } else {
            throw err;
          }
        } catch (reErr: any) {
          console.error('Language switch translation failed completely:', reErr);
          const announceMsg = isNextZh ? '已切换为中文界面' : 'Language switched to English';
          seniorAudio.speakText(announceMsg, nextLanguage);
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      const announceMsg = isNextZh ? '已切换为中文语音与界面' : 'Language switched to English';
      seniorAudio.speakText(announceMsg, nextLanguage);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col ${
        currentMode === 'document' || currentMode === 'camera' || currentMode === 'scam'
          ? 'bg-[#F5F9FD]'
          : 'bg-[#FDF5DF]'
      } text-slate-900 transition-all font-sans`}
    >
      {/* Accessible Header */}
      <Header
        currentMode={currentMode}
        onNavigateHome={handleNavigateHome}
        language={language}
        onToggleLanguage={handleToggleLanguage}
        fontSize={fontSize}
        onChangeFontSize={handleFontSizeChange}
      />

      {/* Main Content Area */}
      <main
        className={`flex-1 w-full mx-auto ${
          currentMode === 'document' || currentMode === 'scam' || currentMode === 'camera'
            ? 'max-w-[1200px] px-6 py-6'
            : 'max-w-6xl p-4 sm:p-6 lg:p-8'
        }`}
      >
        {/* Error Alert if any */}
        {errorMessage && (
          <div className="mb-6 bg-rose-100 border-2 border-rose-400 text-rose-950 rounded-2xl p-4 sm:p-5 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
            <div className="flex-1 font-bold">{errorMessage}</div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs bg-rose-200 hover:bg-rose-300 font-bold px-3 py-1.5 rounded-lg"
            >
              {isZh ? '关闭' : 'Dismiss'}
            </button>
          </div>
        )}

        {/* Loading Overlay State for Senior Reassurance */}
        {isLoading ? (
          <div className="py-16 text-center space-y-6 max-w-lg mx-auto bg-white rounded-3xl p-8 border-3 border-amber-300 shadow-xl">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500 text-slate-950 flex items-center justify-center animate-bounce shadow-lg">
              <Loader2 className="w-12 h-12 animate-spin" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-950">
                {isZh ? '正在为您仔细分析...' : 'Examining for you...'}
              </h2>
              <p className="text-base sm:text-lg text-slate-700 font-bold leading-relaxed">
                {loadingMessage}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-amber-800 font-bold text-sm bg-amber-100 py-2.5 px-4 rounded-xl">
              <Volume2 className="w-5 h-5 animate-pulse" />
              <span>{isZh ? '稍后将为您自动语音播报' : 'Voice audio will play automatically'}</span>
            </div>
          </div>
        ) : currentResult && currentMode !== 'document' && currentMode !== 'scam' ? (
          /* Result View */
          <ResultView
            result={currentResult}
            language={language}
            onBack={() => setCurrentResult(null)}
            onHome={handleNavigateHome}
            onFollowUpQuestion={handleFollowUpQuestion}
            isFollowUpLoading={isFollowUpLoading}
          />
        ) : (
          /* Active Screen by Mode */
          <>
            {currentMode === 'home' && (
              <HomeCards
                language={language}
                onSelectMode={handleSelectMode}
                onSelectPreset={handleSelectPreset}
              />
            )}

            {currentMode === 'camera' && (
              <CameraAssistant
                language={language}
                onBack={handleNavigateHome}
                onAnalyze={handleAnalyze}
                initialPreset={selectedPreset}
              />
            )}

            {currentMode === 'document' && (
              <DocumentExplainer
                language={language}
                onBack={handleNavigateHome}
                initialPreset={selectedPreset}
                currentResult={currentResult}
                onResultChange={(result) => setCurrentResult(result)}
              />
            )}

            {currentMode === 'scam' && (
              <ScamChecker
                language={language}
                onBack={handleNavigateHome}
                initialPreset={selectedPreset}
                currentResult={currentResult}
                onResultChange={(result, payload) => {
                  setCurrentResult(result);
                  if (payload) {
                    lastAnalysisPayloadRef.current = {
                      mode: 'scam',
                      imageBase64: payload.imageBase64,
                      text: payload.text,
                      question: payload.question,
                    };
                  }
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Senior-Friendly Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 border-t border-slate-800 text-center px-4">
        <div className="max-w-4xl mx-auto space-y-2">
          <p className="font-extrabold text-sm sm:text-base text-slate-200">
            CareLens • {isZh ? '新西兰老年人智慧生活助手' : 'AI Life Companion for New Zealand Seniors'}
          </p>
          <p className="text-xs sm:text-sm text-slate-400">
            {isZh
              ? '专门设计用于看懂家电使用方法、读懂政府通知信件、防范可疑网络短信诈骗。'
              : 'Designed with ultra-large text, high contrast, and voice-first guidance for clear, safe daily living.'}
          </p>
        </div>
      </footer>
    </div>
  );
}
