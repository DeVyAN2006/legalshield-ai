import { useState } from "react";
import LegalResponse from "./components/LegalResponse";

export default function App() {

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);

  async function handleSubmit() {

    if (!question.trim()) return;

    setLoading(true);
    setResponse(null);

    try {

      const res = await fetch("http://localhost:5001/api/legal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ question })
      });

      const data = await res.json();
      setResponse(data);

    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  }

  return (

    <div
      style={{
        fontFamily: "system-ui",
        padding: "40px",
        maxWidth: "900px",
        margin: "auto"
      }}
    >

      {/* Title */}

      <h1
        style={{
          fontSize: "28px",
          fontWeight: "bold",
          color: "#3730a3"
        }}
      >
        LexEase AI
      </h1>

      <p
        style={{
          marginBottom: "30px",
          color: "#555"
        }}
      >
        AI-powered Indian Legal Intelligence
      </p>

      {/* Input */}

      <textarea
        rows="3"
        placeholder="Ask your legal question..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          marginBottom: "10px"
        }}
      />

      {/* Button */}

      <button
        onClick={handleSubmit}
        style={{
          backgroundColor: "#4f46e5",
          color: "white",
          padding: "10px 20px",
          borderRadius: "6px",
          border: "none",
          cursor: "pointer"
        }}
      >
        {loading ? "Analyzing..." : "Analyze"}
      </button>

      {/* Loading indicator */}

      {loading && (
        <p
          style={{
            marginTop: "15px",
            color: "#666"
          }}
        >
          Searching laws... analyzing statutes...
        </p>
      )}

      {/* AI Response */}

      <LegalResponse response={response} />

    </div>
  );
}