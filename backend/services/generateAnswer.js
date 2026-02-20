const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const fallbackMessage =
  "I was unable to generate an answer at this time. Please try again in a moment.";

function buildPrompt(question, relevantLaws) {
  const hasLaws = Array.isArray(relevantLaws) && relevantLaws.length > 0;

  let referencesSection =
    "No specific statutory references are available. Provide a general informational answer only.\n";

  if (hasLaws) {
    const formatted = relevantLaws
      .map((law, index) => {
        const label =
          law.title || law.name || law.section || `Law ${index + 1}`;
        const text = JSON.stringify(law);
        return `- ${label}: ${text}`;
      })
      .join("\n");

    referencesSection =
      "Use the following legal materials as non-exhaustive references. Cite them in your answer where relevant:\n" +
      formatted;
  }

  return (
    "You are LexEase, a professional legal assistant. Simplify the legal content clearly for a general user.\n\n" +
    "Provide:\n" +
    "1) A clear plain-English overview of the document.\n" +
    "2) A list of important legal clauses in the document.\n" +
    "   For each clause, provide:\n" +
    "   - A short title\n" +
    "   - A brief 1–2 sentence explanation in simple language\n\n" +
    "Return STRICTLY in this JSON format:\n" +
    "{\n" +
    '  "overview": "...",\n' +
    '  "keyClauses": [\n' +
    '    { "title": "...", "description": "..." }\n' +
    "  ]\n" +
    "}\n\n" +
    "Do NOT wrap the JSON in markdown.\n\n" +
    "User question:\n" +
    question +
    "\n\n" +
    "Available legal references:\n" +
    referencesSection
  );
}

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set");
    return fallbackMessage;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      console.error("Gemini API error:", response.status);
      const errorText = await response.text();
      console.error(errorText);
      return fallbackMessage;
    }

    const data = await response.json();

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("\n")
        .trim() || "";

    if (!text) {
      console.error("Gemini API returned empty content");
      return fallbackMessage;
    }

    return text;
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return fallbackMessage;
  }
}

async function generateAnswer(question, relevantLaws) {
  const safeQuestion = typeof question === "string" ? question.trim() : "";
  const safeLaws = Array.isArray(relevantLaws) ? relevantLaws : [];

  if (!safeQuestion) {
    return fallbackMessage;
  }

  const prompt = buildPrompt(safeQuestion, safeLaws);
  const rawResponse = await callGemini(prompt);

  // 🔥 Remove markdown wrapping if Gemini adds ```json blocks
  let cleaned = rawResponse.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch {
    return {
      overview: cleaned,
      keyClauses: [
        {
          title: "General Summary",
          description: "Structured clause extraction unavailable."
        }
      ]
    };
  }
}

module.exports = { generateAnswer };