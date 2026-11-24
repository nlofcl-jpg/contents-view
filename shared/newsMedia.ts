export const NEWS_IMAGE_LIMIT = 5 * 1024 * 1024;
export const NEWS_ATTACHMENT_LIMIT = 25 * 1024 * 1024;
export const NEWS_MEDIA_ENDPOINT = "/api/news-media";
export const DEFAULT_NEWS_MEDIA_ORIGIN = "https://contents-view-chi.vercel.app";

export const newsImageMime = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
export const newsAttachmentMime = {
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", mp3: "audio/mpeg",
  pdf: "application/pdf", txt: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

export type NewsMediaKind = "images" | "attachments";

export function getMediaExtension(name: string) {
  return name.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase();
}

export function newsMediaMime(kind: NewsMediaKind, extension: string): string | undefined {
  const types: Readonly<Record<string, string>> = kind === "images" ? newsImageMime : newsAttachmentMime;
  return Object.prototype.hasOwnProperty.call(types, extension) ? types[extension] : undefined;
}

export function parseNewsMediaKey(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^r2\/(images|attachments)\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\.([a-z0-9]+)$/.exec(value);
  if (!match) return null;
  const kind = match[1] as NewsMediaKind;
  const contentType = newsMediaMime(kind, match[3]);
  return contentType ? { key: value, kind, contentType } : null;
}

export function newsMediaHref(key: string) {
  return `${NEWS_MEDIA_ENDPOINT}?key=${encodeURIComponent(key)}`;
}

export function newsImageKeyFromUrl(value: string) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.pathname !== NEWS_MEDIA_ENDPOINT) return null;
    const media = parseNewsMediaKey(url.searchParams.get("key"));
    return media?.kind === "images" ? media.key : null;
  } catch {
    return null;
  }
}
