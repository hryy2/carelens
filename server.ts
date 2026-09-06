import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, Modality, LiveServerMessage } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Body parser middleware with generous limit for image payloads
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Helper to lazily initialize Gemini SDK
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'CareLens', timestamp: new Date().toISOString() });
});

// 1. Unified Senior-Friendly Analysis Endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { mode, language = 'en', question, text, imageBase64, mimeType = 'image/jpeg' } = req.body;

    const isZh = language === 'zh';

    // Tailored system prompt based on mode and senior accessibility requirements
    let systemInstruction = `You are CareLens, a compassionate, ultra-clear AI life and voice assistant designed specifically for elderly seniors living in New Zealand (including solo seniors).
Your communication principles:
1. VOICE FIRST & ULTRA-PLAIN LANGUAGE: Use warm, patient, everyday spoken words. Avoid technical jargon, legal speak, or confusing acronyms.
2. CONCISE & ACTIONABLE: Seniors need to immediately understand: "What is this?" and "What do I need to do right now (if anything)?"
3. REASSURING & CALM: Never induce panic or fear.
4. NZ LOCAL CONTEXT: Recognize NZ government bodies and services like WINZ (Work and Income), Te Whatu Ora (Health NZ hospitals & clinics), NZTA Waka Kotahi, IRD (Inland Revenue), Superannuation, Rates bills, and common local NZ scam patterns (fake toll fee SMS, fake parcel fees).
`;

    if (mode === 'camera') {
      systemInstruction += `\nSCENARIO: ITEM & APPLIANCE IDENTIFICATION & USAGE GUIDANCE.
- Identify the appliance, control panel, remote, or household item shown.
- Provide simple, numbered step-by-step instructions on how to operate it based on the user's question (e.g. which button to press, temperature to set).
- Keep instructions direct, e.g. "Step 1: Press the round Power button on the bottom right."
- MANDATORY MEDICATION SAFETY RULE: If the item is a medicine bottle, prescription box, or pill container, your scope is STRICTLY to read and clarify what is written on the label (e.g. medicine name, label text). DO NOT provide medical dosage advice or tell the user how/when to take medication. You MUST append the following mandatory reminder to your summary:
  ${isZh ? '“以上是标签上的文字内容，具体用法用量请遵医嘱或咨询药剂师。”' : '"This is what the label says. Please follow your doctor\'s or pharmacist\'s instructions for how to take it."'}
  Our product positioning is "helping you clearly see what is on the label", NOT "telling you how to take medicine".`;
    } else if (mode === 'document') {
      systemInstruction += `\nSCENARIO: OFFICIAL LETTER, MEDICAL NOTICE & BILL EXPLAINER.
- Clearly extract: Who sent this, what it is about, any payment amount or appointment date/location.
- State clearly if ANY action is needed (e.g. "No action needed, money will be deposited automatically" or "Please visit hospital on 17 Sep at 10 AM").
- Reassure the user so they do not feel stressed about official paperwork.`;
    } else if (mode === 'scam') {
      systemInstruction += `\nSCENARIO: SCAM & SUSPICIOUS MESSAGE IDENTIFICATION.
- Assess risk: 'scam' (high risk), 'caution' (suspicious/unverified), or 'safe' (legitimate).
- Explain the telltale signs gently (e.g. fake website domain ending in .top/.xyz instead of official .govt.nz or .co.nz, urgent demands for payment or card PINs).
- Give immediate comforting advice: "Do not click any link, do not reply, and you have NOT lost any money. Simply delete this message."`;
    }

    if (question && typeof question === 'string' && question.trim().length > 0) {
      systemInstruction += `\n[CRITICAL HIGHEST PRIORITY - USER QUESTION]:
The user explicitly asked: "${question.trim()}".
You MUST directly and specifically answer this question in your title, spoken summary, and detailed explanation, in addition to explaining the document/appliance/scam status.`;
    }

    if (isZh) {
      systemInstruction += `\n[MANDATORY OUTPUT LANGUAGE]:
You MUST write all output fields (title, summary, detailedExplanation, actionSteps, riskReason, keyDetails, suggestedQuestions) ENTIRELY in fluent, warm Simplified Chinese (简体中文). Keep sentences conversational, slow-paced, and reassuring for elderly Chinese seniors in New Zealand. Do NOT output English explanations.`;
    } else {
      systemInstruction += `\n[MANDATORY OUTPUT LANGUAGE]:
You MUST write all output fields (title, summary, detailedExplanation, actionSteps, riskReason, keyDetails, suggestedQuestions) ENTIRELY in clear, friendly English. Even if the user question, document text, or image contains Chinese or other languages, translate and answer 100% in English. Do NOT output Chinese characters in any JSON fields.`;
    }

    // Prepare content parts
    const parts: any[] = [];

    // Add image/pdf if provided
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanBase64,
        },
      });
    }

    // Prompt content
    let userPromptText = `Please analyze the following request for an elderly senior user.\n`;
    if (question && question.trim()) {
      userPromptText += `[Specific User Question to Answer Directly]: "${question.trim()}"\n`;
    }
    if (text && text.trim()) {
      userPromptText += `[Document / Message Text]:\n"""\n${text.trim()}\n"""\n`;
    }
    if (!question && !text && imageBase64) {
      userPromptText += `Please inspect this image and explain clearly what it is and what the senior needs to know.`;
    }

    parts.push({ text: userPromptText });

    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-flash-latest'];
    let lastError: any = null;
    let parsed: any = null;

    for (let i = 0; i < modelsToTry.length; i++) {
      const modelName = modelsToTry[i];
      try {
        const response = await getAI().models.generateContent({
          model: modelName,
          contents: { parts },
          config: {
            systemInstruction,
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: 'Short, clear, friendly title summarizing the item or document',
                },
                summary: {
                  type: Type.STRING,
                  description:
                    'Concise 2 to 3 sentence plain-spoken summary optimized for reading aloud via Voice (TTS). Direct, simple, warm.',
                },
                detailedExplanation: {
                  type: Type.STRING,
                  description: 'Clear explanation in plain language explaining the details.',
                },
                actionSteps: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'List of clear, simple, numbered actionable steps for the senior to do right now.',
                },
                riskLevel: {
                  type: Type.STRING,
                  enum: ['safe', 'caution', 'scam'],
                  description: 'For scam detection: safe, caution, or scam.',
                },
                riskReason: {
                  type: Type.STRING,
                  description: 'Gentle explanation of why this is safe or a scam.',
                },
                keyDetails: {
                  type: Type.OBJECT,
                  description: 'Key key-value pairs (e.g. Sender, Amount, Date, Next Action, Item Model).',
                  properties: {
                    senderOrBrand: { type: Type.STRING },
                    keyDateOrTime: { type: Type.STRING },
                    amountOrCost: { type: Type.STRING },
                    actionNeeded: { type: Type.STRING },
                  },
                },
                suggestedQuestions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '2 to 3 simple follow-up questions the elderly user can tap to ask.',
                },
              },
              required: ['title', 'summary', 'detailedExplanation', 'actionSteps'],
            },
          },
        });

        const rawText = response.text || '{}';
        try {
          parsed = JSON.parse(rawText);
        } catch {
          const match = rawText.match(/\{[\s\S]*\}/);
          parsed = match ? JSON.parse(match[0]) : {};
        }

        if (parsed && (parsed.title || parsed.summary)) {
          break; // Success!
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Attempt with ${modelName} encountered error:`, err.message || err);
        // Wait before trying the next fallback model (longer backoff if 429 rate limited)
        const isRateLimit = String(err.message || '').includes('429') || String(err.message || '').includes('quota') || String(err.status || '') === 'RESOURCE_EXHAUSTED';
        await new Promise((r) => setTimeout(r, isRateLimit ? 1000 : 300));
      }
    }

    if (!parsed || (!parsed.title && !parsed.summary)) {
      if (lastError) {
        console.error('All model attempts failed:', lastError);
        throw lastError;
      }
    }

    // Return structured result
    res.json({
      success: true,
      data: {
        id: 'res_' + Date.now(),
        mode,
        userQuestion: question ? question.trim() : undefined,
        title: parsed.title || (isZh ? '识别分析结果' : 'Analysis Result'),
        summary: parsed.summary || '',
        detailedExplanation: parsed.detailedExplanation || '',
        actionSteps: parsed.actionSteps || [],
        riskLevel: parsed.riskLevel || (mode === 'scam' ? 'caution' : undefined),
        riskReason: parsed.riskReason || '',
        keyDetails: parsed.keyDetails || {},
        suggestedQuestions: parsed.suggestedQuestions || [],
        timestamp: Date.now(),
      },
    });
  } catch (error: any) {
    console.error('Error analyzing request:', error);
    let errorMsg = error.message || 'Failed to analyze item or document. Please try again.';
    const isZh = req.body?.language === 'zh';
    if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      errorMsg = isZh
        ? 'AI 助手当前请求较多，请稍等 10-15 秒后再试一次。'
        : 'The AI assistant is temporarily busy handling requests. Please wait 10-15 seconds and try again.';
    }
    res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
});

// 2. High-Quality Gemini Speech Generation (TTS) Endpoint
app.post('/api/tts', async (req, res) => {
  try {
    const { text, language = 'en' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing text for speech generation' });
    }

    // Limit text length to prevent excessively long audio requests
    const cleanText = text.slice(0, 500);

    // Call gemini-3.1-flash-tts-preview with unified calm, authoritative, low-frequency baritone voice (Charon)
    const response = await getAI().models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [
        {
          parts: [
            {
              text: `${cleanText}`,
            },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            // 'Charon' provides a calm, clear, lower-pitched voice that is easier to comprehend for seniors and consistent across languages
            prebuiltVoiceConfig: { voiceName: 'Charon' },
          },
        },
      },
    });

    const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (audioBase64) {
      res.json({ success: true, audioBase64, mimeType: 'audio/mp3' });
    } else {
      res.json({ success: false, fallback: true, message: 'Audio output not generated directly' });
    }
  } catch (error: any) {
    console.warn('Gemini TTS warning (client will fallback to browser speech synthesis):', error.message);
    res.json({ success: false, fallback: true, error: error.message });
  }
});

// 3. Complete Result Translation & Re-Explanation Endpoint (for seamless language switching)
app.post('/api/translate-result', async (req, res) => {
  try {
    const { result, targetLanguage } = req.body;
    if (!result || !targetLanguage) {
      return res.status(400).json({ success: false, error: 'Missing result or targetLanguage' });
    }

    const isZh = targetLanguage === 'zh';
    const systemInstruction = isZh
      ? `You are CareLens, a compassionate AI assistant for elderly seniors in New Zealand.
Your task is to take an existing analysis result and COMPLETELY translate and adapt ALL content into fluent, warm Simplified Chinese (简体中文).

MANDATORY RULES:
1. Every single string field (userQuestion, title, summary, detailedExplanation, actionSteps, riskReason, keyDetails, suggestedQuestions) MUST be translated into Simplified Chinese (简体中文).
2. Do NOT output English sentences or leave fields in English.
3. Keep the tone warm, patient, and easy to understand for elderly seniors.
4. Keep the summary concise (2-3 sentences) suitable for speech reading.
5. Preserve accurate numbers, amounts (e.g. $NZD), dates, and phone numbers.`
      : `You are CareLens, a compassionate AI assistant for elderly seniors in New Zealand.
Your task is to take an existing analysis result and COMPLETELY translate and adapt ALL content into clear, simple, friendly English.

MANDATORY RULES:
1. Every single string field (userQuestion, title, summary, detailedExplanation, actionSteps, riskReason, keyDetails, suggestedQuestions) MUST be translated into 100% plain English.
2. Absolutely NO Chinese characters are allowed in ANY output field (userQuestion, title, summary, detailedExplanation, actionSteps, riskReason, keyDetails, suggestedQuestions).
3. Keep the tone warm, patient, and easy to understand for elderly seniors.
4. Keep the summary concise (2-3 sentences) suitable for speech reading.
5. Preserve accurate numbers, amounts (e.g. $NZD), dates, and phone numbers.`;

    const promptText = isZh
      ? `Please translate and adapt the following analysis result from English into Simplified Chinese (简体中文). Every string field MUST be in Simplified Chinese:\n${JSON.stringify(
          result,
          null,
          2
        )}`
      : `Please translate and adapt the following analysis result from Chinese into English. Every single field MUST be translated into 100% English with NO Chinese characters at all:\n${JSON.stringify(
          result,
          null,
          2
        )}`;

    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest'];
    let lastError: any = null;
    let parsed: any = null;

    const hasChinese = (text: string) => /[\u4e00-\u9fa5]/.test(text || '');

    for (let i = 0; i < modelsToTry.length; i++) {
      const modelName = modelsToTry[i];
      try {
        const response = await getAI().models.generateContent({
          model: modelName,
          contents: promptText,
          config: {
            systemInstruction,
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                userQuestion: {
                  type: Type.STRING,
                  description: isZh
                    ? 'The user question translated into Simplified Chinese'
                    : 'The user question translated into 100% plain English',
                },
                title: {
                  type: Type.STRING,
                  description: isZh
                    ? 'Title in Simplified Chinese'
                    : 'Title in 100% plain English',
                },
                summary: {
                  type: Type.STRING,
                  description: isZh
                    ? 'Plain-spoken summary in Simplified Chinese'
                    : 'Plain-spoken summary in 100% plain English',
                },
                detailedExplanation: {
                  type: Type.STRING,
                  description: isZh
                    ? 'Detailed explanation in Simplified Chinese'
                    : 'Detailed explanation in 100% plain English',
                },
                actionSteps: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: isZh
                    ? 'Step-by-step action items in Simplified Chinese'
                    : 'Step-by-step action items in 100% plain English',
                },
                riskLevel: {
                  type: Type.STRING,
                  enum: ['safe', 'caution', 'scam'],
                },
                riskReason: {
                  type: Type.STRING,
                  description: isZh
                    ? 'Risk reason in Simplified Chinese'
                    : 'Risk reason in 100% plain English',
                },
                keyDetails: {
                  type: Type.OBJECT,
                  description: isZh
                    ? 'Key details in Simplified Chinese'
                    : 'Key details in 100% plain English',
                  properties: {
                    senderOrBrand: { type: Type.STRING },
                    keyDateOrTime: { type: Type.STRING },
                    amountOrCost: { type: Type.STRING },
                    actionNeeded: { type: Type.STRING },
                  },
                },
                suggestedQuestions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: isZh
                    ? 'Suggested follow-up questions in Simplified Chinese'
                    : 'Suggested follow-up questions in 100% plain English',
                },
              },
              required: ['title', 'summary', 'detailedExplanation', 'actionSteps'],
            },
          },
        });

        const rawText = response.text || '{}';
        try {
          parsed = JSON.parse(rawText);
        } catch {
          const match = rawText.match(/\{[\s\S]*\}/);
          parsed = match ? JSON.parse(match[0]) : {};
        }

        if (parsed && (parsed.title || parsed.summary)) {
          // If target is English, verify that title and summary do not retain Chinese characters
          if (!isZh && (hasChinese(parsed.title) || hasChinese(parsed.summary))) {
            console.warn(`Translation attempt with ${modelName} returned Chinese characters for English target. Retrying with fallback model...`);
            continue;
          }
          // If target is Chinese, verify that title or summary contains Chinese characters
          if (isZh && !hasChinese(parsed.title || '') && !hasChinese(parsed.summary || '')) {
            console.warn(`Translation attempt with ${modelName} returned English for Chinese target. Retrying with fallback model...`);
            continue;
          }
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Translation attempt with ${modelName} failed:`, err.message || err);
        const isRateLimit = String(err.message || '').includes('429') || String(err.message || '').includes('quota') || String(err.status || '') === 'RESOURCE_EXHAUSTED';
        await new Promise((r) => setTimeout(r, isRateLimit ? 1000 : 300));
      }
    }

    if (!parsed || (!parsed.title && !parsed.summary)) {
      if (lastError) throw lastError;
      throw new Error('Failed to generate translated result');
    }

    res.json({
      success: true,
      data: {
        ...result,
        ...parsed,
        userQuestion: parsed.userQuestion || result.userQuestion,
        timestamp: Date.now(),
      },
    });
  } catch (error: any) {
    console.error('Error translating result:', error);
    let errorMsg = error.message || 'Failed to translate result into target language.';
    const isZh = req.body?.targetLanguage === 'zh';
    if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      errorMsg = isZh
        ? 'AI 助手当前响应繁忙，请稍等片刻后重试切换语言。'
        : 'The AI assistant is temporarily busy. Please wait a moment and try switching language again.';
    }
    res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
});

// 4. Gemini Live API WebSocket Bridge for Real-Time Multimodal Interaction
async function setupLiveWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/api/live-stream' });

  wss.on('connection', async (clientWs: WebSocket, req) => {
    console.log('Client connected to CareLens Gemini Live Stream');

    let session: any = null;
    let isSessionOpen = false;

    const cleanup = async () => {
      isSessionOpen = false;
      if (session) {
        try {
          await session.close();
        } catch (e) {
          console.warn('Live session close error:', e);
        }
        session = null;
      }
    };

    // Client message handler
    clientWs.on('message', async (data) => {
      try {
        const payload = JSON.parse(data.toString());

        // Initialize Live Session with specified language and options
        if (payload.type === 'init') {
          await cleanup();

          const language = payload.language || 'en';
          const isZh = language === 'zh';

          const systemInstruction = `You are CareLens Live, a warm, patient, and ultra-clear real-time visual & voice companion for elderly seniors living in New Zealand.
You are directly observing the senior's continuous live camera stream (appliances, control panels, remotes, microwave ovens, stoves, heat pumps, washing machines, medicine bottles, letters).
COMMUNICATION RULES FOR LIVE INTERACTION:
1. Speak in concise, warm, natural spoken sentences (${isZh ? 'fluent Chinese / 简体中文' : 'friendly New Zealand English'}).
2. Seniors are actively looking and listening right now. Keep your immediate voice answers short (1 to 3 friendly sentences at a time) and direct.
3. Guide their eyes and hands to specific controls: e.g. "I see your microwave. Look at the round dial on the right side, turn it clockwise to set the time, then press the green Start button below."
4. If the senior asks a question or speaks, respond immediately. If you see the button they are pointing to, confirm it in real time.
5. MANDATORY MEDICATION SAFETY: If inspecting medicine bottles or prescription labels, strictly read what text is printed on the label. Never give medical dosage advice or tell the senior how to take medication. Conclude with: "${isZh ? '以上是标签上的文字内容，具体用法用量请遵医嘱或咨询药剂师。' : "This is what the label says. Please follow your doctor's or pharmacist's instructions for how to take it."}"`;

          try {
            session = await getAI().live.connect({
              model: 'gemini-3.1-flash-live-preview',
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      // Unified calm, clear, low-pitched voice (Charon) for both English and Chinese
                      voiceName: 'Charon',
                    },
                  },
                },
                systemInstruction,
                outputAudioTranscription: {},
                inputAudioTranscription: {},
              },
              callbacks: {
                onmessage: (message: LiveServerMessage) => {
                  if (clientWs.readyState !== WebSocket.OPEN) return;

                  // 1. Audio stream chunks from Gemini
                  const parts = message.serverContent?.modelTurn?.parts;
                  if (parts) {
                    for (const part of parts) {
                      if (part.inlineData?.data) {
                        clientWs.send(
                          JSON.stringify({
                            type: 'audio',
                            data: part.inlineData.data,
                          })
                        );
                      }
                      if (part.text) {
                        clientWs.send(
                          JSON.stringify({
                            type: 'text',
                            text: part.text,
                          })
                        );
                      }
                    }
                  }

                  // 2. Transcription
                  const outputText = (message.serverContent as any)?.outputTranscription?.text || (message.serverContent as any)?.outputAudioTranscription?.text;
                  if (outputText) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'output_transcription',
                        text: outputText,
                      })
                    );
                  }

                  const inputText = (message.serverContent as any)?.inputTranscription?.text || (message.serverContent as any)?.inputAudioTranscription?.text;
                  if (inputText) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'input_transcription',
                        text: inputText,
                      })
                    );
                  }

                  // 3. User interruption
                  if (message.serverContent?.interrupted) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'interrupted',
                      })
                    );
                  }

                  // 4. Turn complete
                  if (message.serverContent?.turnComplete) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'turn_complete',
                      })
                    );
                  }
                },
                onclose: () => {
                  isSessionOpen = false;
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ type: 'session_closed' }));
                  }
                },
                onerror: (err: any) => {
                  console.error('Gemini Live session error:', err);
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'error',
                        message: err.message || 'Live session error',
                      })
                    );
                  }
                },
              },
            });

            isSessionOpen = true;
            clientWs.send(JSON.stringify({ type: 'ready' }));
          } catch (initErr: any) {
            console.error('Failed to connect to Gemini Live API:', initErr);
            clientWs.send(
              JSON.stringify({
                type: 'error',
                message: initErr.message || 'Failed to initialize Gemini Live session',
              })
            );
          }
          return;
        }

        if (payload.type === 'pause') {
          // Client paused - do not send any inputs to Gemini Live
          return;
        }

        if (payload.type === 'resume') {
          return;
        }

        if (!session || !isSessionOpen) {
          return;
        }

        // Realtime User Audio Input (PCM 16kHz Little-Endian Base64)
        if (payload.type === 'audio' && payload.data) {
          session.sendRealtimeInput({
            audio: {
              data: payload.data,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        }

        // Realtime Video Frame Input (JPEG Base64)
        if (payload.type === 'video' && payload.data) {
          session.sendRealtimeInput({
            video: {
              data: payload.data,
              mimeType: 'image/jpeg',
            },
          });
        }

        // Realtime Spoken / Typed Text prompt
        if (payload.type === 'text' && payload.text) {
          session.sendRealtimeInput({
            text: payload.text,
          });
        }
      } catch (err: any) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    clientWs.on('close', () => {
      console.log('Client disconnected from CareLens Live Stream');
      cleanup();
    });

    clientWs.on('error', (err) => {
      console.warn('WebSocket client error:', err);
      cleanup();
    });
  });
}

// 4. Mount Vite Middleware for Dev and Static Handler for Production
async function startServer() {
  const server = http.createServer(app);

  // Setup WebSocket Server for Live Stream
  await setupLiveWebSocket(server);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`CareLens server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start CareLens server:', err);
  process.exit(1);
});
