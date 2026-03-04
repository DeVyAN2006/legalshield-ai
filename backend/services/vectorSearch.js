const fs = require("fs");
const path = require("path");

const lawsFilePath = path.join(__dirname, "..", "processed_laws", "laws.json");

let laws = [];
let vocabulary = new Map();
let lawVectors = [];
let initialized = false;

/* ---------------- TEXT CLEANING ---------------- */

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(word => word.length > 2);
}

/* ---------------- LEGAL KEYWORDS ---------------- */

const legalKeywords = [
  "arrest",
  "warrant",
  "bail",
  "offence",
  "police",
  "investigation",
  "divorce",
  "marriage",
  "custody",
  "fraud",
  "theft",
  "criminal"
];

/* ---------------- BUILD TF-IDF MODEL ---------------- */

function buildVectors() {
  const docFreq = new Map();
  const tokenizedDocs = [];

  laws.forEach(law => {
    const tokens = tokenize(`${law.act} ${law.title} ${law.content}`);
    const uniqueTokens = new Set(tokens);
    tokenizedDocs.push(tokens);

    uniqueTokens.forEach(token => {
      docFreq.set(token, (docFreq.get(token) || 0) + 1);
    });
  });

  const totalDocs = laws.length;

  let index = 0;
  vocabulary.clear();

  docFreq.forEach((_, word) => {
    vocabulary.set(word, index++);
  });

  lawVectors = tokenizedDocs.map(tokens => {
    const vector = new Array(vocabulary.size).fill(0);
    const termFreq = {};

    tokens.forEach(token => {
      termFreq[token] = (termFreq[token] || 0) + 1;
    });

    Object.keys(termFreq).forEach(token => {
      if (vocabulary.has(token)) {
        const tf = termFreq[token] / tokens.length;
        const idf = Math.log(totalDocs / (1 + docFreq.get(token)));
        const position = vocabulary.get(token);
        vector[position] = tf * idf;
      }
    });

    return vector;
  });
}

/* ---------------- COSINE SIMILARITY ---------------- */

function cosineSimilarity(vecA, vecB) {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

/* ---------------- QUERY HELPERS ---------------- */

function extractSectionNumber(query) {
  const match = query.toLowerCase().match(/section\s+(\d+)/);
  return match ? match[1] : null;
}

function extractAct(query) {
  const lower = query.toLowerCase();

  if (lower.includes("crpc")) return "CRPC";
  if (lower.includes("ipc")) return "IPC";
  if (lower.includes("hma")) return "HMA";
  if (lower.includes("nia")) return "NIA";
  if (lower.includes("ida")) return "IDA";

  return null;
}

function extractReferencedSections(text) {
  const matches = text.match(/section\s+(\d+)/gi);
  if (!matches) return [];

  return matches.map(m => m.replace(/section\s+/i, "").trim());
}

/* ---------------- INITIALIZE ---------------- */

async function initializeEmbeddings() {
  if (initialized) return;

  console.log("📚 Loading laws...");
  const data = await fs.promises.readFile(lawsFilePath, "utf-8");
  laws = JSON.parse(data);

  console.log("🔄 Building TF-IDF vectors...");
  buildVectors();

  initialized = true;
  console.log("✅ Vector search ready!");
}

/* ---------------- SEARCH ---------------- */

function vectorSearch(query, topK = 5, actFilter = null) {
  if (!initialized) {
    throw new Error("Vector search not initialized. Call initializeEmbeddings() first.");
  }

  const tokens = tokenize(query);
  const queryVector = new Array(vocabulary.size).fill(0);

  tokens.forEach(token => {
    if (vocabulary.has(token)) {
      queryVector[vocabulary.get(token)] += 1;
    }
  });

  const sectionMention = extractSectionNumber(query);
  const actMention = extractAct(query);

  const eligibleIndexes = laws
    .map((law, index) => ({ law, index }))
    .filter(item => !actFilter || item.law.act === actFilter)
    .map(item => item.index);

  let scored = eligibleIndexes.map(index => {
    const law = laws[index];
    let score = cosineSimilarity(queryVector, lawVectors[index]);

    const lawText = `${law.title} ${law.content}`.toLowerCase();

    if (sectionMention && String(law.section) === sectionMention) {
      score += 0.6;
    }

    if (actMention && law.act === actMention) {
      score += 0.3;
    }

    legalKeywords.forEach(keyword => {
      if (query.toLowerCase().includes(keyword) && lawText.includes(keyword)) {
        score += 0.05;
      }
    });

    if (sectionMention && lawText.includes(`section ${sectionMention}`)) {
      score += 0.2;
    }

    return { ...law, score };
  });

  /* -------- FIRST SORT -------- */

  scored.sort((a, b) => b.score - a.score);

  /* -------- CROSS SECTION BOOST -------- */

  const referenced = new Set();

  scored.slice(0, 10).forEach(law => {
    const refs = extractReferencedSections(`${law.title} ${law.content}`);
    refs.forEach(r => referenced.add(r));
  });

  scored = scored.map(law => {
    if (referenced.has(String(law.section))) {
      law.score += 0.4;
    }
    return law;
  });

  /* -------- FINAL SORT -------- */

  scored.sort((a, b) => b.score - a.score);

  const topResults = scored.slice(0, topK);

  const avgScore =
    topResults.reduce((sum, item) => sum + item.score, 0) /
    (topResults.length || 1);

  const confidence = Math.max(5, Math.min(95, Math.round(avgScore * 100)));

  return {
    results: topResults,
    confidence
  };
}

module.exports = {
  vectorSearch,
  initializeEmbeddings
};