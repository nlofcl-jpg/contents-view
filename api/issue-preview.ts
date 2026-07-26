import { createClient } from "@supabase/supabase-js";

type IssuePreview = {
  title: string;
  summary: string | null;
  article_title: string | null;
  article_summary: string | null;
  thumbnail_url: string | null;
  source_name: string | null;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getIssueId(req: any) {
  const queryId = getQueryValue(req.query?.id);
  if (queryId) return queryId;

  try {
    return new URL(req.url ?? "", "https://contents-view-chi.vercel.app").searchParams.get("id");
  } catch {
    return null;
  }
}

function renderPreviewHtml({ title, description, imageUrl, pageUrl, sourceName }: {
  title: string;
  description: string;
  imageUrl: string;
  pageUrl: string;
  sourceName: string;
}) {
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(description);
  const escapedImageUrl = escapeHtml(imageUrl);
  const escapedPageUrl = escapeHtml(pageUrl);
  const escapedSourceName = escapeHtml(sourceName);

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
    <meta property="article:section" content="${escapedSourceName}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDescription}" />
    <meta name="twitter:image" content="${escapedImageUrl}" />
  </head>
  <body></body>
</html>`;
}

export default async function handler(req: any, res: any) {
  const issueId = getIssueId(req);
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!issueId || !supabaseUrl || !supabaseKey) {
    res.setHeader("X-Issue-Preview-Status", !issueId ? "missing-id" : "missing-config");
    res.status(404).send("Not found");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from("issues")
    .select("title,summary,article_title,article_summary,thumbnail_url,source_name")
    .eq("id", issueId)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !data) {
    console.error("[Issue preview] Failed to load issue", {
      issueId,
      error: error?.message ?? null,
    });
    res.setHeader("X-Issue-Preview-Status", error ? "query-failed" : "issue-not-found");
    res.status(404).send("Not found");
    return;
  }

  const forwardedHost = getQueryValue(req.headers?.["x-forwarded-host"]);
  const host = forwardedHost ?? req.headers?.host ?? "contents-view-chi.vercel.app";
  const forwardedProtocol = getQueryValue(req.headers?.["x-forwarded-proto"]);
  const protocol = forwardedProtocol ?? "https";
  const origin = `${protocol}://${host}`;
  const issue = data as IssuePreview;
  const title = issue.article_title || issue.title;
  const description = issue.summary || issue.article_summary || "CONTENTS VIEW 이슈";
  const imageUrl = issue.thumbnail_url || `${origin}/contents-view-symbol.png`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.setHeader("X-Issue-Preview-Status", "ready");
  res.status(200).send(
    renderPreviewHtml({
      title,
      description,
      imageUrl,
      pageUrl: `${origin}/news/issues/${issueId}`,
      sourceName: issue.source_name || "뉴스 & 이슈",
    }),
  );
}
