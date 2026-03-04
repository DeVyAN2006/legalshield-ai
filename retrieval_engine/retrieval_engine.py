from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer, CrossEncoder
from rank_bm25 import BM25Okapi
import numpy as np
import json
import os
import re

app = FastAPI()

# ---------------- MODELS ----------------

print("Loading embedding model...")
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

print("Loading reranker model...")
reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

laws = []
law_embeddings = None
bm25 = None
corpus_texts = []


# ---------------- REQUEST MODEL ----------------

class QueryRequest(BaseModel):
    query: str
    top_k: int = 5


# ---------------- TOKENIZER ----------------

def tokenize(text):
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return text.split()


# ---------------- STATUTE CHUNKING ----------------

def chunk_law(law):

    act = law.get("act", "")
    section = law.get("section", "")
    title = law.get("title", "")
    content = law.get("content", "")

    base = f"{act} Section {section} {title}"

    # split paragraphs / clauses
    paragraphs = re.split(r"\n|\t", content)

    chunks = []

    for p in paragraphs:

        p = p.strip()

        if len(p) < 40:
            continue

        chunks.append({
            "act": act,
            "section": section,
            "title": title,
            "content": p,
            "text": f"{base} {p}"
        })

    return chunks


# ---------------- LOAD LAWS ----------------

def load_laws():
    global laws, law_embeddings, bm25, corpus_texts

    base_dir = os.path.dirname(__file__)
    laws_path = os.path.join(base_dir, "..", "backend", "processed_laws", "laws.json")

    print("Loading laws from:", laws_path)

    with open(laws_path, "r", encoding="utf-8") as f:
        raw_laws = json.load(f)

    # ---------- STATUTE AWARE CHUNKING ----------

    chunked_laws = []
    corpus_texts = []

    for law in raw_laws:

        chunks = chunk_law(law)

        for chunk in chunks:
            chunked_laws.append(chunk)
            corpus_texts.append(chunk["text"])

    laws = chunked_laws

    print("Total statute chunks:", len(corpus_texts))

    # ---------- EMBEDDINGS ----------

    print("Generating embeddings...")

    law_embeddings = embedding_model.encode(
        corpus_texts,
        convert_to_numpy=True,
        normalize_embeddings=True
    )

    # ---------- BM25 ----------

    print("Building BM25 index...")

    tokenized_corpus = [tokenize(t) for t in corpus_texts]
    bm25 = BM25Okapi(tokenized_corpus)

    print("Retrieval system ready.")


# ---------------- STARTUP ----------------

@app.on_event("startup")
def startup():
    load_laws()


# ---------------- SEARCH ----------------

@app.post("/search")
def search(request: QueryRequest):

    query = request.query
    top_k = request.top_k

    # ---------- SEMANTIC SEARCH ----------

    query_embedding = embedding_model.encode(
        query,
        convert_to_numpy=True,
        normalize_embeddings=True
    )

    semantic_scores = np.dot(law_embeddings, query_embedding)
    semantic_indexes = np.argsort(semantic_scores)[::-1][:80]

    # ---------- BM25 SEARCH ----------

    tokenized_query = tokenize(query)
    bm25_scores = bm25.get_scores(tokenized_query)
    bm25_indexes = np.argsort(bm25_scores)[::-1][:80]

    # ---------- MERGE CANDIDATES ----------

    candidate_indexes = list(set(semantic_indexes) | set(bm25_indexes))

    candidates = []

    for idx in candidate_indexes:

        law = laws[idx]
        text = corpus_texts[idx]

        candidates.append({
            "index": idx,
            "text": text,
            "law": law
        })

    # ---------- RERANK ----------

    pairs = [[query, c["text"]] for c in candidates]
    rerank_scores = reranker.predict(pairs)

    for i, score in enumerate(rerank_scores):
        candidates[i]["rerank_score"] = float(score)

    candidates.sort(key=lambda x: x["rerank_score"], reverse=True)

    top_candidates = candidates[:top_k]

    results = []

    for item in top_candidates:
        law = item["law"]

        results.append({
            "act": law.get("act"),
            "section": law.get("section"),
            "title": law.get("title"),
            "content": law.get("content"),
            "score": float(item["rerank_score"])
        })

    # ---------- CONFIDENCE ----------

    scores = [r["score"] for r in results]

    if scores:
        min_score = min(scores)
        max_score = max(scores)
        avg_score = np.mean(scores)

        confidence = int(((avg_score - min_score) / (max_score - min_score + 1e-6)) * 100)
        confidence = max(40, min(95, confidence))
    else:
        confidence = 40

    return {
        "results": results,
        "confidence": confidence
    }