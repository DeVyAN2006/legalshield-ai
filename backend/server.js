const dotenv = require("dotenv");
dotenv.config();

// ✅ Verify .env is loading
console.log("Loaded Gemini key:", process.env.GEMINI_API_KEY);

const express = require("express");
const cors = require("cors");
const path = require("path");

const { vectorSearch } = require("./services/vectorSearch");
const { generateAnswer } = require("./services/generateAnswer");

const app = express();
const PORT = 5001;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.options("*", cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "..")));

app.post("/api/legal", async (req, res, next) => {
  try {
    const { question } = req.body || {};

    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "Question is required" });
    }

    const trimmedQuestion = question.trim();

    const relevantLaws = await vectorSearch(trimmedQuestion);
    console.log("Vector Results:", relevantLaws);
    const answer = await generateAnswer(trimmedQuestion, relevantLaws);

    // ✅ FIXED: Extract structured key sections safely
    const keySections = Array.isArray(relevantLaws)
      ? relevantLaws.map(law => {

          const metadata = law.metadata || {};

          return {
            act:
              law.act ||
              metadata.act ||
              metadata.book ||
              metadata.source ||
              "Unknown Act",

            section:
              law.section ||
              metadata.section ||
              "",

            title:
              law.section_title ||
              law.title ||
              metadata.section_title ||
              metadata.title ||
              ""
          };

        })
      : [];

    // ✅ Criminal detection logic
    const criminalKeywords = [
      "fraud",
      "theft",
      "assault",
      "crime",
      "cheating",
      "intimidation",
      "criminal"
    ];

    const isCriminalCase = criminalKeywords.some(word =>
      trimmedQuestion.toLowerCase().includes(word)
    );

    return res.json({
      answer,
      keySections,
      isCriminalCase
    });

  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "An unexpected error occurred. Please try again later."
  });
});

app.listen(PORT, () => {
  console.log(`LexEase backend listening on port ${PORT}`);
});