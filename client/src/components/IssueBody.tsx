import React from "react";
import { parseIssueBodyBlocks, parseIssueBodyLine } from "@shared/issueBody";

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
      {parseIssueBodyBlocks(value).map((block, blockIndex) => {
        if (block.type === "table") {
          return (
            <div key={blockIndex} className="issueBodyTableScroll" role="region" aria-label="이슈 본문 표" tabIndex={0}>
              <table className="issueBodyTable">
                <thead>
                  <tr>{block.headers.map((cell, index) => (
                    <th key={index} scope="col" style={{ textAlign: block.align[index] || "left" }}>{renderInlineText(cell)}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>{row.map((cell, index) => (
                      <td key={index} style={{ textAlign: block.align[index] || "left" }}>{renderInlineText(cell)}</td>
                    ))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <React.Fragment key={blockIndex}>{block.value.split("\n").map((line, index) => {
          const { size, text } = parseIssueBodyLine(line);
          if (size === "large") return <h2 key={index} className="issueBodyLarge">{renderInlineText(text)}</h2>;
          if (size === "subtitle") return <h3 key={index} className="issueBodySubtitle">{renderInlineText(text)}</h3>;
          return <div key={index} className="issueBodyLine">{text ? renderInlineText(text) : "\u00a0"}</div>;
        })}</React.Fragment>;
      })}
    </div>
  );
}
