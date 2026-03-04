import TypingText from "./TypingText";

export default function LegalResponse({ response }) {

  if (!response) return null;

  function getRiskStyle(level) {

    if (level === "High") {
      return { bg: "#fee2e2", text: "#b91c1c" };
    }

    if (level === "Medium") {
      return { bg: "#fef3c7", text: "#b45309" };
    }

    if (level === "Critical") {
      return { bg: "#fecaca", text: "#7f1d1d" };
    }

    return { bg: "#dcfce7", text: "#166534" };
  }

  return (

    <div
      style={{
        marginTop: "40px",
        padding: "25px",
        border: "1px solid #eee",
        borderRadius: "12px",
        backgroundColor: "#fafafa"
      }}
    >

      {/* Risk + Confidence */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "20px"
        }}
      >

        <span
          style={{
            padding: "5px 12px",
            borderRadius: "20px",
            fontSize: "14px",
            backgroundColor: getRiskStyle(response.answer.riskLevel).bg,
            color: getRiskStyle(response.answer.riskLevel).text
          }}
        >
          Risk Level: {response.answer.riskLevel}
        </span>

        <span
          style={{
            fontSize: "14px",
            color: "#666"
          }}
        >
          Confidence: {response.confidence}%
        </span>

      </div>

      {/* Overview */}

      <h3>Overview</h3>

      <TypingText text={response.answer.overview} />

      {/* Legal Analysis */}

      <h3 style={{ marginTop: "20px" }}>
        Legal Analysis
      </h3>

      <TypingText text={response.answer.legalAnalysis} />

      {/* Cited Sections */}

      {response.answer.citedSections?.length > 0 && (
        <>
          <h3 style={{ marginTop: "20px" }}>
            Cited Sections
          </h3>

          <ul>
            {response.answer.citedSections.map((sec, i) => (
              <li key={i}>
                <strong>
                  {sec.act} Section {sec.section}
                </strong>{" "}
                – {sec.reason}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Retrieved Legal Sections */}

      {response.keySections?.length > 0 && (
        <>
          <h3 style={{ marginTop: "20px" }}>
            Retrieved Legal Sections
          </h3>

          <ul>
            {response.keySections.map((sec, i) => (
              <li key={i}>
                {sec.act} Section {sec.section} – {sec.title}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Disclaimer */}

      <div
        style={{
          marginTop: "20px",
          fontSize: "12px",
          color: "#777",
          borderTop: "1px solid #ddd",
          paddingTop: "10px"
        }}
      >
        {response.answer.disclaimer}
      </div>

    </div>

  );
}