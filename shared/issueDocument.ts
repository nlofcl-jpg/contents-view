export const ISSUE_DOCUMENT_PREFIX = "<!--contents-view-editor:v1-->";
export type IssueNode = {
  type: string;
  text?: string;
  attrs?: Record<string, any>;
  marks?: Array<{ type: string; attrs?: Record<string, any> }>;
  content?: IssueNode[];
};

export function readIssueDocument(value: string): IssueNode | null {
  if (!value.startsWith(ISSUE_DOCUMENT_PREFIX)) return null;
  try {
    const doc = JSON.parse(value.slice(ISSUE_DOCUMENT_PREFIX.length));
    const valid = (node: unknown, depth = 0): node is IssueNode => {
      if (!node || typeof node !== "object" || depth > 100) return false;
      const item = node as IssueNode;
      return typeof item.type === "string" && (item.text === undefined || typeof item.text === "string")
        && (item.content === undefined || (Array.isArray(item.content) && item.content.every(child => valid(child, depth + 1))))
        && (item.marks === undefined || (Array.isArray(item.marks) && item.marks.every(mark => mark && typeof mark.type === "string")));
    };
    return doc?.type === "doc" && Array.isArray(doc.content) && valid(doc) ? doc : null;
  } catch { return null; }
}

export function safeIssueUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch { /* Invalid URLs are never rendered. */ }
}

export function issueFontSize(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?px$/.test(value)) return;
  const size = Number.parseFloat(value);
  return size >= 12 && size <= 72 ? `${size}px` : undefined;
}

export function issueDocumentText(node: IssueNode): string {
  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return " ";
  return (node.content || []).map(issueDocumentText).join(
    ["paragraph", "heading", "text"].includes(node.type) ? "" : " "
  );
}

export function issueBodyImages(value: string): string[] {
  const urls = new Set<string>();
  const visit = (node: IssueNode) => {
    const src = node.type === "image" && safeIssueUrl(node.attrs?.src);
    if (src) urls.add(src);
    node.content?.forEach(visit);
  };
  const doc = readIssueDocument(value);
  if (doc) visit(doc);
  return Array.from(urls);
}

