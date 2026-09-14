import { Document, Packer } from 'docx';
import { markdownToDocxDocument } from './docx-builder.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_NAME = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

function safeParseJson(rawContent) {
  let content = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  content = content.replace(/^```[a-z]*\n?/gm, '').replace(/```$/gm, '').trim();

  try {
    return JSON.parse(content);
  } catch (err) {
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(content.slice(firstBrace, lastBrace + 1));
      } catch (e2) {}
    }

    let repaired = content;
    if (firstBrace !== -1 && (lastBrace === -1 || lastBrace < firstBrace)) {
      repaired = content.slice(firstBrace);
    }
    if ((repaired.match(/"/g) || []).length % 2 !== 0) {
      repaired += '"';
    }
    const openBraces = (repaired.match(/\{/g) || []).length - (repaired.match(/\}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length;
    for (let i = 0; i < Math.max(0, openBrackets); i++) repaired += ']';
    for (let i = 0; i < Math.max(0, openBraces); i++) repaired += '}';
    try {
      return JSON.parse(repaired);
    } catch (e3) {
      throw new Error(`Failed to parse AI JSON response: ${err.message}`);
    }
  }
}

async function callGroq(apiKey, systemPrompt, userMessage, temperature = 0.2, maxTokens = 4000, model = MODEL_NAME) {
  const payload = {
    model,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ]
  };

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Groq API Error (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  return safeParseJson(content);
}

function markdownToHtml(md) {
  let text = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Hyperlinks: [Text](url)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="cv-link">$1</a>');

  // Bare URLs (not already part of an href)
  text = text.replace(/(^|[\s(])(https?:\/\/[^\s)<]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer" class="cv-link">$2</a>');

  // Emails
  text = text.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1" class="cv-link">$1</a>');

  // Headers
  text = text.replace(/^# (.*$)/gim, '<h1 class="cv-name">$1</h1>');
  text = text.replace(/^## (.*$)/gim, '<h2 class="cv-section-title">$1</h2>');
  text = text.replace(/^### (.*$)/gim, '<h3 class="cv-item-title">$1</h3>');

  // Bold & Italic
  text = text.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/gim, '<em>$1</em>');

  // Wrap lists properly in <ul>
  const lines = text.split('\n');
  const processed = [];
  let inList = false;

  for (let line of lines) {
    const trimmed = line.trim();
    if (/^[-*]\s+/.test(trimmed)) {
      if (!inList) {
        processed.push('<ul class="cv-bullet-list">');
        inList = true;
      }
      processed.push('<li class="cv-bullet">' + trimmed.replace(/^[-*]\s+/, '') + '</li>');
    } else {
      if (inList) {
        processed.push('</ul>');
        inList = false;
      }
      if (trimmed.length > 0) {
        if (!trimmed.startsWith('<h1') && !trimmed.startsWith('<h2') && !trimmed.startsWith('<h3')) {
          processed.push('<p class="cv-p">' + trimmed + '</p>');
        } else {
          processed.push(trimmed);
        }
      }
    }
  }
  if (inList) {
    processed.push('</ul>');
  }

  return '<div class="cv-document">' + processed.join('\n') + '</div>';
}

export async function processOptimization({ cvText, jobDescription, targetRole, apiKey }) {
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is not configured.');
  }

  // Stage 1: Gap analysis & ATS keywords
  const stage1SystemPrompt = `You are an elite ATS recruitment specialist and career strategist.
Analyze the candidate's existing CV and target Job Description.
Perform a strict gap analysis:
1. Extract essential hard skills, tools, and methodologies required by the JD that are missing or underrepresented in the CV.
2. Identify soft skills and leadership indicators emphasized in the JD.
3. Determine the primary target job title.

Return strictly valid JSON with this schema (no conversational text):
{
  "target_role": "Target Job Title",
  "initial_ats_score": 60,
  "high_priority_keywords": ["keyword1", "keyword2"],
  "medium_priority_keywords": ["keyword3", "keyword4"],
  "strategic_advice": "1-2 sentence core positioning strategy"
}`;

  const stage1UserMsg = `CANDIDATE CV:\n${cvText}\n\nTARGET JOB DESCRIPTION:\n${jobDescription}\n\nTARGET ROLE HINT: ${targetRole || 'Best fit'}`;

  const stage1Result = await callGroq(apiKey, stage1SystemPrompt, stage1UserMsg, 0.2, 1800, process.env.GROQ_STAGE1_MODEL || 'openai/gpt-oss-120b');

  const keywords = [
    ...(stage1Result.high_priority_keywords || []),
    ...(stage1Result.medium_priority_keywords || [])
  ];

  // Stage 2: Strategic CV rewrite
  const stage2SystemPrompt = `You are a world-class executive CV writer and ATS optimization engine.
Take the candidate's original CV, the target Job Description, and the Gap Analysis keywords, and produce a fully tailored, ATS-compliant CV.

CRITICAL CONSTRAINTS:
1. ZERO FABRICATION: Retain truthful career history, dates, degrees, company names, and core responsibilities. Never invent untrue achievements or jobs.
2. PRESERVE CONTACTS & HYPERLINKS: Retain all contact info, emails, phone numbers, and profile links (LinkedIn, GitHub, Portfolio, Website). Format all hyperlinks cleanly as Markdown links: [Label](https://...) or raw URLs.
3. STRATEGIC POSITIONING: Tailor the Professional Summary and Subtitle specifically for the target role.
4. HIGH IMPACT BULLETS: Rewrite experience bullet points using strong action verbs and the Google XYZ format ("Accomplished [X] as measured by [Y] by doing [Z]"). Weave in the target keywords seamlessly.
5. CLEAN MARKDOWN: The optimized CV MUST be formatted in standard Markdown with standard headings (# Header, ## Summary, ## Skills, ## Experience, ## Education, ## Projects/Certifications).
6. CHANGE TRACKING: Document 5 to 10 significant bullet enhancements in the changes array.

Return strictly valid JSON with this schema:
{
  "target_title": "Job Title",
  "projected_ats_score": 94,
  "keywords_injected": ["keyword1", "keyword2"],
  "changes": [
    {
      "section": "Experience - Company Name",
      "original": "Original CV bullet or excerpt",
      "updated": "Enhanced bullet with action verbs & keywords",
      "keywords_added": ["term1"]
    }
  ],
  "optimized_markdown": "# Candidate Name\\n**Target Role** | Contact Info | [LinkedIn](https://...) | email@example.com\\n\\n## Professional Summary\\n...\\n\\n## Core Competencies\\n...\\n\\n## Professional Experience\\n...\\n\\n## Education\\n..."
}`;

  const stage2UserMsg = `ORIGINAL CV:\n${cvText}\n\nTARGET JOB DESCRIPTION:\n${jobDescription}\n\nKEYWORDS TO WEAVE IN:\n${keywords.join(', ')}\n\nTARGET POSITIONING:\n${stage1Result.strategic_advice || ''}`;

  const stage2Result = await callGroq(apiKey, stage2SystemPrompt, stage2UserMsg, 0.3, 3500, process.env.GROQ_STAGE2_MODEL || 'openai/gpt-oss-120b');

  const markdown = stage2Result.optimized_markdown || '';
  const html = markdownToHtml(markdown);
  const plainText = markdown.replace(/[#*`_]/g, '');

  // Generate genuine .docx file base64
  let docxBase64 = null;
  try {
    const docxDoc = markdownToDocxDocument(markdown);
    const docxBuffer = await Packer.toBuffer(docxDoc);
    docxBase64 = docxBuffer.toString('base64');
  } catch (docxErr) {
    console.error('Docx generation error:', docxErr);
  }

  return {
    targetTitle: stage2Result.target_title || targetRole || 'Target Role',
    optimizedMarkdown: markdown,
    optimizedHtml: html,
    optimizedText: plainText,
    docxBase64,
    stats: {
      initialAtsScore: stage1Result.initial_ats_score || 60,
      projectedAtsScore: stage2Result.projected_ats_score || 94,
      keywordsCount: (stage2Result.keywords_injected || keywords).length,
      changesCount: (stage2Result.changes || []).length
    },
    keywordsInjected: stage2Result.keywords_injected || keywords,
    changes: stage2Result.changes || []
  };
}

// Vercel Serverless Function Handler
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { cvText, jobDescription, targetRole } = body;

    if (!cvText || cvText.trim().length < 30) {
      return res.status(400).json({ status: 'error', message: 'CV text is required (min 30 characters).' });
    }
    if (!jobDescription || jobDescription.trim().length < 30) {
      return res.status(400).json({ status: 'error', message: 'Job description is required (min 30 characters).' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    const result = await processOptimization({ cvText, jobDescription, targetRole, apiKey });

    return res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
