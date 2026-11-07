import React from "react";
import { readIssueDocument, safeIssueUrl, issueFontSize, type IssueNode } from "@shared/issueDocument";
import { parseIssueBodyBlocks, parseIssueBodyLine } from "@shared/issueBody";

function renderInlineText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : part,
  );
}

export default function IssueBody({ value }: { value: string }) {
  const doc = readIssueDocument(value);
  if (doc) return <div className="issueDetailSummary issueRichContent">{doc.content?.map((node, index) => <RichNode key={index} node={node} />)}</div>;
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

function RichNode({ node }: { node: IssueNode }) {
  const children = node.content?.map((child, index) => <RichNode key={index} node={child} />);
  if (node.type === "text") {
    let text: React.ReactNode = node.text || "";
    for (const mark of node.marks || []) {
      if (mark.type === "bold") text = <strong>{text}</strong>;
      if (mark.type === "italic") text = <em>{text}</em>;
      if (mark.type === "strike") text = <s>{text}</s>;
      if (mark.type === "underline") text = <u>{text}</u>;
      if (mark.type === "code") text = <code>{text}</code>;
      if (mark.type === "textStyle") text = <span style={{ fontSize: issueFontSize(mark.attrs?.fontSize) }}>{text}</span>;
      if (mark.type === "link" && safeIssueUrl(mark.attrs?.href)) text = <a href={safeIssueUrl(mark.attrs?.href)} target="_blank" rel="noopener noreferrer">{text}</a>;
    }
    return <>{text}</>;
  }
  switch (node.type) {
    case "paragraph": return <p>{children || <br />}</p>;
    case "heading": {
      const Tag = `h${[2, 3].includes(node.attrs?.level) ? node.attrs?.level : 3}` as "h2" | "h3";
      return <Tag>{children}</Tag>;
    }
    case "image": {
      const src = safeIssueUrl(node.attrs?.src);
      return src ? <img src={src} alt={typeof node.attrs?.alt === "string" ? node.attrs.alt : "본문 이미지"} loading="lazy" /> : null;
    }
    case "bulletList": return <ul>{children}</ul>;
    case "orderedList": return <ol start={Number.isInteger(node.attrs?.start) ? node.attrs?.start : 1}>{children}</ol>;
    case "listItem": return <li>{children}</li>;
    case "blockquote": return <blockquote>{children}</blockquote>;
    case "codeBlock": return <pre><code>{children}</code></pre>;
    case "hardBreak": return <br />;
    case "horizontalRule": return <hr />;
    case "table": return <div className="issueBodyTableScroll" role="region" aria-label="이슈 본문 표" tabIndex={0}><table><tbody>{children}</tbody></table></div>;
    case "tableRow": return <tr>{children}</tr>;
    case "tableCell":
    case "tableHeader": {
      const Tag = node.type === "tableHeader" ? "th" : "td";
      const align = node.attrs?.textAlign;
      const span = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 100 ? value : undefined;
      return <Tag colSpan={span(node.attrs?.colspan)} rowSpan={span(node.attrs?.rowspan)} style={{ textAlign: ["left", "center", "right"].includes(align) ? align : undefined }}>{children}</Tag>;
    }
    default: return <>{children}</>;
  }
}
