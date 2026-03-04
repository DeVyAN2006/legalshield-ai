const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const fallbackMessage =
  "I was unable to generate an AI explanation, but the retrieved legal sections below may help answer your question.";

/* ---------------- AI RISK CLASSIFIER ---------------- */

async function classifyRiskWithAI(question) {

  if (!GEMINI_API_KEY) return "Informational";

  const prompt = `
Classify the legal risk level of the user's statement.

Return ONLY ONE WORD from:
Informational
Medium
High
Critical

Statement:
"${question}"
`;

  try {

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        })
      }
    );

    if (!response.ok) return "Informational";

    const data = await response.json();

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map(p => p.text || "")
        .join("")
        .trim();

    const allowed = ["Informational", "Medium", "High", "Critical"];

    return allowed.includes(text) ? text : "Informational";

  } catch {
    return "Informational";
  }
}

/* ---------------- PROMPT BUILDER ---------------- */

function buildPrompt(question, relevantLaws) {

  const references = relevantLaws.length
    ? relevantLaws
        .map(
          law =>
            `${law.act} Section ${law.section} — ${law.title}\n${law.content}`
        )
        .join("\n\n")
    : "No statutory references retrieved.";

  return `
You are LexEase, an AI assistant specialized in Indian law.

Use ONLY the provided legal sections to answer the question.

Rules:
- Do not invent laws.
- Prefer the most relevant sections.
- Cite Act name and Section number.
- Write clearly for non-lawyers.

User Question:
${question}

Relevant Legal Sections:
${references}

Return ONLY JSON:

{
  "overview": "Short explanation of the legal rule",
  "legalAnalysis": "Detailed explanation referencing the sections",
  "citedSections": [
    {
      "act": "ACT NAME",
      "section": "SECTION NUMBER",
      "reason": "Why this section is relevant"
    }
  ]
}
`;
}

/* ---------------- GEMINI CALL ---------------- */

async function callGemini(prompt) {

  if (!GEMINI_API_KEY) return null;

  try {

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        })
      }
    );

  if (!response.ok) {
  console.log("Gemini API status:", response.status);
  const error = await response.text();
  console.log("Gemini API error:", error);
  return null;
  }

    const data = await response.json();

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map(p => p.text || "")
        .join("\n")
        .trim();

    return text;

  } catch {
    return null;
  }
}

/* ---------------- SAFE JSON PARSER ---------------- */

function extractJSON(text) {

  if (!text) return null;

  let cleaned = text.trim();

  // remove markdown
  cleaned = cleaned.replace(/```json/gi, "").replace(/```/g, "").trim();

  // try direct parse
  try {
    return JSON.parse(cleaned);
  } catch {}

  // attempt JSON extraction
  const match = cleaned.match(/\{[\s\S]*\}/);

  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }

  return null;
}

/* ---------------- MAIN GENERATOR ---------------- */

async function generateAnswer(question, relevantLaws, confidenceScore = 50) {

  const safeQuestion = typeof question === "string" ? question.trim() : "";
  const safeLaws = Array.isArray(relevantLaws) ? relevantLaws : [];

  if (!safeQuestion) {
    return {
      overview: fallbackMessage,
      legalAnalysis: "",
      citedSections: [],
      riskLevel: "Informational",
      confidence: confidenceScore,
      disclaimer:
        "⚠️ This AI-generated response is for informational purposes only and does not constitute legal advice."
    };
  }

  /* -------- Risk Classification -------- */

  const riskLevel = await classifyRiskWithAI(safeQuestion);

  /* -------- Gemini Answer -------- */

  const prompt = buildPrompt(safeQuestion, safeLaws);
  const rawResponse = await callGemini(prompt);

  const parsed = extractJSON(rawResponse);

  let response;

  if (!parsed) {

    response = {
      overview: fallbackMessage,
      legalAnalysis:
        "The AI explanation could not be generated, but the retrieved legal sections may still be useful.",
      citedSections: safeLaws.slice(0, 3).map(law => ({
        act: law.act,
        section: law.section,
        reason: "Retrieved as relevant to the query."
      }))
    };

  } else {

    response = parsed;

  }

  /* -------- Deduplicate citations -------- */

  if (Array.isArray(response.citedSections)) {

    const seen = new Set();

    response.citedSections = response.citedSections.filter(sec => {

      const key = `${sec.act}-${sec.section}`;

      if (seen.has(key)) return false;

      seen.add(key);

      return true;

    });

  }

  /* -------- Final fields -------- */

  response.riskLevel = riskLevel;
  response.confidence = confidenceScore;

  response.disclaimer =
    "⚠️ This AI-generated response is for informational purposes only and does not constitute legal advice.";

  return response;
}

module.exports = { generateAnswer };