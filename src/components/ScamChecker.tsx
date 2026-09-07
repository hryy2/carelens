import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  ShieldAlert,
  ArrowLeft,
  Upload,
  Camera,
  MessageSquare,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  X,
  Info,
  RotateCcw,
  Sparkles,
  ClipboardPaste,
} from "lucide-react";
import { AnalysisResult, Language, PresetSample } from "../types";
import { seniorAudio } from "../services/audio";
import { analyzeContent } from "../services/api";
import { QuestionInput } from "./QuestionInput";
import { Disclaimer } from "./Disclaimer";

interface ScamCheckerProps {
  language: Language;
  onBack: () => void;
  initialPreset?: PresetSample | null;
  currentResult?: AnalysisResult | null;
  onResultChange?: (
    result: AnalysisResult | null,
    payload?: { imageBase64?: string; text?: string; question?: string },
  ) => void;
}

// 4 Preset Examples specified in the prompt
const PRESET_EXAMPLES = [
  {
    id: "nzta",
    labelEn: "NZTA toll scam",
    labelZh: "NZTA 高速路费诈骗",
    textEn:
      "[NZTA Waka Kotahi Alert]: You have an outstanding toll fee of $4.80 NZD from your recent trip on Northern Gateway Toll Road. A late penalty fine of $75 will apply within 24 hours. Please pay immediately via: http://nzta-road-pay-update.top/nz",
    textZh:
      "【新西兰交通局提醒】您有一笔4.80纽币的高速通行费未付。24小时内未付将产生75纽币滞纳金。请立即点击链接补缴：http://nzta-road-pay-update.top/nz",
  },
  {
    id: "parcel",
    labelEn: "Parcel delivery scam",
    labelZh: "包裹派送诈骗",
    textEn:
      "NZ Post: Your parcel #NZ889210 could not be delivered due to incomplete street address. Please update your delivery details and pay the $2.10 redelivery fee here: https://nzpost-track-service.xyz/delivery before it is returned to sender.",
    textZh:
      "新西兰邮政：您的包裹 #NZ889210 由于收件地址不全无法派送。请点击链接更新地址并支付2.10纽币补单费用：https://nzpost-track-service.xyz/delivery",
  },
  {
    id: "ird",
    labelEn: "IRD tax refund",
    labelZh: "IRD 税务局退税",
    textEn:
      "Inland Revenue (IRD): You have an unclaimed tax refund of $840.50 NZD. Please confirm your bank card details and PIN within 48 hours to deposit the refund: https://ird-nz-portal-secure.com/claim-refund",
    textZh:
      "新西兰税务局(IRD)：您有一笔840.50纽币的税金退款待领取。请在48小时内点击链接确认银行卡信息与密码领取：https://ird-nz-portal-secure.com/claim-refund",
  },
  {
    id: "bank",
    labelEn: "Bank account suspension",
    labelZh: "银行账户冻结",
    textEn:
      "ANZ Bank Alert: Your online banking account has been temporarily suspended due to unusual activity. To verify your identity and restore access immediately, visit: https://anz-security-update-nz.info/login",
    textZh:
      "澳新银行(ANZ)紧急通知：检测到您的网银账户存在异常活动，已被临时冻结。请立即点击链接验证身份以恢复使用：https://anz-security-update-nz.info/login",
  },
];

export const ScamChecker: React.FC<ScamCheckerProps> = ({
  language,
  onBack,
  initialPreset,
  currentResult,
  onResultChange,
}) => {
  const isZh = language === "zh";

  // Active input tab: 'text' | 'screenshot' | 'upload'
  const [activeTab, setActiveTab] = useState<"text" | "screenshot" | "upload">(
    "text",
  );

  // Input states
  const [scamText, setScamText] = useState<string>(initialPreset?.text || "");
  const [scamImage, setScamImage] = useState<string | null>(
    initialPreset?.imageUrl || null,
  );
  const [userQuestion, setUserQuestion] = useState<string>(
    initialPreset?.defaultQuestion?.[language] || "",
  );

  // Status states
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // File input refs
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Initialize from initialPreset if provided
  useEffect(() => {
    if (initialPreset) {
      if (initialPreset.text) {
        setScamText(initialPreset.text);
        setActiveTab("text");
      }
      if (initialPreset.imageUrl) {
        setScamImage(initialPreset.imageUrl);
        setActiveTab("screenshot");
      }
      if (initialPreset.defaultQuestion?.[language]) {
        setUserQuestion(initialPreset.defaultQuestion[language]);
      }
    }
  }, [initialPreset, language]);

  // Listen to audio stop/start
  useEffect(() => {
    const unsub = seniorAudio.subscribeState((speaking) => {
      setIsPlayingAudio(speaking);
    });
    return unsub;
  }, []);

  // Quick preset questions
  const quickQuestions = isZh
    ? [
        "这是诈骗还是官方信息？",
        "如果我不理会它会被罚款吗？",
        "怎么向官方机构求证真假？",
      ]
    : [
        "Is this a scam or official?",
        "Will I be fined if I ignore it?",
        "How do I verify with the agency?",
      ];

  // Handle file uploads
  const handleImageFile = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setScamImage(reader.result as string);
      seniorAudio.speakText(
        isZh
          ? "图片已上传。您可以点击下方核查按钮。"
          : "Image uploaded. Tap Check to verify.",
        language,
      );
    };
    reader.readAsDataURL(file);
  };

  // Paste from clipboard helper
  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setScamText(text);
          seniorAudio.speakText(
            isZh ? "已粘贴剪贴板文字。" : "Pasted text from clipboard.",
            language,
          );
        }
      }
    } catch (e) {
      console.warn("Clipboard read failed:", e);
    }
  };

  // Voice speech-to-text recognition
  const handleVoiceInput = () => {
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      seniorAudio.speakText(
        isZh
          ? "您的浏览器暂不支持语音输入，请使用键盘输入问题。"
          : "Voice input is not supported in this browser. Please type your question.",
        language,
      );
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = isZh ? "zh-CN" : "en-NZ";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setUserQuestion(transcript);
      setIsRecording(false);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  // Perform Analysis
  const runAnalysis = async (customQuestion?: string) => {
    const questionToAsk = customQuestion ?? userQuestion;
    const hasText = activeTab === "text" && scamText.trim().length > 0;
    const hasImage =
      (activeTab === "screenshot" || activeTab === "upload") && scamImage;

    // If active tab doesn't have content, check if the other has content
    const finalHasText = hasText || scamText.trim().length > 0;
    const finalHasImage = hasImage || scamImage;

    if (!finalHasText && !finalHasImage) {
      const promptMsg = isZh
        ? "请先粘贴可疑短信内容，或上传截图照片。"
        : "Please paste a suspicious message or upload a screenshot first.";
      setErrorMessage(promptMsg);
      seniorAudio.speakText(promptMsg, language);
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    const spokenLoadingMsg = isZh
      ? "正在为您核实可疑信息，请稍候..."
      : "Checking message for scam risks, please wait...";
    seniorAudio.speakText(spokenLoadingMsg, language);

    try {
      const result = await analyzeContent({
        mode: "scam",
        language,
        imageBase64: finalHasImage ? scamImage || undefined : undefined,
        text: finalHasText ? scamText.trim() : undefined,
        question: questionToAsk.trim() || undefined,
      });

      if (onResultChange) {
        onResultChange(result, {
          imageBase64: finalHasImage ? scamImage || undefined : undefined,
          text: finalHasText ? scamText.trim() : undefined,
          question: questionToAsk.trim() || undefined,
        });
      }

      // Voice read the summary after analysis
      if (result.summary) {
        seniorAudio.speakText(result.summary, language);
      }
    } catch (err: any) {
      console.error("Scam analysis failed:", err);
      const errPrompt = isZh
        ? "分析失败，请检查网络或稍后再试。"
        : "Analysis failed. Please check network connection and try again.";
      setErrorMessage(errPrompt);
      seniorAudio.speakText(errPrompt, language);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper to extract clean reason list from result
  const getReasonsList = (res: AnalysisResult): string[] => {
    if (res.riskReason && res.riskReason.trim().length > 0) {
      const parts = res.riskReason
        .split(/\n+|•|–|- |\d+\.\s+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      if (parts.length > 0) return parts;
      return [res.riskReason];
    }
    if (res.detailedExplanation && res.detailedExplanation.trim().length > 0) {
      const parts = res.detailedExplanation
        .split(/\n+|•|–|- |\d+\.\s+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0 && p.length < 150);
      if (parts.length > 0) return parts.slice(0, 4);
    }
    if (res.summary) {
      return [res.summary];
    }
    return [
      isZh
        ? "来源不可信，切勿泄露个人隐私。"
        : "Unverified source, never disclose personal info.",
    ];
  };

  // Helper to extract clean actions list from result
  const getActionsList = (res: AnalysisResult): string[] => {
    if (res.actionSteps && res.actionSteps.length > 0) {
      return res.actionSteps;
    }
    const isHighRisk = res.riskLevel === "scam";
    if (isHighRisk) {
      return isZh
        ? [
            "切勿点击短信中的任何网址链接。",
            "千万不要在网页上输入银行卡号、密码或验证码。",
            "可直接删除此短信，您不会被罚款或冻结账户。",
            "如有疑问，请访问官方网站核实：nzta.govt.nz 或 ird.govt.nz",
          ]
        : [
            "Do not click any web links in this message.",
            "Never enter your bank card number, PIN, or verification codes.",
            "You can safely delete this message – you will not be fined.",
            "If unsure, verify on official websites directly: nzta.govt.nz or ird.govt.nz",
          ];
    }
    return isZh
      ? [
          "请通过官方网站公布的客服电话核实真伪。",
          "在确认对方身份前，暂勿转账或提供身份证件信息。",
        ]
      : [
          "Verify with the agency using the phone number on their official website.",
          "Do not make payments or provide ID before confirming identity.",
        ];
  };

  // Audio reading for the advice section
  const handleToggleVoicePlayback = () => {
    if (isPlayingAudio) {
      seniorAudio.stop();
      return;
    }

    if (!currentResult) {
      seniorAudio.speakText(
        isZh
          ? "请先输入或上传短信并点击核查。"
          : "Please enter or upload a message and tap check first.",
        language,
      );
      return;
    }

    const level = currentResult.riskLevel || "scam";
    let intro = "";
    if (level === "scam") {
      intro = isZh ? "高风险，极可能是诈骗。" : "High Risk. Likely a Scam.";
    } else if (level === "caution") {
      intro = isZh
        ? "需谨慎，信息真实性未核实。"
        : "Be Careful. Unverified message.";
    } else {
      intro = isZh
        ? "看似安全，属于正规官方信息。"
        : "Looks Safe. Appears legitimate.";
    }

    const reasons = getReasonsList(currentResult).join(". ");
    const actions = getActionsList(currentResult).join(". ");
    const fullSpeech = `${intro} ${reasons}. ${isZh ? "建议您：" : "What you should do:"} ${actions}`;

    seniorAudio.speakText(fullSpeech, language);
  };

  // Helper to render text with clickable/highlighted official website links
  const renderTextWithLinks = (text: string) => {
    const urlPattern =
      /((?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)+(?:govt\.nz|co\.nz|org\.nz|com|org|net|info|top|xyz)(?:\/[^\s,)]*)?)/gi;
    const parts = text.split(urlPattern);

    return parts.map((part, index) => {
      if (urlPattern.test(part)) {
        const href = part.startsWith("http") ? part : `https://${part}`;
        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2B7FD4] underline font-semibold hover:text-blue-700 transition inline-block break-all"
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Risk styling mapping
  const riskLevel = currentResult?.riskLevel || "scam";
  const riskCardStyle =
    riskLevel === "scam"
      ? "bg-[#FEF2F2] border-[#FECACA]"
      : riskLevel === "caution"
        ? "bg-[#FFFBEB] border-[#FDE68A]"
        : "bg-[#F0FDF4] border-[#BBF7D0]";

  const riskTitleText =
    riskLevel === "scam"
      ? isZh
        ? "高风险 – 极可能是诈骗"
        : "High Risk – Likely a Scam"
      : riskLevel === "caution"
        ? isZh
          ? "需谨慎 – 真实性未核实"
          : "Be Careful – Unverified"
        : isZh
          ? "看似安全 – 官方正规"
          : "Looks Safe";

  const riskTitleColor =
    riskLevel === "scam"
      ? "text-[#DC2626]"
      : riskLevel === "caution"
        ? "text-[#D97706]"
        : "text-[#16A34A]";

  const reasonsHeadingText =
    riskLevel === "scam"
      ? isZh
        ? "这条信息极可能是诈骗，原因如下："
        : "This message looks like a scam. Here's why:"
      : riskLevel === "caution"
        ? isZh
          ? "此信息需保持警惕，原因如下："
          : "This message needs caution. Here's why:"
        : isZh
          ? "此信息看起来正规，原因如下："
          : "This message looks legitimate. Here's why:";

  return (
    <div className="w-full max-w-[1200px] mx-auto">
      {/* 1. Top Left: Back to Home Button */}
      <div className="mb-4">
        <button
          type="button"
          onClick={onBack}
          id="scam-back-home-btn"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FDEEE3] text-[#E8590C] rounded-full font-bold text-sm sm:text-base hover:opacity-90 active:scale-95 transition cursor-pointer shadow-2xs"
          title={isZh ? "返回首页" : "Back to Home"}
        >
          <ArrowLeft className="w-4 h-4 text-[#E8590C]" />
          <span>{isZh ? "返回首页" : "Back to Home"}</span>
        </button>
      </div>

      {/* Unified Big White Card: 白底 #FFFFFF、圆角 24px、1px 极浅边框 #E3EDF7、内边距 28px */}
      <div className="bg-[#FFFFFF] rounded-[24px] border border-[#E3EDF7] p-5 sm:p-[28px] shadow-sm space-y-6">
        {/* 2. Page Title Area */}
        <div className="flex items-start gap-4">
          {/* 52x52px Orange-Red Rounded Square with Shield */}
          <div className="w-[52px] h-[52px] rounded-[14px] bg-[#E8590C] flex items-center justify-center shrink-0 shadow-sm">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-[28px] font-bold text-[#1E293B] leading-tight">
              {isZh ? "核实诈骗短信与可疑信息" : "Check Scam Messages"}
            </h1>
            <p className="text-[15px] text-[#64748B] mt-1 leading-normal">
              {isZh
                ? "粘贴短信、上传截图或拍照。我将为您检查是否存在可疑风险。"
                : "Paste a message, upload a screenshot or take a photo. I'll check if it looks suspicious."}
            </p>
          </div>
        </div>

        {/* Error notification if any */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-300 text-rose-800 rounded-2xl p-4 flex items-center justify-between gap-3 text-sm font-semibold shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs bg-rose-200 hover:bg-rose-300 font-bold px-2.5 py-1 rounded-lg"
            >
              {isZh ? "我知道了" : "Dismiss"}
            </button>
          </div>
        )}

        {/* 3. Left & Right Columns (50% / 50%, 20px gap, equal height) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px] items-stretch">
          {/* Left Column (Input Area) */}
          <div className="bg-white rounded-[20px] border border-[#E3EDF7] p-[20px] flex flex-col justify-between h-full shadow-2xs">
            <div className="space-y-4">
              {/* Top: 3 Tabs switcher buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("text")}
                  id="scam-tab-text"
                  className={`py-2.5 px-2 rounded-[12px] text-sm sm:text-base font-bold transition text-center cursor-pointer ${
                    activeTab === "text"
                      ? "bg-[#E8590C] text-white shadow-xs"
                      : "bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#1E293B]"
                  }`}
                >
                  {isZh ? "文字短信" : "Text Message"}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("screenshot")}
                  id="scam-tab-screenshot"
                  className={`py-2.5 px-2 rounded-[12px] text-sm sm:text-base font-bold transition text-center cursor-pointer ${
                    activeTab === "screenshot"
                      ? "bg-[#E8590C] text-white shadow-xs"
                      : "bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#1E293B]"
                  }`}
                >
                  {isZh ? "手机截图" : "Screenshot"}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("upload")}
                  id="scam-tab-upload"
                  className={`py-2.5 px-2 rounded-[12px] text-sm sm:text-base font-bold transition text-center cursor-pointer ${
                    activeTab === "upload"
                      ? "bg-[#E8590C] text-white shadow-xs"
                      : "bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#1E293B]"
                  }`}
                >
                  {isZh ? "拍照/图片" : "Upload Image"}
                </button>
              </div>

              {/* Middle: Input Area according to selected tab */}
              {activeTab === "text" && (
                <div className="relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-[#64748B]">
                      {isZh ? "短信或邮件正文：" : "Message text to check:"}
                    </span>
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#E8590C] hover:text-[#c44705] bg-[#FEF5ED] hover:bg-[#FDEEE3] px-2.5 py-1 rounded-lg transition cursor-pointer"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                      <span>{isZh ? "粘贴剪贴板" : "Paste"}</span>
                    </button>
                  </div>

                  <div className="relative">
                    <textarea
                      rows={6}
                      value={scamText}
                      onChange={(e) => setScamText(e.target.value)}
                      maxLength={1000}
                      id="scam-text-input"
                      placeholder={
                        isZh
                          ? "在此粘贴可疑短信、高速路费、包裹通知或邮件文字..."
                          : "Paste suspicious text message, toll road fee, parcel link or email here…"
                      }
                      className="w-full h-[200px] min-h-[200px] p-[14px] pb-8 bg-white border border-[#E2E8F0] focus:border-[#E8590C] rounded-[14px] text-[#1E293B] text-base leading-relaxed focus:outline-none resize-none shadow-2xs"
                    />
                    {/* Character count at bottom right */}
                    <div className="absolute right-3.5 bottom-3 text-xs text-[#94A3B8] select-none font-medium">
                      {scamText.length}/1000
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "screenshot" && (
                <div className="space-y-2">
                  <input
                    ref={screenshotInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImageFile(f);
                    }}
                    className="hidden"
                  />

                  {scamImage ? (
                    <div className="relative h-[200px] bg-[#FEF9F5] border-2 border-dashed border-[#F5C9A8] rounded-[14px] p-2 flex flex-col items-center justify-center">
                      <img
                        src={scamImage}
                        alt="Uploaded scam screenshot"
                        className="max-h-[140px] w-auto max-w-full object-contain rounded-lg shadow-2xs"
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => screenshotInputRef.current?.click()}
                          className="text-xs bg-white text-[#E8590C] border border-[#F5C9A8] font-bold px-3 py-1 rounded-lg hover:bg-orange-50 transition cursor-pointer"
                        >
                          {isZh ? "更换截图" : "Change Screenshot"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setScamImage(null)}
                          className="text-xs bg-white text-rose-600 border border-rose-200 font-bold px-3 py-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                        >
                          {isZh ? "删除" : "Remove"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => screenshotInputRef.current?.click()}
                      className="h-[200px] bg-[#FEF9F5] border-2 border-dashed border-[#F5C9A8] rounded-[14px] flex flex-col items-center justify-center text-center p-4 cursor-pointer hover:bg-[#FDF3E9] transition"
                    >
                      <div className="w-12 h-12 rounded-xl bg-[#FDEEE3] text-[#E8590C] flex items-center justify-center mb-2 shadow-2xs">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-base font-bold text-[#1E293B]">
                        {isZh
                          ? "上传短信截屏图片"
                          : "Upload a screenshot of the message"}
                      </p>
                      <p className="text-xs text-[#64748B] mt-1">
                        {isZh
                          ? "支持 JPG、PNG 格式图片"
                          : "Supports JPG, PNG images"}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "upload" && (
                <div className="space-y-2">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImageFile(f);
                    }}
                    className="hidden"
                  />

                  {scamImage ? (
                    <div className="relative h-[200px] bg-[#FEF9F5] border-2 border-dashed border-[#F5C9A8] rounded-[14px] p-2 flex flex-col items-center justify-center">
                      <img
                        src={scamImage}
                        alt="Uploaded photo"
                        className="max-h-[140px] w-auto max-w-full object-contain rounded-lg shadow-2xs"
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          className="text-xs bg-white text-[#E8590C] border border-[#F5C9A8] font-bold px-3 py-1 rounded-lg hover:bg-orange-50 transition cursor-pointer"
                        >
                          {isZh ? "重新拍照" : "Retake Photo"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setScamImage(null)}
                          className="text-xs bg-white text-rose-600 border border-rose-200 font-bold px-3 py-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                        >
                          {isZh ? "删除" : "Remove"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => photoInputRef.current?.click()}
                      className="h-[200px] bg-[#FEF9F5] border-2 border-dashed border-[#F5C9A8] rounded-[14px] flex flex-col items-center justify-center text-center p-4 cursor-pointer hover:bg-[#FDF3E9] transition"
                    >
                      <div className="w-12 h-12 rounded-xl bg-[#FDEEE3] text-[#E8590C] flex items-center justify-center mb-2 shadow-2xs">
                        <Camera className="w-6 h-6" />
                      </div>
                      <p className="text-base font-bold text-[#1E293B]">
                        {isZh
                          ? "拍照或上传图片"
                          : "Take a photo or upload image"}
                      </p>
                      <p className="text-xs text-[#64748B] mt-1">
                        {isZh
                          ? "支持调用手机相机拍照或相册选择"
                          : "Supports camera or gallery upload"}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4">
              {/* Main Action Button: "Check This Message" */}
              <button
                type="button"
                onClick={() => runAnalysis()}
                disabled={isAnalyzing}
                id="scam-check-message-btn"
                className="w-full h-[56px] rounded-[14px] bg-[#E8590C] hover:bg-[#cf4d07] active:scale-98 text-white font-bold text-[18px] flex items-center justify-center gap-2.5 transition cursor-pointer shadow-md disabled:opacity-50"
              >
                <Shield className="w-5 h-5 text-white" />
                <span>
                  {isAnalyzing
                    ? isZh
                      ? "正在核查中..."
                      : "Checking..."
                    : isZh
                      ? "核查这条信息"
                      : "Check This Message"}
                </span>
              </button>

              {/* Example Samples Area */}
              <div>
                <p className="text-[14px] font-bold text-[#475569] mb-2">
                  {isZh ? "尝试示例样本：" : "Try an example:"}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_EXAMPLES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setScamText(isZh ? item.textZh : item.textEn);
                        setActiveTab("text");
                        seniorAudio.speakText(
                          isZh
                            ? `已载入示例：${item.labelZh}`
                            : `Loaded ${item.labelEn}`,
                          language,
                        );
                      }}
                      className="h-[42px] px-3 bg-white border border-[#F5C9A8] text-[#E8590C] rounded-full text-[14px] font-semibold hover:bg-[#FEF5ED] active:scale-95 transition cursor-pointer flex items-center justify-center text-center truncate shadow-2xs"
                      title={isZh ? item.labelZh : item.labelEn}
                    >
                      <span className="truncate">
                        {isZh ? item.labelZh : item.labelEn}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (Result Area) */}
          <div
            className={`rounded-[20px] p-[24px] flex flex-col justify-between h-full border transition-all shadow-2xs ${
              currentResult ? riskCardStyle : "bg-white border-[#E3EDF7]"
            }`}
          >
            {/* State A: Not Checked (Empty State) */}
            {!currentResult ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4 max-h-[440px] h-[440px]">
                <div className="w-20 h-20 rounded-full bg-[#FEF5ED] flex items-center justify-center shadow-2xs">
                  <Shield className="w-10 h-10 text-[#F5C9A8]" />
                </div>
                <div className="max-w-sm space-y-1.5">
                  <p className="text-base sm:text-lg font-bold text-[#334155]">
                    {isZh
                      ? "请粘贴文字或上传截图，然后点击「核查这条信息」开始检测。"
                      : "Paste or upload a message, then tap Check This Message."}
                  </p>
                  <p className="text-xs sm:text-sm text-[#94A3B8]">
                    {isZh
                      ? "我们将为您逐条核验发送者身份、链接网址与诈骗套路。"
                      : "We'll check sender domain, links, and urgent payment tricks for you."}
                  </p>
                </div>
              </div>
            ) : (
              /* State B: Detection Result */
              <div className="flex-1 flex flex-col justify-between">
                {/* Scrollable Result Content to maintain strictly equal column height */}
                <div className="max-h-[440px] h-[440px] overflow-y-auto pr-1.5 space-y-4">
                  {/* 1. Top: Risk Level Header */}
                  <div className="flex items-center gap-3">
                    {riskLevel === "scam" && (
                      <AlertTriangle className="w-8 h-8 text-[#DC2626] shrink-0" />
                    )}
                    {riskLevel === "caution" && (
                      <AlertCircle className="w-8 h-8 text-[#D97706] shrink-0" />
                    )}
                    {riskLevel === "safe" && (
                      <CheckCircle2 className="w-8 h-8 text-[#16A34A] shrink-0" />
                    )}

                    <h2
                      className={`text-[22px] font-bold ${riskTitleColor} leading-tight`}
                    >
                      {riskTitleText}
                    </h2>
                  </div>

                  {userQuestion.trim() && currentResult?.summary && (
                    <div className="mb-4 p-4 bg-white rounded-[14px] border border-[#F0E4DA]">
                      <p className="text-[16px] font-bold text-[#1E293B] mb-2">
                        {isZh
                          ? `您问：${userQuestion}`
                          : `You asked: ${userQuestion}`}
                      </p>
                      <p className="text-[16px] text-[#334155] leading-relaxed">
                        {currentResult.summary}
                      </p>
                    </div>
                  )}

                  {/* 2. Middle: Reasons */}
                  <div className="space-y-2">
                    <h3 className="text-[16px] font-bold text-[#1E293B]">
                      {reasonsHeadingText}
                    </h3>

                    <div className="space-y-2 pl-1">
                      {getReasonsList(currentResult).map((reason, idx) => (
                        <div key={idx} className="flex items-start gap-2.5">
                          <div
                            className={`w-2 h-2 rounded-full shrink-0 mt-2 ${
                              riskLevel === "safe"
                                ? "bg-[#16A34A]"
                                : "bg-[#DC2626]"
                            }`}
                          />
                          <p className="text-[15px] text-[#334155] leading-[1.6] flex-1">
                            {renderTextWithLinks(reason)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3. Lower Section: What you should do (White Card) */}
                  <div className="bg-white rounded-[14px] p-[16px] border border-black/5 shadow-2xs space-y-2.5 mt-4">
                    <h3 className="text-[16px] font-bold text-[#1E293B]">
                      {isZh ? "建议您采取的行动：" : "What you should do:"}
                    </h3>

                    <div className="space-y-2">
                      {getActionsList(currentResult).map((step, idx) => (
                        <div key={idx} className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                          <div className="text-[15px] text-[#334155] leading-[1.5] flex-1">
                            {renderTextWithLinks(step)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Bottom of Right Column: Listen to advice Button */}
                <div className="pt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={handleToggleVoicePlayback}
                    id="scam-listen-advice-btn"
                    className="w-full h-[48px] bg-white border border-[#E8590C] text-[#E8590C] hover:bg-[#FEF5ED] active:scale-98 rounded-[12px] font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs"
                  >
                    {isPlayingAudio && currentResult ? (
                      <>
                        <VolumeX className="w-5 h-5 text-rose-500 animate-pulse" />
                        <span>{isZh ? "停止语音播报" : "Stop Listening"}</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-5 h-5 text-[#E8590C]" />
                        <span>
                          {isZh ? "收听防骗语音建议" : "Listen to advice"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Bottom Question Area (Full Width Card, rounded 20px, padding 20px) */}
        <QuestionInput
          theme="orange"
          value={userQuestion}
          onChange={setUserQuestion}
          onSubmit={runAnalysis}
          onVoiceInput={handleVoiceInput}
          isRecording={isRecording}
          isBusy={isAnalyzing}
          placeholder={
            isZh
              ? "针对这条信息输入您的问题…"
              : "Ask your own question about this message…"
          }
          quickQuestions={quickQuestions}
          quickLabel={isZh ? "快捷提问：" : "Quick questions:"}
          submitLabel={isZh ? "核验信息" : "Check"}
          busyLabel={isZh ? "核验中…" : "Checking…"}
        />

        {/* 5. Bottom Disclaimer */}
        <Disclaimer
          text={
            isZh
              ? "此内容仅供 AI 辅助参考。如有疑问，请直接通过官方网站公布的电话与相关机构核实。"
              : "This is AI guidance only. If you are unsure, please contact the official organisation directly using the phone number on their official website."
          }
        />
      </div>
    </div>
  );
};