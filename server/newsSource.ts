import { loadBuffer } from "cheerio";

export function parseNewsSource(buffer: Buffer, contentType = ""): string | null {
  const charset = contentType.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1];
  const $ = loadBuffer(buffer, {
    encoding: { defaultEncoding: "utf-8", transportLayerEncodingLabel: charset },
  });

  for (const key of ["og:site_name", "application-name", "twitter:site"]) {
    const candidates = $("meta").filter((_, element) => {
      const tag = $(element);
      return (tag.attr("property") || tag.attr("name") || "").toLowerCase() === key;
    });
    for (const element of candidates.toArray()) {
      const value = ($(element).attr("content") || "").replace(/\s+/g, " ").trim();
      // Article descriptions and damaged metadata must not become publisher labels.
      if (value.length < 2 || value.length > 40 || /[\uFFFD\u0000-\u001F\u007F-\u009F<>]/.test(value)) continue;
      if (/https?:\/\//i.test(value)) continue;
      return value;
    }
  }
  return null;
}
