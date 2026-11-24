import { supabase } from "@/lib/supabase";
import { NEWS_IMAGE_LIMIT, newsImageKeyFromUrl } from "@shared/newsMedia";
import { compressNewsImage, removeR2NewsMedia, uploadR2NewsMedia } from "@/lib/newsMediaUpload";

export const ISSUE_IMAGE_BUCKET = "issue-images";
export const MAX_ISSUE_IMAGE_SIZE = NEWS_IMAGE_LIMIT;

const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateIssueImage(file: File): string | null {
  if (!imageExtensions[file.type]) return "JPG, PNG, WebP 이미지만 첨부할 수 있습니다.";
  if (file.size > MAX_ISSUE_IMAGE_SIZE) return "이미지는 5MB 이하로 첨부해 주세요.";
  return null;
}

export function validateIssueImageUrl(value: string): string | null {
  if (!value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol === "http:" || url.protocol === "https:") return null;
  } catch {
    // Invalid URLs are handled by the shared error below.
  }
  return "이미지 주소는 http 또는 https URL로 입력해 주세요.";
}

export function getStoredIssueImagePath(url: string, supabaseUrl = import.meta.env.VITE_SUPABASE_URL): string | null {
  if (!supabaseUrl) return null;

  try {
    const storedUrl = new URL(url);
    const projectUrl = new URL(supabaseUrl);
    const prefix = `/storage/v1/object/public/${ISSUE_IMAGE_BUCKET}/`;
    if (storedUrl.origin !== projectUrl.origin || !storedUrl.pathname.startsWith(prefix)) return null;
    return decodeURIComponent(storedUrl.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

export async function uploadIssueImage(file: File) {
  const validationError = validateIssueImage(file);
  if (validationError) throw new Error(validationError);

  const optimized = await compressNewsImage(file);
  if (optimized.size > MAX_ISSUE_IMAGE_SIZE) throw new Error("압축된 이미지가 5MB를 초과합니다.");
  return uploadR2NewsMedia(optimized, "images", imageExtensions[optimized.type]);
}

export async function removeStoredIssueImages(urls: Array<string | null>) {
  const r2Keys = urls.flatMap(url => {
    const key = url && newsImageKeyFromUrl(url);
    return key ? [key] : [];
  });
  if (r2Keys.length) await removeR2NewsMedia(r2Keys);
  if (!supabase) return;
  const paths = urls.map(url => url && getStoredIssueImagePath(url)).filter((path): path is string => Boolean(path));
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(ISSUE_IMAGE_BUCKET).remove(paths);
  if (error) throw error;
}
