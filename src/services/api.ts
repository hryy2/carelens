import { AnalysisResult, AppMode, Language } from '../types';

interface AnalyzeParams {
  mode: AppMode;
  language: Language;
  question?: string;
  text?: string;
  imageBase64?: string;
  mimeType?: string;
}

export async function analyzeContent(params: AnalyzeParams): Promise<AnalysisResult> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    let msg = errJson.error || `Server error (${response.status})`;
    try {
      if (typeof msg === 'string' && msg.startsWith('{')) {
        const parsedErr = JSON.parse(msg);
        if (parsedErr.error?.message) {
          msg = parsedErr.error.message;
        }
      }
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to analyze');
  }

  return result.data;
}

export async function translateResult(
  result: AnalysisResult,
  targetLanguage: Language
): Promise<AnalysisResult> {
  const response = await fetch('/api/translate-result', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ result, targetLanguage }),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.error || 'Failed to translate result');
  }

  const res = await response.json();
  if (!res.success || !res.data) {
    throw new Error(res.error || 'Failed to translate result');
  }

  return res.data;
}
