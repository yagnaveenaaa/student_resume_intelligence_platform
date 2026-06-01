import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';

const SYSTEM_PROMPT = `You are an expert career coach for students and early-career candidates.
Analyze the resume and produce a Student Resume Intelligence report.
Respond with ONLY valid JSON (no markdown, no code fences).

Use this exact schema:
{
  "atsScore": <integer 0-100>,
  "jobMatchScore": <integer 0-100>,
  "keywordGapAnalysis": {
    "missingKeywords": [<string>, ...],
    "presentKeywords": [<string>, ...],
    "recommendations": [<string>, ...]
  },
  "skillGapAnalysis": {
    "currentSkills": [<string>, ...],
    "missingSkills": [<string>, ...],
    "priorityToLearn": [<string>, ...]
  },
  "resumeRewriteSuggestions": [
    { "section": <string>, "before": <string>, "after": <string> }
  ],
  "projectRecommendations": [
    { "title": <string>, "description": <string>, "skillsBuilt": [<string>, ...], "why": <string> }
  ],
  "interviewQuestions": [
    { "topic": <string>, "question": <string>, "tip": <string> }
  ]
}

Rules:
- Tailor everything for a student or early-career candidate.
- atsScore: how well the resume passes typical ATS filters (structure, keywords, clarity).
- jobMatchScore: fit for the target role; use job description when provided, otherwise infer from target role.
- keywordGapAnalysis: 4-8 missing keywords, 4-8 present keywords, 3-5 recommendations.
- skillGapAnalysis: 4-8 current skills, 4-8 missing skills, 3-5 priority skills to learn.
- resumeRewriteSuggestions: 3-5 items with concrete before/after bullet improvements.
- projectRecommendations: 3-4 portfolio project ideas that close skill gaps.
- interviewQuestions: 5-7 role-relevant questions with brief answer tips.
- Base analysis only on the provided resume and job context.`;

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-flash-latest',
];
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

/**
 * @param {string} resumeText
 * @param {{ targetRole?: string; jobDescription?: string }} context
 */
export async function analyzeResume(resumeText, context = {}) {
  if (!config.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Add it to your .env file.');
  }

  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const modelsToTry = [...new Set([config.geminiModel, ...FALLBACK_MODELS])];
  let lastError = null;

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await requestAnalysis(genAI, modelName, resumeText, context);
        return parseAnalysis(result);
      } catch (error) {
        lastError = error;
        const message = error.message ?? String(error);

        if (!isRetryable(message)) {
          throw toUserError(message, modelName);
        }

        console.warn(`Gemini ${modelName} attempt ${attempt}/${MAX_ATTEMPTS}: ${message.slice(0, 100)}`);

        if (attempt < MAX_ATTEMPTS) {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }
  }

  throw toUserError(lastError?.message ?? 'Unknown error', config.geminiModel, true);
}

/**
 * @param {GoogleGenerativeAI} genAI
 * @param {string} modelName
 * @param {string} resumeText
 * @param {{ targetRole?: string; jobDescription?: string }} context
 */
async function requestAnalysis(genAI, modelName, resumeText, context) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  const targetRole = context.targetRole?.trim() || 'General entry-level role';
  const jobDescription = context.jobDescription?.trim() || 'Not provided — infer expectations from the target role.';

  return model.generateContent([
    { text: SYSTEM_PROMPT },
    {
      text: [
        `Target role: ${targetRole}`,
        `Job description:\n${jobDescription}`,
        `Resume text:\n\n${resumeText}`,
      ].join('\n\n'),
    },
  ]);
}

function parseAnalysis(result) {
  const raw = result.response.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Gemini returned invalid JSON. Please try again.');
  }

  return {
    atsScore: clampScore(parsed.atsScore, 'atsScore'),
    jobMatchScore: clampScore(parsed.jobMatchScore, 'jobMatchScore'),
    keywordGapAnalysis: parseKeywordGap(parsed.keywordGapAnalysis),
    skillGapAnalysis: parseSkillGap(parsed.skillGapAnalysis),
    resumeRewriteSuggestions: parseRewriteSuggestions(parsed.resumeRewriteSuggestions),
    projectRecommendations: parseProjectRecommendations(parsed.projectRecommendations),
    interviewQuestions: parseInterviewQuestions(parsed.interviewQuestions),
  };
}

function parseKeywordGap(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('Gemini returned invalid keywordGapAnalysis');
  }
  return {
    missingKeywords: ensureStringArray(value.missingKeywords, 'keywordGapAnalysis.missingKeywords'),
    presentKeywords: ensureStringArray(value.presentKeywords, 'keywordGapAnalysis.presentKeywords'),
    recommendations: ensureStringArray(value.recommendations, 'keywordGapAnalysis.recommendations'),
  };
}

function parseSkillGap(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('Gemini returned invalid skillGapAnalysis');
  }
  return {
    currentSkills: ensureStringArray(value.currentSkills, 'skillGapAnalysis.currentSkills'),
    missingSkills: ensureStringArray(value.missingSkills, 'skillGapAnalysis.missingSkills'),
    priorityToLearn: ensureStringArray(value.priorityToLearn, 'skillGapAnalysis.priorityToLearn'),
  };
}

function parseRewriteSuggestions(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Gemini returned invalid resumeRewriteSuggestions');
  }
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Gemini returned invalid resumeRewriteSuggestions[${index}]`);
    }
    return {
      section: ensureString(item.section, `resumeRewriteSuggestions[${index}].section`),
      before: ensureString(item.before, `resumeRewriteSuggestions[${index}].before`),
      after: ensureString(item.after, `resumeRewriteSuggestions[${index}].after`),
    };
  });
}

function parseProjectRecommendations(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Gemini returned invalid projectRecommendations');
  }
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Gemini returned invalid projectRecommendations[${index}]`);
    }
    return {
      title: ensureString(item.title, `projectRecommendations[${index}].title`),
      description: ensureString(item.description, `projectRecommendations[${index}].description`),
      skillsBuilt: ensureStringArray(item.skillsBuilt, `projectRecommendations[${index}].skillsBuilt`),
      why: ensureString(item.why, `projectRecommendations[${index}].why`),
    };
  });
}

function parseInterviewQuestions(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Gemini returned invalid interviewQuestions');
  }
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Gemini returned invalid interviewQuestions[${index}]`);
    }
    return {
      topic: ensureString(item.topic, `interviewQuestions[${index}].topic`),
      question: ensureString(item.question, `interviewQuestions[${index}].question`),
      tip: ensureString(item.tip, `interviewQuestions[${index}].tip`),
    };
  });
}

function isRetryable(message) {
  return (
    message.includes('503')
    || message.includes('429')
    || message.includes('high demand')
    || message.includes('quota')
    || message.includes('Unavailable')
  );
}

function toUserError(message, modelName, exhaustedRetries = false) {
  if (message.includes('429') || message.includes('quota')) {
    return new Error('Gemini API quota exceeded. Wait a minute and retry, or check billing at https://aistudio.google.com');
  }
  if (message.includes('503') || message.includes('high demand') || message.includes('Unavailable')) {
    if (exhaustedRetries) {
      return new Error('Gemini is busy right now (high demand). Wait 30–60 seconds and try again.');
    }
    return new Error('Gemini is temporarily busy. Retrying…');
  }
  if (message.includes('404') || message.includes('is not found')) {
    return new Error(
      `Model "${modelName}" is unavailable. Set GEMINI_MODEL in .env to gemini-2.0-flash or gemini-2.5-flash, then restart.`,
    );
  }
  if (message.includes('API key not valid') || message.includes('400')) {
    return new Error('Invalid GEMINI_API_KEY. Get a key from https://aistudio.google.com/apikey');
  }
  return new Error(`Gemini API error: ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampScore(value, field) {
  const n = Number(value);
  if (Number.isNaN(n)) {
    throw new Error(`Gemini returned an invalid ${field}`);
  }
  return Math.min(100, Math.max(0, Math.round(n)));
}

function ensureString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Gemini returned invalid ${field}`);
  }
  return value.trim();
}

function ensureStringArray(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Gemini returned invalid ${field}`);
  }
  return value;
}
