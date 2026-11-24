import { supabase } from "@/lib/supabase";
import { getMediaExtension, NEWS_ATTACHMENT_LIMIT, newsAttachmentMime, newsMediaMime, parseNewsMediaKey } from "@shared/newsMedia";
import { removeR2NewsMedia, uploadR2NewsMedia } from "@/lib/newsMediaUpload";

export const NEWS_ATTACHMENT_BUCKET = "news-attachments";
export const MAX_NEWS_ATTACHMENT_SIZE = NEWS_ATTACHMENT_LIMIT;

export async function loadWithNewsAttachments<T extends { error: { code: string; message: string } | null }>(
  load: (attachmentColumns: string) => PromiseLike<T>,
) {
  const result = await load(",attachment_path,attachment_name");
  const error = result.error;
  if (error && (error.code === "42703" || error.code === "PGRST204") && /\battachment_(path|name)\b/.test(error.message)) {
    return { ...await load(""), attachmentColumnsAvailable: false };
  }
  return { ...result, attachmentColumnsAvailable: true };
}

export const newsAttachmentAccept = Object.keys(newsAttachmentMime).map(extension => `.${extension}`).join(",");

function getAttachmentType(name: string) {
  const extension = getMediaExtension(name);
  return extension && newsMediaMime("attachments", extension);
}

export function validateNewsAttachment(file: Pick<File, "name" | "type" | "size">): string | null {
  const mime = getAttachmentType(file.name);
  if (!mime || (file.type && file.type !== "application/octet-stream" && file.type !== mime && !(mime === "audio/mpeg" && file.type === "audio/mp3"))) {
    return "MP4, WebM, MOV, MP3, PDF, TXT 또는 Office 문서(DOCX, XLSX, PPTX)를 첨부해 주세요.";
  }
  if (file.size <= 0 || file.size > MAX_NEWS_ATTACHMENT_SIZE) return "첨부 파일은 비어 있지 않은 25MB 이하 파일이어야 합니다.";
  return null;
}

export function isNewsVideoAttachment(path: string): boolean {
  return Boolean(getAttachmentType(path)?.startsWith("video/"));
}

export function isNewsAudioAttachment(path: string): boolean {
  return getAttachmentType(path) === "audio/mpeg";
}

export async function uploadNewsAttachment(file: File) {
  const validation = validateNewsAttachment(file);
  if (validation) throw new Error(validation);
  const optimized = isNewsVideoAttachment(file.name) || isNewsAudioAttachment(file.name)
    ? await (await import("./mediaTranscode")).transcodeNewsMedia(file, isNewsAudioAttachment(file.name))
    : file;
  if (optimized.size > NEWS_ATTACHMENT_LIMIT) throw new Error("압축된 파일이 25MB를 초과합니다.");
  const { path } = await uploadR2NewsMedia(optimized, "attachments");
  return { path, name: optimized.name.slice(0, 255) };
}

export async function removeUnusedNewsAttachments(paths: Array<string | null | undefined>) {
  if (!supabase) return;
  let unused = Array.from(new Set(paths.filter((path): path is string => Boolean(path))));
  const r2 = unused.filter(path => parseNewsMediaKey(path)?.kind === "attachments");
  if (r2.length) await removeR2NewsMedia(r2);
  unused = unused.filter(path => !r2.includes(path));
  for (const table of ["issues", "news_clips"]) {
    if (unused.length === 0) return;
    const { data, error } = await supabase.from(table).select("attachment_path").in("attachment_path", unused);
    if (error) throw error;
    const used = new Set(data.map(row => row.attachment_path));
    unused = unused.filter(path => !used.has(path));
  }
  if (unused.length === 0) return;
  const { error } = await supabase.storage.from(NEWS_ATTACHMENT_BUCKET).remove(unused);
  if (error) throw error;
}
