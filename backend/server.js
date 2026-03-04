const dotenv = require("dotenv");
dotenv.config();

console.log(
  "Gemini key loaded:",
  process.env.GEMINI_API_KEY ? "YES" : "NO"
);

const express = require("express");
const cors = require("cors");
const path = require("path");

const { generateAnswer } = require("./services/generateAnswer");

const app = express();
const PORT = process.env.PORT || 5001;

/* ---------------- CACHE ---------------- */

const cache = new Map();
const CACHE_TTL = 1000 * 60 * 30;

function setCache(key, value) {
  cache.set(key, {
    data: value,
    expiry: Date.now() + CACHE_TTL
  });
}

function getCache(key) {
  const entry = cache.get(key);

  if (!entry) return null;

  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

/* ---------------- MIDDLEWARE ---------------- */

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));

/* ---------------- HEALTH CHECK ---------------- */

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "LexEase API",
    timestamp: new Date().toISOString()
  });
});

/* ---------------- ROUTES ---------------- */

app.post("/api/legal", async (req, res, next) => {
  try {

    const { question } = req.body || {};

    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "Question is required" });
    }

    const trimmedQuestion = question.trim();
    const cacheKey = trimmedQuestion.toLowerCase();

    /* ---------- CACHE ---------- */

    const cached = getCache(cacheKey);
    if (cached) {
      console.log("⚡ Cache hit");
      return res.json(cached);
    }

    /* ---------- CALL PYTHON RETRIEVAL ---------- */

    const retrievalResponse = await fetch(
      "http://127.0.0.1:8000/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: trimmedQuestion,
          top_k: 5
        })
      }
    );

    if (!retrievalResponse.ok) {
      throw new Error("Failed to fetch semantic search results");
    }

    const retrievalData = await retrievalResponse.json();

    const results = retrievalData.results || [];
    const confidence = retrievalData.confidence || 50;

    console.log("🔎 Semantic matches:", results.length);

    if (!results.length) {
      return res.json({
        answer: {
          overview: "No relevant legal provisions were found for this query.",
          legalAnalysis: "",
          citedSections: [],
          riskLevel: "Informational",
          confidence,
          disclaimer:
            "⚠️ This AI-generated response is for informational purposes only and does not constitute legal advice."
        },
        keySections: [],
        isCriminalCase: false,
        confidence
      });
    }

    /* ---------- GENERATE AI ANSWER ---------- */

    const answer =
      await generateAnswer(trimmedQuestion, results, confidence);

    /* ---------- DEDUPLICATE KEY SECTIONS ---------- */

    const uniqueSections = new Map();

    results.forEach(law => {

      const key = `${law.act}_${law.section}`;

      if (!uniqueSections.has(key)) {
        uniqueSections.set(key, {
          act: law.act || "Unknown Act",
          section: law.section || "",
          title: law.title || ""
        });
      }

    });

    const keySections = Array.from(uniqueSections.values());

    /* ---------- CRIMINAL DETECTION ---------- */

    const criminalKeywords = [
      "fraud",
      "theft",
      "assault",
      "crime",
      "cheating",
      "intimidation",
      "criminal",
      "arrest",
      "police",
      "warrant",
      "murder"
    ];

    const isCriminalCase = criminalKeywords.some(word =>
      trimmedQuestion.toLowerCase().includes(word)
    );

    /* ---------- RESPONSE ---------- */

    const response = {
      answer,
      keySections,
      isCriminalCase,
      confidence
    };

    /* ---------- CACHE SAVE ---------- */

    setCache(cacheKey, response);

    return res.json(response);

  } catch (error) {
    next(error);
  }
});

/* ---------------- ERROR HANDLING ---------------- */

app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found"
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  res.status(500).json({
    error: "An unexpected error occurred",
    message: process.env.NODE_ENV === "development"
      ? err.message
      : undefined
  });
});

/* ---------------- SERVER START ---------------- */

app.listen(PORT, () => {
  console.log(`🚀 LexEase backend listening on port ${PORT}`);
});