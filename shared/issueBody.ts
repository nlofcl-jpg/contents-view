import { Lexer, type Tokens } from "marked";

export type IssueBodySize = "body" | "subtitle" | "large";

export type IssueBodyBlock =
  | { type: "text"; value: string }
  | { type: "table"; headers: string[]; align: Array<"left" | "center" | "right" | null>; rows: string[][] };

export function parseIssueBodyBlocks(value: string): IssueBodyBlock[] {
  const source = value.replace(/\r\n?/g, "\n");
  const blocks: IssueBodyBlock[] = [];
  let cursor = 0;
  let textStart = 0;

  // Use token ranges so content outside tables keeps its existing formatting.
  for (const token of Lexer.lex(source, { gfm: true })) {
    const start = source.indexOf(token.raw, cursor);
    if (start === -1) continue;
    cursor = start + token.raw.length;
    if (token.type !== "table") continue;
    const table = token as Tokens.Table;

    let text = source.slice(textStart, start).replace(/\n+$/, "");
    if (blocks.length) text = text.replace(/^\n+/, "");
    if (text) blocks.push({ type: "text", value: text });
    blocks.push({
      type: "table",
      headers: table.header.map(cell => cell.text),
      align: table.align,
      rows: table.rows.map(row => row.map(cell => cell.text)),
    });
    textStart = cursor;
  }

  const trailingText = blocks.length ? source.slice(textStart).replace(/^\n+/, "") : source;
  if (trailingText) blocks.push({ type: "text", value: trailingText });
  return blocks;
}

const headingPrefixes: Record<IssueBodySize, string> = {
  body: "",
  subtitle: "### ",
  large: "## ",
};

export function parseIssueBodyLine(line: string): { size: IssueBodySize; text: string } {
  if (line.startsWith("### ")) return { size: "subtitle", text: line.slice(4) };
  if (line.startsWith("## ")) return { size: "large", text: line.slice(3) };
  return { size: "body", text: line };
}

export function formatIssueBodyLines(value: string, start: number, end: number, size: IssueBodySize) {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const effectiveEnd = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const nextNewline = value.indexOf("\n", effectiveEnd);
  const lineEnd = nextNewline === -1 ? value.length : nextNewline;
  const selectedLines = value.slice(lineStart, lineEnd).split("\n");
  const formattedLines = selectedLines.map(line => {
    const text = parseIssueBodyLine(line).text;
    return (text || selectedLines.length === 1) ? headingPrefixes[size] + text : line;
  });
  const replacement = formattedLines.join("\n");
  const firstPrefixLength = parseIssueBodyLine(selectedLines[0]).size === "body"
    ? 0
    : selectedLines[0].length - parseIssueBodyLine(selectedLines[0]).text.length;

  return {
    value: value.slice(0, lineStart) + replacement + value.slice(lineEnd),
    selectionStart: end === start ? Math.max(lineStart, start + headingPrefixes[size].length - firstPrefixLength) : lineStart,
    selectionEnd: end === start ? Math.max(lineStart, start + headingPrefixes[size].length - firstPrefixLength) : lineStart + replacement.length,
  };
}

export function stripIssueBodyFormatting(value: string) {
  return parseIssueBodyBlocks(value)
    .flatMap(block => block.type === "table"
      ? [block.headers.join(" "), ...block.rows.map(row => row.join(" "))]
      : block.value.split("\n"))
    .map(line => parseIssueBodyLine(line).text)
    .join(" ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
