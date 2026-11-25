// server/issuePreview.ts
import { createClient } from "@supabase/supabase-js";

// shared/issueBody.ts
import { Lexer } from "marked";

// shared/issueDocument.ts
var ISSUE_DOCUMENT_PREFIX = "<!--contents-view-editor:v1-->";
function readIssueDocument(value) {
  if (!value.startsWith(ISSUE_DOCUMENT_PREFIX)) return null;
  try {
    const doc = JSON.parse(value.slice(ISSUE_DOCUMENT_PREFIX.length));
    const valid = (node, depth = 0) => {
      if (!node || typeof node !== "object" || depth > 100) return false;
      const item = node;
      return typeof item.type === "string" && (item.text === void 0 || typeof item.text === "string") && (item.content === void 0 || Array.isArray(item.content) && item.content.every((child) => valid(child, depth + 1))) && (item.marks === void 0 || Array.isArray(item.marks) && item.marks.every((mark) => mark && typeof mark.type === "string"));
    };
    return doc?.type === "doc" && Array.isArray(doc.content) && valid(doc) ? doc : null;
  } catch {
    return null;
  }
}
function issueDocumentText(node) {
  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return " ";
  return (node.content || []).map(issueDocumentText).join(
    ["paragraph", "heading", "text"].includes(node.type) ? "" : " "
  );
}

// shared/issueBody.ts
function parseIssueBodyBlocks(value) {
  const source = value.replace(/\r\n?/g, "\n");
  const blocks = [];
  let cursor = 0;
  let textStart = 0;
  for (const token of Lexer.lex(source, { gfm: true })) {
    const start = source.indexOf(token.raw, cursor);
    if (start === -1) continue;
    cursor = start + token.raw.length;
    if (token.type !== "table") continue;
    const table = token;
    let text = source.slice(textStart, start).replace(/\n+$/, "");
    if (blocks.length) text = text.replace(/^\n+/, "");
    if (text) blocks.push({ type: "text", value: text });
    blocks.push({
      type: "table",
      headers: table.header.map((cell) => cell.text),
      align: table.align,
      rows: table.rows.map((row) => row.map((cell) => cell.text))
    });
    textStart = cursor;
  }
  const trailingText = blocks.length ? source.slice(textStart).replace(/^\n+/, "") : source;
  if (trailingText) blocks.push({ type: "text", value: trailingText });
  return blocks;
}
function parseIssueBodyLine(line) {
  if (line.startsWith("### ")) return { size: "subtitle", text: line.slice(4) };
  if (line.startsWith("## ")) return { size: "large", text: line.slice(3) };
  return { size: "body", text: line };
}
function stripIssueBodyFormatting(value) {
  const doc = readIssueDocument(value);
  if (doc) return issueDocumentText(doc).replace(/\s+/g, " ").trim();
  return parseIssueBodyBlocks(value).flatMap((block) => block.type === "table" ? [block.headers.join(" "), ...block.rows.map((row) => row.join(" "))] : block.value.split("\n")).map((line) => parseIssueBodyLine(line).text).join(" ").replace(/\*\*(.*?)\*\*/g, "$1").replace(/\s+/g, " ").trim();
}

// server/issuePreview.ts
var SITE_ORIGIN = "https://contents-view-chi.vercel.app";
var FALLBACK_IMAGE = `${SITE_ORIGIN}/contents-view-symbol.png`;
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[character];
  });
}
function getQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}
function getIssueId(req) {
  const queryId = getQueryValue(req.query?.id);
  if (queryId) return queryId;
  try {
    return new URL(req.url ?? "", SITE_ORIGIN).searchParams.get("id");
  } catch {
    return null;
  }
}
function getPreviewImage(value) {
  if (!value?.trim()) return FALLBACK_IMAGE;
  try {
    const url = new URL(value, SITE_ORIGIN);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : FALLBACK_IMAGE;
  } catch {
    return FALLBACK_IMAGE;
  }
}
function renderPreviewHtml({ title, description, imageUrl, pageUrl }) {
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(description);
  const escapedImageUrl = escapeHtml(imageUrl);
  const escapedPageUrl = escapeHtml(pageUrl);
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapedTitle} | CONTENTS VIEW</title>
    <meta name="description" content="${escapedDescription}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="CONTENTS VIEW" />
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDescription}" />
    <meta property="og:url" content="${escapedPageUrl}" />
    <meta property="og:image" content="${escapedImageUrl}" />
    <meta property="og:image:secure_url" content="${escapedImageUrl}" />
    <meta property="og:image:alt" content="${escapedTitle}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDescription}" />
    <meta name="twitter:image" content="${escapedImageUrl}" />
  </head>
  <body></body>
</html>`;
}
async function handler(req, res) {
  const issueId = getIssueId(req);
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!issueId || !supabaseUrl || !supabaseKey) {
    res.setHeader("X-Issue-Preview-Status", !issueId ? "missing-id" : "missing-config");
    res.status(404).send("Not found");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await supabase.from("issues").select("title,summary,article_title,article_summary,thumbnail_url").eq("id", issueId).eq("is_published", true).maybeSingle();
  if (error || !data) {
    console.error("[Issue preview] Failed to load issue", {
      issueId,
      error: error?.message ?? null
    });
    res.setHeader("X-Issue-Preview-Status", error ? "query-failed" : "issue-not-found");
    res.status(404).send("Not found");
    return;
  }
  const issue = data;
  const title = issue.article_title || issue.title;
  const description = stripIssueBodyFormatting(issue.summary || issue.article_summary || "CONTENTS VIEW \uB274\uC2A4 \uD3EC\uCEE4\uC2A4");
  const imageUrl = getPreviewImage(issue.thumbnail_url);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.setHeader("X-Issue-Preview-Status", "ready");
  res.status(200).send(
    renderPreviewHtml({
      title,
      description,
      imageUrl,
      pageUrl: `${SITE_ORIGIN}/news/issues/${encodeURIComponent(issueId)}`
    })
  );
}
export {
  handler as default
};
