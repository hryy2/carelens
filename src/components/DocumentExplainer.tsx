import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Upload,
  Mic,
  Volume2,
  VolumeX,
  Mail,
  BookOpen,
  CheckCircle2,
  Calendar,
  Info,
  Loader2,
  RotateCcw,
  ArrowLeft,
  ZoomIn,
  Trash2,
  Sparkles,
  MessageSquare,
  Lightbulb,
  X,
} from "lucide-react";
import { AnalysisResult, Language, PresetSample } from "../types";
import { seniorAudio } from "../services/audio";
import { analyzeContent } from "../services/api";
import { PdfRenderer } from "./PdfRenderer";
import { QuestionInput } from "./QuestionInput";
import { Disclaimer } from "./Disclaimer";

interface DocumentExplainerProps {
  language: Language;
  onBack: () => void;
  initialPreset?: PresetSample | null;
  currentResult?: AnalysisResult | null;
  onResultChange?: (result: AnalysisResult | null) => void;
}

export const DocumentExplainer: React.FC<DocumentExplainerProps> = ({
  language,
  onBack,
  initialPreset,
  currentResult,
  onResultChange,
}) => {
  const isZh = language === "zh";
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File state
  const [uploadedFile, setUploadedFile] = useState<{
    dataUrl: string;
    blobUrl?: string;
    mimeType: string;
    name: string;
    isPdf: boolean;
  } | null>(() => {
    if (initialPreset?.imageUrl) {
      return {
        dataUrl: initialPreset.imageUrl,
        mimeType: "image/jpeg",
        name: "preset-letter.jpg",
        isPdf: false,
      };
    }
    return null;
  });

  // Preset text if loaded
  const [documentText, setDocumentText] = useState<string>(() => {
    return initialPreset?.text || "";
  });

  // Question input state
  const [questionText, setQuestionText] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Submitted question for Q&A state (State B)
  const [submittedQuestion, setSubmittedQuestion] = useState<string | null>(
    null,
  );

  // Right column view state: 'default' (State A) | 'question' (State B)
  const [viewState, setViewState] = useState<"default" | "question">("default");

  // Active result state
  const [result, setResult] = useState<AnalysisResult | null>(
    currentResult || null,
  );

  // Audio speech playback state
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // Zoom In Modal State
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);

  // Revoke blob URL on unmount or file change
  useEffect(() => {
    return () => {
      if (uploadedFile?.blobUrl) {
        URL.revokeObjectURL(uploadedFile.blobUrl);
      }
    };
  }, [uploadedFile?.blobUrl]);

  // Subscribe to audio speaking state
  useEffect(() => {
    const unsub = seniorAudio.subscribeState((speaking) => {
      setIsSpeaking(speaking);
    });
    return () => {
      unsub();
      seniorAudio.stop();
    };
  }, []);

  // Sync when currentResult prop changes (e.g. language translation from Header)
  useEffect(() => {
    if (currentResult) {
      setResult(currentResult);
      if (currentResult.userQuestion) {
        setSubmittedQuestion(currentResult.userQuestion);
        setViewState("question");
      }
    }
  }, [currentResult]);

  // Sync if preset changes
  useEffect(() => {
    if (initialPreset) {
      if (initialPreset.imageUrl) {
        setUploadedFile({
          dataUrl: initialPreset.imageUrl,
          mimeType: "image/jpeg",
          name: "preset-letter.jpg",
          isPdf: false,
        });
      }
      if (initialPreset.text) {
        setDocumentText(initialPreset.text);
      }
      if (initialPreset.defaultQuestion?.[language]) {
        setQuestionText(initialPreset.defaultQuestion[language]);
      }
    }
  }, [initialPreset, language]);

  // Quick questions
  const quickQuestions = isZh
    ? ["这封信说了什么？", "我需要付多少钱？", "我需要采取什么行动？"]
    : [
        "What does this letter say?",
        "How much do I need to pay?",
        "What action do I need to take?",
      ];

  // Handle file selection (Images & PDF)
  const processFile = (file: File) => {
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    const mimeType = isPdf ? "application/pdf" : file.type || "image/jpeg";
    const blobUrl = isPdf ? URL.createObjectURL(file) : undefined;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setUploadedFile({
        dataUrl,
        blobUrl,
        mimeType,
        name: file.name,
        isPdf,
      });
      setDocumentText(""); // Clear synthetic text
      setErrorMessage(null);

      seniorAudio.speakText(
        isZh
          ? "文件已载入，点击下方解读这封信件。"
          : "Document loaded. Tap Explain to start.",
        language,
      );
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const triggerUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Remove uploaded document
  const handleRemoveDocument = () => {
    if (uploadedFile?.blobUrl) {
      URL.revokeObjectURL(uploadedFile.blobUrl);
    }
    setUploadedFile(null);
    setDocumentText("");
    setResult(null);
    setSubmittedQuestion(null);
    setViewState("default");
    if (onResultChange) {
      onResultChange(null);
    }
    seniorAudio.speakText(
      isZh ? "已移除当前文件。" : "Document removed.",
      language,
    );
  };

  // Voice input
  const handleVoiceInput = () => {
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      seniorAudio.speakText(
        isZh
          ? "当前浏览器未开启语音识别，请直接打字提问。"
          : "Voice input not supported in this browser.",
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
      if (transcript) {
        setQuestionText(transcript);
      }
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

  // Main explain action
  const handleExplain = async (overrideQuestion?: string) => {
    if (!uploadedFile && !documentText.trim()) {
      const promptUploadMsg = isZh
        ? "请先上传信件照片或PDF文档。"
        : "Please upload a photo of your letter or PDF first.";
      setErrorMessage(promptUploadMsg);
      seniorAudio.speakText(promptUploadMsg, language);
      return;
    }

    const activeQ =
      typeof overrideQuestion === "string"
        ? overrideQuestion
        : questionText.trim();
    setIsAnalyzing(true);
    setErrorMessage(null);

    seniorAudio.speakText(
      isZh
        ? "正在为您仔细解读信件，请稍候..."
        : "Examining your letter now, please wait...",
      language,
    );

    try {
      const res = await analyzeContent({
        mode: "document",
        language,
        imageBase64: uploadedFile?.dataUrl || undefined,
        mimeType: uploadedFile?.mimeType || undefined,
        text: documentText.trim() || undefined,
        question: activeQ || undefined,
      });

      setResult(res);
      if (onResultChange) {
        onResultChange(res);
      }

      if (activeQ) {
        setSubmittedQuestion(activeQ);
        setViewState("question");
      } else {
        setSubmittedQuestion(null);
        setViewState("default");
      }

      seniorAudio.speakText(res.summary, language);
    } catch (err: any) {
      console.error("Explain error:", err);
      const msg =
        err.message ||
        (isZh
          ? "解读遇到了问题，请再试一次。"
          : "Unable to analyze. Please try again.");
      setErrorMessage(msg);
      seniorAudio.speakText(msg, language);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Audio Speech Read-Aloud
  const handleToggleSpeech = () => {
    if (isSpeaking) {
      seniorAudio.stop();
      return;
    }

    if (!result) {
      seniorAudio.speakText(
        isZh
          ? "请先上传并解读信件。"
          : "Please upload and explain a letter first.",
        language,
      );
      return;
    }

    let speech = "";
    if (viewState === "question" && submittedQuestion) {
      speech = isZh
        ? `针对您的问题“${submittedQuestion}”，解答如下：${result.summary}。${result.detailedExplanation || ""}`
        : `Regarding your question "${submittedQuestion}": ${result.summary}. ${result.detailedExplanation || ""}`;
    } else {
      const typeText = `${result.keyDetails?.senderOrBrand || ""} ${result.title || ""}`;
      const saysText = `${result.summary || ""} ${result.detailedExplanation || ""}`;
      const actionText =
        result.actionSteps && result.actionSteps.length > 0
          ? result.actionSteps.join("。 ")
          : isZh
            ? "信件无需采取行动"
            : "No action needed";
      const datesText = `${result.keyDetails?.keyDateOrTime || ""} ${result.keyDetails?.amountOrCost || ""}`;

      speech = isZh
        ? `信件类型与发件方：${typeText}。信件主要内容：${saysText}。需要采取的行动：${actionText}。重要日期与金额：${datesText}。`
        : `Type of letter: ${typeText}. What it says: ${saysText}. What you need to do: ${actionText}. Key dates and amount: ${datesText}.`;
    }

    seniorAudio.speakText(speech, language);
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto">
      {/* ========================================================= */}
      {/* 顶部：单独一个"Back to Home"按钮（浅蓝底 #E8F2FC、蓝字、圆角胶囊形） */}
      {/* ========================================================= */}
      <div className="mb-4">
        <button
          type="button"
          onClick={onBack}
          id="doc-back-home-btn"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#E8F2FC] text-[#2B7FD4] rounded-full font-bold text-sm sm:text-base hover:opacity-90 active:scale-95 transition cursor-pointer shadow-2xs"
          title={isZh ? "返回首页" : "Back to Home"}
        >
          <ArrowLeft className="w-4 h-4 text-[#2B7FD4]" />
          <span>{isZh ? "返回首页" : "Back to Home"}</span>
        </button>
      </div>

      {/* 统一外层大圆角卡片：白底 #FFFFFF、圆角 24px、1px 极浅边框 #E3EDF7、内边距 28px */}
      <div className="bg-[#FFFFFF] rounded-[24px] border border-[#E3EDF7] p-5 sm:p-[28px] shadow-sm space-y-6">
        {/* 页面标题区：左侧 52x52px 蓝色圆角方块图标，右侧主标题 + 浅灰说明文字 */}
        <div className="flex items-center gap-4">
          <div className="w-[52px] h-[52px] rounded-[14px] bg-[#2B7FD4] flex items-center justify-center shrink-0 shadow-xs">
            <FileText className="w-[28px] h-[28px] text-white" />
          </div>
          <div>
            <h1 className="text-[28px] font-bold text-[#1E293B] leading-tight">
              {isZh
                ? "解读官方信件与账单"
                : "Understand Official Letters & Bills"}
            </h1>
            <p className="text-[15px] text-[#64748B] mt-1">
              {isZh
                ? "上传照片或粘贴文字。我将用通俗易懂的语言为您讲解。"
                : "Upload a photo or paste text. I'll explain it in simple language."}
            </p>
          </div>
        </div>

        {/* 错误提示条 */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-[14px] font-semibold px-4 py-3 rounded-[14px]">
            {errorMessage}
          </div>
        )}

        {/* 隐藏文件选择器：支持 JPG / PNG / PDF */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* ========================================================= */}
        {/* 二、左右两栏（各占约 50%，间距 20px，两栏高度一致、顶部底部对齐） */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px] items-stretch">
          {/* ==================== 左栏（白色卡片，圆角 20px） ==================== */}
          <div className="bg-white rounded-[20px] p-5 sm:p-6 border border-[#E3EDF7] shadow-sm flex flex-col justify-between h-full">
            <div>
              {/* 卡片顶部一行：左侧小图标 + "Your Document"标题，右侧一个"Zoom In"小按钮（白底浅边框、带放大镜图标） */}
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#2B7FD4]" />
                  <h3 className="text-[17px] font-bold text-[#1E293B]">
                    {isZh ? "您的文档" : "Your Document"}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (uploadedFile) {
                      setIsZoomModalOpen(true);
                    } else {
                      seniorAudio.speakText(
                        isZh
                          ? "请先上传信件照片或PDF。"
                          : "Please upload a letter first.",
                        language,
                      );
                    }
                  }}
                  disabled={!uploadedFile}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 disabled:opacity-40 rounded-[10px] text-[13px] font-bold text-[#1E293B] transition cursor-pointer shadow-2xs"
                >
                  <ZoomIn className="w-4 h-4 text-[#64748B]" />
                  <span>{isZh ? "放大查看" : "Zoom In"}</span>
                </button>
              </div>

              {/* 下方是文件预览区：固定高度 420px，圆角 12px，浅灰边框 */}
              <div
                onClick={!uploadedFile ? triggerUpload : undefined}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`h-[420px] w-full rounded-[12px] flex flex-col items-center justify-center relative overflow-hidden transition-all ${
                  uploadedFile
                    ? "bg-slate-50 border border-[#E2E8F0]"
                    : `bg-[#F8FBFE] border-2 border-dashed ${
                        isDragging
                          ? "border-[#2B7FD4] bg-sky-50"
                          : "border-[#BCDCF7]"
                      } cursor-pointer hover:bg-sky-50/50`
                }`}
              >
                {uploadedFile ? (
                  uploadedFile.isPdf ? (
                    /* PDF: 使用 pdfjs-dist 在前端把 PDF 渲染到 <canvas> 上显示实际内容，多页可纵向滚动 */
                    <PdfRenderer
                      dataUrl={uploadedFile.dataUrl}
                      blobUrl={uploadedFile.blobUrl}
                      language={language}
                    />
                  ) : (
                    /* 图片：object-fit: contain 完整显示，不裁切不变形 */
                    <img
                      src={uploadedFile.dataUrl}
                      alt={isZh ? "上传的信件照片" : "Uploaded letter"}
                      className="w-full h-full object-contain p-2"
                    />
                  )
                ) : (
                  /* 空状态：浅蓝虚线边框，居中显示上传图标、"Upload a photo of your letter"、以及小字"Supports JPG, PNG images or PDF files" */
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <div className="w-[56px] h-[56px] rounded-full bg-[#DCEBF9] text-[#2B7FD4] flex items-center justify-center shadow-xs">
                      <Upload className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[17px] font-bold text-[#1E293B]">
                        {isZh
                          ? "上传信件照片或PDF"
                          : "Upload a photo of your letter"}
                      </p>
                      <p className="text-[13px] text-[#64748B]">
                        {isZh
                          ? "支持 JPG、PNG 图片或 PDF 文件"
                          : "Supports JPG, PNG images or PDF files"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 预览区下方并排两个按钮：左边"Upload Another Document"（蓝色主按钮、较宽、带上传图标），右边"Remove"（白底、浅边框、深色字、带垃圾桶图标） */}
            <div className="flex items-center gap-3 mt-4 pt-1">
              <button
                type="button"
                onClick={triggerUpload}
                id="btn-upload-another-doc"
                className="flex-1 h-[48px] bg-[#2B7FD4] hover:bg-[#236bb3] active:scale-98 text-white rounded-[12px] text-[15px] font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>{isZh ? "上传其他文件" : "Upload Another Document"}</span>
              </button>

              <button
                type="button"
                onClick={handleRemoveDocument}
                disabled={!uploadedFile}
                id="btn-remove-doc"
                className="px-4 h-[48px] bg-white border border-[#E2E8F0] hover:bg-slate-50 disabled:opacity-40 active:scale-98 text-[#1E293B] rounded-[12px] text-[15px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-4 h-4 text-slate-500" />
                <span>{isZh ? "移除" : "Remove"}</span>
              </button>
            </div>
          </div>

          {/* ==================== 右栏（白色卡片，圆角 20px） ==================== */}
          <div className="bg-white rounded-[20px] p-5 sm:p-6 border border-[#E3EDF7] shadow-sm flex flex-col justify-between h-full">
            <div>
              {/* 顶部标题行 */}
              <div className="flex items-center justify-between mb-3.5 min-h-[36px]">
                {viewState === "question" && submittedQuestion ? (
                  /* 状态B: 顶部左侧 ✨图标 + 标题"Answer to your question"；顶部右侧 "View full explanation" 链接 */
                  <>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      <h3 className="text-[17px] font-bold text-[#1E293B]">
                        {isZh ? "针对您的问题解答" : "Answer to your question"}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => setViewState("default")}
                      className="text-[13px] font-bold text-[#2B7FD4] hover:underline flex items-center gap-1 cursor-pointer transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>
                        {isZh ? "查看完整解读" : "View full explanation"}
                      </span>
                    </button>
                  </>
                ) : (
                  /* 状态A: 顶部标题 "Here's what this letter means:" */
                  <h3 className="text-[17px] font-bold text-[#1E293B]">
                    {isZh
                      ? "这封信的意思是："
                      : "Here's what this letter means:"}
                  </h3>
                )}
              </div>

              {/* 右栏内容区：必须设置最大高度并支持内部滚动（overflow-y: auto），内容再长也不撑高整个卡片，保证左右两栏高度始终一致 */}
              <div className="max-h-[420px] h-[420px] overflow-y-auto pr-1">
                {isAnalyzing ? (
                  /* 分析中加载状态 */
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#DCEBF9] text-[#2B7FD4] flex items-center justify-center animate-bounce">
                      <Loader2 className="w-7 h-7 animate-spin" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[17px] font-bold text-[#1E293B]">
                        {isZh
                          ? "正在为您仔细解读信件..."
                          : "Analyzing this letter for you..."}
                      </p>
                      <p className="text-[14px] text-[#64748B]">
                        {isZh
                          ? "提炼发件方、核心内容、行动要求与重要时间"
                          : "Extracting sender, summary, actions, and key dates"}
                      </p>
                    </div>
                  </div>
                ) : viewState === "question" && submittedQuestion ? (
                  /* ==================== 状态B — 回答用户问题 ==================== */
                  <div className="space-y-3.5">
                    {/* 下方浅蓝色区块显示用户的问题，格式为：Q: "用户的问题" */}
                    <div className="bg-[#EAF3FD] text-[#1E293B] rounded-[14px] p-3.5 text-[15px] font-bold border border-[#BCDCF7]/70">
                      <span className="text-[#2B7FD4] mr-2">Q:</span>“
                      {submittedQuestion}”
                    </div>

                    {/* 再下方是白色卡片显示 AI 回答：左上角一个蓝色"AI"小方块 + "Response"标题，下方是回答正文，分段清晰 */}
                    <div className="bg-slate-50/80 rounded-[14px] p-4 border border-[#E3EDF7] space-y-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-[6px] bg-[#2B7FD4] text-white flex items-center justify-center font-bold text-[11px]">
                          AI
                        </div>
                        <span className="text-[14px] font-bold text-[#1E293B]">
                          {isZh ? "解答" : "Response"}
                        </span>
                      </div>

                      <p className="text-[15px] text-[#475569] leading-[1.6]">
                        {result?.summary ||
                          (isZh
                            ? "针对您的提问，这封信已完成分析。"
                            : "Here is the targeted explanation for your question.")}
                      </p>

                      {result?.detailedExplanation &&
                        result.detailedExplanation !== result.summary && (
                          <p className="text-[14px] text-[#475569] pt-2 border-t border-slate-200/80 leading-[1.6]">
                            {result.detailedExplanation}
                          </p>
                        )}
                    </div>

                    {/* 回答下方可选显示一个浅蓝色的"Tip"提示区块（💡图标 + 补充建议） */}
                    {result?.actionSteps && result.actionSteps.length > 0 && (
                      <div className="bg-[#F1F7FE] rounded-[14px] p-3.5 border border-[#BCDCF7]/60 flex items-start gap-2.5">
                        <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-[13px] text-[#1E293B] leading-relaxed">
                          <strong className="block text-[#2B7FD4] font-bold mb-0.5">
                            {isZh ? "温馨建议 / Tip:" : "Tip & Next Step:"}
                          </strong>
                          {result.actionSteps[0]}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ==================== 状态A — 默认完整解读 ==================== */
                  /* 下方浅蓝底圆角区块内，是四个条目：Type of letter / What it says / What you need to do / Key dates */
                  <div className="bg-[#F1F7FE] rounded-[16px] p-3.5 sm:p-4 space-y-2.5">
                    {/* 条目 1: Type of letter */}
                    <div className="flex items-start gap-3 bg-white rounded-[12px] p-3 border border-[#E3EDF7]">
                      <div className="w-[36px] h-[36px] rounded-[10px] bg-[#DCEBF9] text-[#2B7FD4] flex items-center justify-center shrink-0">
                        <Mail className="w-[18px] h-[18px]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[14px] font-bold text-[#1E293B]">
                          {isZh
                            ? "Type of letter — 信件类型与发件方"
                            : "Type of letter"}
                        </div>
                        <div className="text-[15px] text-[#475569] leading-[1.5] mt-0.5">
                          {result ? (
                            <>
                              <span className="font-semibold text-[#1E293B]">
                                {result.keyDetails?.senderOrBrand ||
                                  (isZh ? "官方机构" : "Official Issuer")}
                              </span>
                              {result.title ? ` · ${result.title}` : ""}
                            </>
                          ) : (
                            <span className="text-[#94A3B8]">
                              {isZh
                                ? "上传并解读后将显示发件方与信件类型"
                                : "Sender and document category"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 条目 2: What it says */}
                    <div className="flex items-start gap-3 bg-white rounded-[12px] p-3 border border-[#E3EDF7]">
                      <div className="w-[36px] h-[36px] rounded-[10px] bg-[#DCEBF9] text-[#2B7FD4] flex items-center justify-center shrink-0">
                        <BookOpen className="w-[18px] h-[18px]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[14px] font-bold text-[#1E293B]">
                          {isZh
                            ? "What it says — 信件主要内容说明"
                            : "What it says"}
                        </div>
                        <div className="text-[15px] text-[#475569] leading-[1.5] mt-0.5">
                          {result?.summary ? (
                            result.summary
                          ) : (
                            <span className="text-[#94A3B8]">
                              {isZh
                                ? "上传后为您用大白话提炼信里说了什么"
                                : "Summary of what the letter is about in simple terms"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 条目 3: What you need to do */}
                    <div className="flex items-start gap-3 bg-white rounded-[12px] p-3 border border-[#E3EDF7]">
                      <div className="w-[36px] h-[36px] rounded-[10px] bg-[#DCEBF9] text-[#2B7FD4] flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-[18px] h-[18px]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[14px] font-bold text-[#1E293B]">
                          {isZh
                            ? "What you need to do — 需要采取的行动"
                            : "What you need to do"}
                        </div>
                        <div className="text-[15px] text-[#475569] leading-[1.5] mt-0.5">
                          {result?.actionSteps &&
                          result.actionSteps.length > 0 ? (
                            <ul className="space-y-1">
                              {result.actionSteps.map((step, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-start gap-1.5"
                                >
                                  <span className="text-[#2B7FD4] font-bold shrink-0 mt-0.5">
                                    •
                                  </span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ul>
                          ) : result ? (
                            <span>
                              {isZh
                                ? "纯通知信件，无需采取任何行动。"
                                : "No action required."}
                            </span>
                          ) : (
                            <span className="text-[#94A3B8]">
                              {isZh
                                ? "明确告诉您是否需要交费、回信或办理手续"
                                : "Clear steps you need to take, or confirmation if none needed"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 条目 4: Key dates */}
                    <div className="flex items-start gap-3 bg-white rounded-[12px] p-3 border border-[#E3EDF7]">
                      <div className="w-[36px] h-[36px] rounded-[10px] bg-[#DCEBF9] text-[#2B7FD4] flex items-center justify-center shrink-0">
                        <Calendar className="w-[18px] h-[18px]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[14px] font-bold text-[#1E293B]">
                          {isZh ? "Key dates — 重要日期与金额" : "Key dates"}
                        </div>
                        <div className="text-[15px] text-[#475569] leading-[1.5] mt-0.5">
                          {result ? (
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              <span>
                                {isZh ? "日期：" : "Date: "}
                                <strong className="text-[#1E293B]">
                                  {result.keyDetails?.keyDateOrTime ||
                                    (isZh ? "无特定截止日期" : "None")}
                                </strong>
                              </span>
                              <span>
                                {isZh ? "金额：" : "Amount: "}
                                <strong className="text-[#1E293B]">
                                  {result.keyDetails?.amountOrCost ||
                                    (isZh ? "无需付款" : "None")}
                                </strong>
                              </span>
                            </div>
                          ) : (
                            <span className="text-[#94A3B8]">
                              {isZh
                                ? "自动标出截止日期、还款金额或到账周期"
                                : "Important deadlines and amounts to pay or receive"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 卡片底部居中放"Listen to full explanation"按钮（白底、蓝色描边、蓝字、带喇叭图标） */}
            <div className="mt-4 pt-1 flex justify-center">
              <button
                type="button"
                onClick={handleToggleSpeech}
                id="btn-listen-explanation"
                className="w-full h-[48px] bg-white border border-[#2B7FD4] text-[#2B7FD4] hover:bg-[#F8FBFE] active:scale-98 rounded-[12px] text-[15px] font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs"
              >
                {isSpeaking && result ? (
                  <>
                    <VolumeX className="w-5 h-5 animate-pulse" />
                    <span>{isZh ? "停止语音播放" : "Stop Listening"}</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-5 h-5" />
                    <span>
                      {isZh ? "听取完整语音讲解" : "Listen to full explanation"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 三、底部提问区（横跨全宽，独立白色卡片，圆角 20px） */}
        <QuestionInput
          theme="blue"
          value={questionText}
          onChange={setQuestionText}
          onSubmit={handleExplain}
          onVoiceInput={handleVoiceInput}
          isRecording={isRecording}
          isBusy={isAnalyzing}
          placeholder={
            isZh
              ? "针对这封信输入您的具体问题…"
              : "Ask your own question about this letter…"
          }
          quickQuestions={quickQuestions}
          quickLabel={isZh ? "快捷问题：" : "Quick questions:"}
          submitLabel={isZh ? "解读信件" : "Explain"}
          busyLabel={isZh ? "解读中…" : "Analyzing…"}
        />

        {/* 四、底部免责提示 */}
        <Disclaimer
          text={
            isZh
              ? "此解读仅供参考理解。请查阅原信件了解完整详情或访问官方网站。"
              : "This is a simplified explanation. Please refer to the original letter for full details or visit the official website."
          }
        />
      </div>

      {/* 放大查看 Modal (Zoom In) */}
      {isZoomModalOpen && uploadedFile && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsZoomModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-lg">
                <FileText className="w-5 h-5 text-[#2B7FD4]" />
                <span>
                  {uploadedFile.name ||
                    (isZh ? "信件大图预览" : "Document Preview")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsZoomModalOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100 min-h-[500px]">
              {uploadedFile.isPdf ? (
                <div className="w-full max-w-3xl h-[70vh]">
                  <PdfRenderer
                    dataUrl={uploadedFile.dataUrl}
                    blobUrl={uploadedFile.blobUrl}
                    language={language}
                  />
                </div>
              ) : (
                <img
                  src={uploadedFile.dataUrl}
                  alt={isZh ? "信件大图" : "Document large view"}
                  className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-md"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};