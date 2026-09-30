export type IssueBodySize = "body" | "subtitle" | "large";

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
  return value
    .split("\n")
    .map(line => parseIssueBodyLine(line).text)
    .join(" ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
