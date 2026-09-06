# CareLens

An AI assistant that helps older New Zealanders understand the things in front of them — an appliance they can't work out, a letter from WINZ, a text message that might be a scam.

Point the camera and ask out loud, upload a photo of a document, or paste a suspicious message. CareLens explains it back in plain language and reads the answer aloud.

**Live demo:** https://carelens-yslu.onrender.com/

---

## Why this exists

New Zealand's population aged 65 and over is projected to reach one million by 2028, up nearly 20% from 2022, and close to half of older people ageing at home live alone. Two problems come up repeatedly for that group:

- **Official paperwork is hard to parse.** WINZ notices, hospital appointment letters, power bills and council rates all arrive in formal English with important details buried in them.
- **Scams disproportionately target older people.** New Zealanders lose around $3 billion a year to scams, and the over-60s group loses more money than any other age band.

There are good products in this space, but none of them cover this. Elli Cares, built in Dunedin, focuses on medication reminders, safe zones and family co-ordination. Seeing AI and Be My AI do camera-based Q&A but are built for blind and low-vision users, not for New Zealand paperwork or local scam patterns.

CareLens sits in that gap: **see it, read it, don't get scammed.**

---

## What it does

### 1. Understand an item
Live camera plus voice. Point the phone at a microwave panel, a heat pump remote or a pill bottle and ask "which button defrosts?" — the model sees the video stream and answers out loud in real time, with live subtitles.

### 2. Understand official letters and bills
Upload or photograph a document. The response is broken into four fixed sections — what kind of letter it is, what it says, what you need to do, and key dates and amounts — so the important parts don't get lost in prose. You can also ask your own question about the document.

### 3. Check scam messages
Paste a text, upload a screenshot, or photograph the message. Returns a risk level, a plain-language list of the specific signals that led to that call (mismatched domain, urgency pressure, a fee that the real agency doesn't charge), and what to do next.

All three share one analysis pipeline: content in → model call → structured JSON → simplified language → spoken output.

---

## Built for older users

These aren't cosmetic choices; each one came out of testing the interface and finding it wanting.

- **Three text sizes (A / A+ / A++)** scale the whole layout proportionally, not just the type, so nothing overflows its container at the largest setting.
- **Speech defaults to 0.82× rate**, with a slower 0.70× option. The default was originally normal speed and was too fast to follow.
- **One voice across both languages.** A lower-pitched, steady voice is easier to hear with age-related high-frequency hearing loss, and carries better authority in the scam-checking context than a brighter one.
- **A global mute control**, because the app speaks on page load and a user in a library or a waiting room needs to be able to stop that.
- **Pause actually stops the stream.** It disables the microphone track and halts frame sending rather than only changing the button state — an earlier version only did the latter, which is a privacy problem.
- **Language switching re-requests the content.** Switching between English and 中文 sends the result back to the model to be regenerated in the new language, instead of swapping UI labels and leaving the AI's answer in the original language.
- **Medication safety.** The app reads what a label says; it does not advise on dosage or timing. Drug-related answers always append a line directing the user to their doctor or pharmacist.
- Every result carries a visible disclaimer that this is AI guidance and the original document or the official organisation is the authority.

---

## Architecture

```
Browser
  ├── Camera + mic ──WebSocket──> /api/live-stream ──> Gemini Live API
  └── Photo / text ──── POST ────> /api/analyze     ──> Gemini (structured JSON)
                        POST ────> /api/translate-result
                        POST ────> /api/tts
```

**One pipeline, three entry points.** Camera stills, uploaded files and pasted text all hit `/api/analyze` with a `mode` flag. The mode selects a system prompt and a `responseSchema`; everything downstream — rendering, translation, speech — is shared. Adding a fourth scenario means adding a prompt and a schema, not a new code path.

**Real-time is genuinely real-time.** `/api/live-stream` is a WebSocket bridge that holds an open Gemini Live session, forwarding video frames and audio in both directions. It is not a still capture dressed up as a conversation. A module-level lock guarantees one active session at a time — without it, re-entering the page opened a second connection and the two replies talked over each other.

**Graceful model fallback.** Analysis tries `gemini-3.1-flash-lite` first and falls back through `gemini-3.7-flash` to `gemini-flash-latest`. The lite model has a far higher free-tier daily request limit and is sufficient for this task, so the cheap path is the default rather than the fallback.

---

## Tech

React 19 · TypeScript · Vite · Tailwind 4 · Express · `ws` · `@google/genai`

| | Model |
|---|---|
| Live camera and voice | `gemini-3.1-flash-live-preview` |
| Document and scam analysis | `gemini-3.1-flash-lite` (with fallbacks) |
| Speech | `gemini-3.1-flash-tts-preview` |

---

## What I built, and what I didn't

Being straight about this: the vision, language and speech capabilities are Gemini's, called through its API. I did not train a model for this project.

The work is in the system design and the interaction: collapsing three user-facing scenarios onto one backend pipeline, managing the WebSocket session lifecycle so streams close when they should, designing the scam heuristics and the structured output schemas, building the language-switch flow so generated content is regenerated rather than relabelled, and making a set of accessibility decisions that actually hold up when you sit down and use the thing.

---

## Running locally

```bash
npm install
cp .env.example .env.local   # add your GEMINI_API_KEY
npm run dev
```

A Gemini API key is required — see the [Gemini API documentation](https://ai.google.dev/gemini-api/docs/api-key) for how to create one. The free tier is enough to try it: the live camera model has a generous request allowance, while the text and image models are capped per day.

## Deploying

Needs a host that supports persistent WebSocket connections — Render, Railway or Fly.io. Vercel's serverless functions can't hold an open socket, so the live camera feature won't work there even though the other two will.

```bash
npm run build   # vite build + esbuild bundle of the server
npm start
```

Set `GEMINI_API_KEY` in the host's environment variables.

---

## Where this would go next

- Multi-page documents — the analyse endpoint takes a single image today
- On-device fallback so a dropped connection doesn't end a conversation mid-sentence
- More languages; te reo Māori and Samoan matter for this user group in New Zealand
- Testing with actual older users, which I haven't done and which would probably invalidate a few of my assumptions above

---

## Data and privacy

Nothing is stored. Images and text go to the Gemini API for the length of one request and aren't written to disk or a database. The sample documents in the app are fabricated for demonstration — no real person's correspondence is included. Scam examples follow patterns published by CERT NZ and Netsafe.
