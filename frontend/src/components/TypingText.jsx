import { useState, useEffect } from "react";

export default function TypingText({ text, speed = 10 }) {

  const [displayed, setDisplayed] = useState("");

  useEffect(() => {

    if (!text) return;

    let i = 0;

    const interval = setInterval(() => {

      setDisplayed(text.slice(0, i));
      i++;

      if (i > text.length) {
        clearInterval(interval);
      }

    }, speed);

    return () => clearInterval(interval);

  }, [text, speed]);

  return (
    <p style={{ lineHeight: "1.6" }}>
      {displayed}
    </p>
  );
}