import { supabase } from "@/lib/supabase";

export const ISSUE_IMAGE_BUCKET = "issue-images";
export const MAX_ISSUE_IMAGE_SIZE = 5 * 1024 * 1024;

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
  if (!supabase) throw new Error("이미지 저장소에 연결할 수 없습니다.");
  const validationError = validateIssueImage(file);
  if (validationError) throw new Error(validationError);

  const path = `issues/${crypto.randomUUID()}.${imageExtensions[file.type]}`;
  const storage = supabase.storage.from(ISSUE_IMAGE_BUCKET);
  const { error } = await storage.upload(path, file, { contentType: file.type });
  if (error) throw new Error(`이미지 업로드에 실패했습니다: ${error.message}`);

  return { path, url: storage.getPublicUrl(path).data.publicUrl };
}

export async function removeStoredIssueImages(urls: Array<string | null>) {
  if (!supabase) return;
  const paths = urls.map(url => url && getStoredIssueImagePath(url)).filter((path): path is string => Boolean(path));
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(ISSUE_IMAGE_BUCKET).remove(paths);
  if (error) throw error;
}
