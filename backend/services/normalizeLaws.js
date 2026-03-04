const fs = require("fs");
const path = require("path");

const rawPath = path.join(__dirname, "../raw_laws");

const crpc = require(path.join(rawPath, "crpc.json"));
const ipc = require(path.join(rawPath, "ipc.json"));
const hma = require(path.join(rawPath, "hma.json"));
const ida = require(path.join(rawPath, "ida.json"));
const nia = require(path.join(rawPath, "nia.json"));

let unified = [];

/* ---------------- SAFE PUSH ---------------- */

function pushLaw(act, section, title, content) {
  if (!section || !content) return;

  const finalContent = String(content).trim();
  if (!finalContent) return;

  unified.push({
    id: `${act.toLowerCase()}_${section}`,
    act,
    section: String(section),
    title: title ? String(title).trim() : "",
    content: finalContent
  });
}

/* ---------------- GENERIC ARRAY PROCESSOR ---------------- */

function processStandardArray(data, actName) {
  data.forEach((item) => {
    const section =
      item.section ||
      item.Section ||
      item.sec ||
      item.section_number;

    const title =
      item.section_title ||
      item.title ||
      item.heading;

    const content =
      item.section_desc ||
      item.description ||
      item.text;

    pushLaw(actName, section, title, content);
  });
}

/* ---------------- HMA CSV PARSER ---------------- */

function processHMA(data) {
  data.forEach((item) => {
    const key = Object.keys(item)[0];
    const value = item[key];

    if (!value || !value.trim()) return;

    // Split only first 3 commas (chapter, section, title, desc)
    const parts = value.split(/,(.+)/)[1]; 
    if (!parts) return;

    const splitParts = value.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);

    if (splitParts.length < 4) return;

    const chapter = splitParts[0];
    const section = splitParts[1];
    const title = splitParts[2];
    const desc = splitParts.slice(3).join(",");

    pushLaw("HMA", section, title, desc.replace(/^"|"$/g, ""));
  });
}

/* ---------------- PROCESS ALL ---------------- */

if (Array.isArray(crpc)) processStandardArray(crpc, "CRPC");
if (Array.isArray(ipc)) processStandardArray(ipc, "IPC");
if (Array.isArray(ida)) processStandardArray(ida, "IDA");
if (Array.isArray(nia)) processStandardArray(nia, "NIA");
if (Array.isArray(hma)) processHMA(hma);

/* ---------------- SAVE OUTPUT ---------------- */

const outputDir = path.join(__dirname, "../processed_laws");
fs.mkdirSync(outputDir, { recursive: true });

fs.writeFileSync(
  path.join(outputDir, "laws.json"),
  JSON.stringify(unified, null, 2)
);

console.log("✅ Normalization complete!");
console.log("📚 Total sections processed:", unified.length);