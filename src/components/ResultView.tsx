import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  HelpCircle,
  Mic,
  MicOff,
  Home,
  User,
  ChevronDown,
  ChevronUp,
  Send,
  Info,
} from 'lucide-react';
import { AnalysisResult, Language } from '../types';
import { AudioControlBar } from './AudioControlBar';
import { seniorAudio } from '../services/audio';

interface ResultViewProps {
  result: AnalysisResult;
  language: Language;
  onBack: () => void;
  onHome: () => void;
  onFollowUpQuestion: (question: string) => void;
  isFollowUpLoading?: boolean;
}

export const ResultView: React.FC<ResultViewProps> = ({
  result,
  language,
  onBack,
  onHome,
  onFollowUpQuestion,
  isFollowUpLoading = false,
}) => {
  const isZh = language === 'zh';
  const [customQuestion, setCustomQuestion] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Full speech script for audio reading
  const speechText = `${result.title}. ${result.summary}. ${
    result.actionSteps && result.actionSteps.length > 0
      ? isZh
        ? `需要您做的事情：${result.actionSteps.join('。 ')}`
        : `What you should do: ${result.actionSteps.join('. ')}`
      : ''
  }`;

  // Check if this result relates to medications
  const isMedicationRelated =
    result.title?.toLowerCase().includes('medicine') ||
    result.title?.toLowerCase().includes('prescription') ||
    result.title?.toLowerCase().includes('pill') ||
    result.title?.includes('药') ||
    result.summary?.toLowerCase().includes('medicine') ||
    result.summary?.toLowerCase().includes('dose') ||
    result.summary?.includes('药') ||
    Boolean(result.userQuestion?.includes('药')) ||
    Boolean(result.userQuestion?.toLowerCase().includes('medicine'));

  const handleVoiceFollowup = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = isZh ? 'zh-CN' : 'en-NZ';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
      seniorAudio.speakText(isZh ? '请问您的问题...' : 'Listening...', language);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setCustomQuestion(transcript);
      setIsRecording(false);
      onFollowUpQuestion(transcript);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const handleSendCustomQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (customQuestion.trim() && !isFollowUpLoading) {
      onFollowUpQuestion(customQuestion.trim());
      setCustomQuestion('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          id="result-back-btn"
          className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-800 rounded-xl font-bold text-sm sm:text-base border border-slate-200 shadow-2xs transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
          <span>{isZh ? '返回上一步' : 'Back'}</span>
        </button>

        <button
          onClick={onHome}
          id="result-home-btn"
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm sm:text-base shadow-xs transition cursor-pointer"
        >
          <Home className="w-4 h-4 text-emerald-400" />
          <span>{isZh ? '返回首页' : 'Home'}</span>
        </button>
      </div>

      {/* Senior Voice Player Bar */}
      <AudioControlBar textToRead={speechText} language={language} autoPlay={true} />

      {/* DIALOGUE-STYLE CONTAINER */}
      <div className="space-y-5">
        {/* 1. USER'S QUESTION BUBBLE */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center gap-2.5 text-slate-500 text-xs sm:text-sm font-bold uppercase tracking-wider">
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <span>{isZh ? '您的提问' : 'Your Question'}</span>
          </div>

          <p className="text-lg sm:text-xl font-bold text-slate-900 pl-9 leading-relaxed">
            {result.userQuestion ||
              (result.mode === 'camera'
                ? isZh
                  ? '请帮我看看这个物品怎么使用？'
                  : 'How do I use this item or appliance?'
                : result.mode === 'document'
                ? isZh
                  ? '请帮我读懂这封信件或账单。'
                  : 'Please explain this letter or bill to me.'
                : isZh
                ? '请帮我核验这条信息是不是诈骗？'
                : 'Is this message or SMS a scam?')}
          </p>
        </div>

        {/* 2. CARELENS ANSWER BUBBLE */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
          {/* AI Header */}
          <div className="flex items-center gap-2.5 text-emerald-700 text-xs sm:text-sm font-black uppercase tracking-wider">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <span>{isZh ? 'CareLens 解答' : 'CareLens Answer'}</span>
          </div>

          {/* Scam Risk Banner (if in scam mode) */}
          {result.mode === 'scam' && (
            <div
              id="scam-risk-banner"
              className={`rounded-2xl p-5 border shadow-2xs ${
                result.riskLevel === 'scam'
                  ? 'bg-rose-50 border-rose-300 text-rose-950'
                  : result.riskLevel === 'caution'
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-950'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    result.riskLevel === 'scam'
                      ? 'bg-rose-600 text-white'
                      : result.riskLevel === 'caution'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {result.riskLevel === 'scam' && <ShieldAlert className="w-7 h-7" />}
                  {result.riskLevel === 'caution' && <AlertTriangle className="w-7 h-7" />}
                  {result.riskLevel === 'safe' && <ShieldCheck className="w-7 h-7" />}
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-black tracking-wider uppercase opacity-80">
                    {isZh ? '诈骗风险评估' : 'Risk Assessment'}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black">
                    {result.riskLevel === 'scam'
                      ? isZh
                        ? '⚠️ 极可能是诈骗信息，切勿理会与点击链接！'
                        : '⚠️ HIGH RISK: Likely a Scam Message!'
                      : result.riskLevel === 'caution'
                      ? isZh
                        ? '⚠️ 可疑信息，请保持警惕'
                        : '⚠️ Caution: Suspicious Message'
                      : isZh
                      ? '✅ 经核实为正规安全信息'
                      : '✅ Safe Official Message'}
                  </h3>
                  {result.riskReason && (
                    <p className="text-sm sm:text-base font-medium mt-1 leading-relaxed opacity-90">
                      {result.riskReason}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CORE CONCLUSION / HEADLINE (PROMINENT AT FRONT) */}
          <div className="space-y-3 pb-2 border-b border-slate-100">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              {result.title}
            </h2>

            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 sm:p-6">
              <span className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-2">
                {isZh ? '核心解答与总结：' : 'Summary in Plain Words:'}
              </span>
              <p className="text-lg sm:text-2xl text-slate-900 font-extrabold leading-relaxed">
                {result.summary}
              </p>
            </div>
          </div>

          {/* MEDICATION SAFETY REMINDER (MANDATORY WHEN MEDICINE IS PRESENT) */}
          {isMedicationRelated && (
            <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 sm:p-5 flex items-start gap-3 text-amber-950">
              <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-sm sm:text-base font-bold leading-relaxed">
                {isZh
                  ? '💡 温馨提示：以上是标签上的文字内容，CareLens 帮您看清楚标签，具体用法用量请务必遵医嘱或咨询药剂师。'
                  : '💡 Notice: This is what the label says. CareLens helps you see what is printed. Please follow your doctor\'s or pharmacist\'s instructions for how to take it.'}
              </div>
            </div>
          )}

          {/* ACTION STEPS (STEP-BY-STEP CHECKLIST FOR SENIORS) */}
          {result.actionSteps && result.actionSteps.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  {isZh ? '您需要做的事情（步骤）：' : 'What You Need to Do (Step-by-Step):'}
                </h3>
              </div>

              <div className="space-y-2.5">
                {result.actionSteps.map((step, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 sm:gap-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 hover:border-emerald-400 transition"
                  >
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-base flex items-center justify-center shrink-0 shadow-xs">
                      {index + 1}
                    </div>
                    <p className="text-base sm:text-lg text-slate-800 font-bold leading-relaxed pt-0.5">
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KEY DETAILS GRID (IF ANY) */}
          {result.keyDetails && Object.keys(result.keyDetails).length > 0 && (
            <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3">
              <h4 className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wider">
                {isZh ? '📋 关键信息一览' : '📋 Key Information Extracted'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(result.keyDetails).map(([key, val]) => (
                  <div key={key} className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-xs font-semibold text-slate-500 block capitalize">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <span className="text-base sm:text-lg font-black text-slate-900">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DETAILED EXPLANATION (COLLAPSIBLE TO KEEP IT CLEAN) */}
          {result.detailedExplanation && (
            <div className="border-t border-slate-100 pt-4">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs sm:text-sm font-bold text-slate-700 flex items-center justify-between transition cursor-pointer"
              >
                <span>
                  {showDetails
                    ? isZh
                      ? '收起详细说明'
                      : 'Hide detailed explanation'
                    : isZh
                    ? '展开查看完整背景与详细说明'
                    : 'Show full detailed explanation'}
                </span>
                {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showDetails && (
                <div className="mt-3 p-4 bg-slate-50 rounded-2xl text-slate-700 text-base sm:text-lg leading-relaxed whitespace-pre-line border border-slate-200/80 font-medium">
                  {result.detailedExplanation}
                </div>
              )}
            </div>
          )}

          {/* RELATED QUESTIONS & FOLLOW-UP SECTION */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-emerald-700" />
              <h4 className="text-base sm:text-lg font-black text-slate-900">
                {isZh ? '您可能还想继续了解：' : 'Related Questions & Follow-ups:'}
              </h4>
            </div>

            {/* Quick Suggested Questions Capsule Pills */}
            {result.suggestedQuestions && result.suggestedQuestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {result.suggestedQuestions.map((sq, i) => (
                  <button
                    key={i}
                    onClick={() => onFollowUpQuestion(sq)}
                    disabled={isFollowUpLoading}
                    className="text-xs sm:text-sm bg-white hover:bg-emerald-50 text-slate-900 border border-slate-300 hover:border-emerald-400 font-bold px-3.5 py-2 rounded-xl transition shadow-2xs cursor-pointer active:scale-95 text-left disabled:opacity-50"
                  >
                    {sq}
                  </button>
                ))}
              </div>
            )}

            {/* Custom Question input with voice mic integrated right inside */}
            <form onSubmit={handleSendCustomQuestion} className="relative flex items-center">
              <input
                type="text"
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                placeholder={isZh ? '语音或打字输入新问题...' : 'Ask another question...'}
                className="w-full pl-4 pr-24 py-3.5 bg-white border border-slate-300 focus:border-emerald-600 rounded-xl text-slate-900 font-bold text-base focus:outline-none shadow-2xs"
              />

              {/* Integrated Voice Mic & Submit inside the right of the field */}
              <div className="absolute right-1.5 flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleVoiceFollowup}
                  className={`p-2 rounded-lg font-bold transition cursor-pointer ${
                    isRecording
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title={isZh ? '语音提问' : 'Voice input'}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <button
                  type="submit"
                  disabled={!customQuestion.trim() || isFollowUpLoading}
                  className={`px-3 py-2 rounded-lg font-bold text-sm transition cursor-pointer flex items-center gap-1 ${
                    customQuestion.trim() && !isFollowUpLoading
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isFollowUpLoading ? (
                    <span className="text-xs">{isZh ? '思考中' : '...'}</span>
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Big Single Action "Done / Return Home" Button */}
          <div className="pt-2 flex justify-center">
            <button
              onClick={onHome}
              id="btn-result-done-home"
              className="w-full sm:w-auto px-10 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-lg sm:text-xl shadow-md flex items-center justify-center gap-3 transition transform active:scale-98 cursor-pointer"
            >
              <Home className="w-5 h-5 text-emerald-400" />
              <span>{isZh ? '完成，返回主菜单' : 'Done, Return to Main Menu'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI DISCLAIMER (MANDATORY) */}
      <div className="text-center py-2 px-4">
        <p className="text-xs sm:text-sm text-slate-500 max-w-2xl mx-auto leading-relaxed font-medium">
          {isZh
            ? '💡 本应用由 AI 提供辅助支持，分析结果仅供参考。重要医疗、法律及财务事项请以官方机构或专业人员答复为准。'
            : '💡 Powered by AI for assistive purposes. Results are for reference only. For important medical, legal, or financial matters, please consult official agencies or professionals.'}
        </p>
      </div>
    </div>
  );
};
