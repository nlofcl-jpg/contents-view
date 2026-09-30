import React from "react";
import { parseIssueBodyLine } from "@shared/issueBody";

function renderInlineText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : part,
  );
}

export default function IssueBody({ value }: { value: string }) {
  return (
    <div className="issueDetailSummary">
      {value.split("\n").map((line, index) => {
        const { size, text } = parseIssueBodyLine(line);
        if (size === "large") return <h2 key={index} className="issueBodyLarge">{renderInlineText(text)}</h2>;
        if (size === "subtitle") return <h3 key={index} className="issueBodySubtitle">{renderInlineText(text)}</h3>;
        return <div key={index} className="issueBodyLine">{text ? renderInlineText(text) : "\u00a0"}</div>;
      })}
    </div>
  );
}
