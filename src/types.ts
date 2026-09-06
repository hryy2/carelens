export type AppMode = 'home' | 'camera' | 'document' | 'scam';

export type Language = 'en' | 'zh';

export type FontSize = 'normal' | 'large' | 'extra-large';

export type RiskLevel = 'safe' | 'caution' | 'scam';

export interface AnalysisResult {
  id: string;
  mode: AppMode;
  userQuestion?: string;
  title: string;
  summary: string; // Plain-spoken spoken summary for TTS
  detailedExplanation: string;
  actionSteps?: string[];
  riskLevel?: RiskLevel;
  riskReason?: string;
  keyDetails?: { [key: string]: string };
  suggestedQuestions?: string[];
  audioBase64?: string;
  timestamp: number;
}

export interface PresetSample {
  id: string;
  mode: 'camera' | 'document' | 'scam';
  title: { en: string; zh: string };
  description: { en: string; zh: string };
  category: string;
  imageUrl?: string;
  text?: string;
  defaultQuestion?: { en: string; zh: string };
}
