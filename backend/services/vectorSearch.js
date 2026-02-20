const fs = require("fs");
const path = require("path");

const lawsFilePath = path.join(__dirname, "..", "laws.json");

// 🔥 Debug path AFTER declaration
console.log("Looking for laws at:", lawsFilePath);

let cachedLaws = null;

async function loadLaws() {
  try {
    if (cachedLaws) return cachedLaws;

    const data = await fs.promises.readFile(lawsFilePath, "utf-8");
    const parsed = JSON.parse(data);

    console.log("Loaded laws count:", Array.isArray(parsed) ? parsed.length : 0);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [];
    }

    cachedLaws = parsed;
    return parsed;

  } catch (error) {
    console.error("Error reading laws.json:", error.message);
    return [];
  }
}

function extractLawText(law) {
  if (!law || typeof law !== "object") {
    return "";
  }

  return Object.values(law)
    .filter(value => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

async function vectorSearch(question) {
  const laws = await loadLaws();

  console.log("Vector search laws length:", laws.length);

  if (!laws.length) {
    return [];
  }

  const normalizedQuestion = String(question || "").toLowerCase();

  const keywords = normalizedQuestion
    .split(/\W+/)
    .filter(token => token.length > 2);

  if (!keywords.length) {
    return laws.slice(0, 5);
  }

  const scored = laws.map(law => {
    const text = extractLawText(law);
    let score = 0;

    keywords.forEach(keyword => {
      if (text.includes(keyword)) {
        score += 1;
      }
    });

    return { law, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const topMatches = scored
    .filter(item => item.score > 0)
    .slice(0, 5)
    .map(item => item.law);

  if (topMatches.length === 0) {
    return laws.slice(0, 5);
  }

  return topMatches;
}

module.exports = { vectorSearch };