Built during a 24-hour university hackathon 🚀

LexEase AI ⚖️

LexEase AI is an AI-powered legal research assistant designed to answer Indian legal queries by grounding responses in actual statutory provisions rather than generic AI outputs.

The system combines modern information retrieval techniques with large language models to provide structured explanations supported by relevant sections of law.

Built during a 24-hour pre-hackathon, LexEase demonstrates how AI can make complex legal information more accessible and easier to understand.

Key Features

• Searches across 1300+ sections from major Indian statutes
• Uses hybrid retrieval (semantic embeddings + BM25 search)
• Applies cross-encoder reranking to prioritize the most relevant statutes
• Generates structured legal explanations grounded in retrieved sections
• Returns citations, legal analysis, confidence scores, and risk indicators

System Architecture

LexEase uses a multi-stage Retrieval-Augmented Generation (RAG) pipeline:

User Query
     ->
React Frontend
     ->
Node.js Backend API
     ->
Python Retrieval Engine
     ->
Hybrid Search
(BM25 + Sentence Embeddings)
     ->
Cross-Encoder Reranking
     ->
Top Legal Sections
     ->
LLM Reasoning (Gemini)
     ->
Structured Legal Response


Tech Stack:

Frontend
• React
• Vite

Backend
• Node.js
• Express

Retrieval Engine
• FastAPI
• Sentence Transformers
• Cross-Encoder reranker
• BM25 (rank-bm25)

AI Model
• Gemini API

Example Query

Question

Can police arrest someone without a warrant in India?

Output

• Overview of legal rule
• Detailed legal analysis
• Relevant statutory citations
• Confidence score
• Risk classification

Motivation

Understanding legal documents often requires navigating dense statutory texts and complex legal language. LexEase aims to simplify access to legal knowledge by combining AI reasoning with grounded statutory retrieval.

Future Improvements

• Expand legal datasets across more Indian statutes
• Improve statute-aware retrieval
• Add case law support
• Deploy as a public web application
