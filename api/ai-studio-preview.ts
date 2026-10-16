const SITE_ORIGIN = "https://contents-view-chi.vercel.app";
const PREVIEW_TITLE = "AI 콘텐츠 제작 | CONTENTS VIEW AI 스튜디오";
const PREVIEW_DESCRIPTION = "쇼츠, 카드뉴스, 모션그래픽 등 AI 콘텐츠 제작을 위한 스타일과 도구를 CONTENTS VIEW AI 스튜디오에서 확인하세요.";
const PREVIEW_IMAGE = `${SITE_ORIGIN}/ai-studio-video-hero.png`;
const SECTIONS = new Set(["video", "programs", "open-source", "flow-automation"]);

function getSection(value: string | string[] | undefined) {
  const section = Array.isArray(value) ? value[0] : value;
  return section && SECTIONS.has(section) ? section : null;
}

export default function handler(req: any, res: any) {
  const section = getSection(req.query?.section);
  const pageUrl = `${SITE_ORIGIN}/ai-studio${section ? `/${section}` : ""}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=3600");
  res.status(200).send(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${PREVIEW_TITLE}</title>
    <meta name="description" content="${PREVIEW_DESCRIPTION}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="CONTENTS VIEW" />
    <meta property="og:title" content="${PREVIEW_TITLE}" />
    <meta property="og:description" content="${PREVIEW_DESCRIPTION}" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:image" content="${PREVIEW_IMAGE}" />
    <meta property="og:image:secure_url" content="${PREVIEW_IMAGE}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1672" />
    <meta property="og:image:height" content="941" />
    <meta property="og:image:alt" content="CONTENTS VIEW AI 스튜디오 콘텐츠 제작" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${PREVIEW_TITLE}" />
    <meta name="twitter:description" content="${PREVIEW_DESCRIPTION}" />
    <meta name="twitter:image" content="${PREVIEW_IMAGE}" />
  </head>
  <body></body>
</html>`);
}
