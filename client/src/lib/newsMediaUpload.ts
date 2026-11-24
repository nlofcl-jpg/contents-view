import { getMediaExtension, NEWS_MEDIA_ENDPOINT, newsMediaMime, type NewsMediaKind } from "@shared/newsMedia";
import { supabase } from "@/lib/supabase";

async function mediaRequest(body: object) {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  const response = await fetch(NEWS_MEDIA_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error ?? "미디어 저장소 연결에 실패했습니다.");
  return data;
}

export async function uploadR2NewsMedia(file: File, kind: NewsMediaKind, extension = getMediaExtension(file.name)) {
  const contentType = extension && newsMediaMime(kind, extension);
  if (!contentType) throw new Error("지원하지 않는 파일 형식입니다.");
  const { key, uploadUrl, mediaUrl } = await mediaRequest({ action: "upload", kind, extension, bytes: file.size }) as {
    key: string; uploadUrl: string; mediaUrl: string;
  };
  const result = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": contentType } });
  if (!result.ok) throw new Error("Cloudflare R2에 파일을 업로드하지 못했습니다.");
  return { path: key, url: mediaUrl };
}

export async function removeR2NewsMedia(keys: string[]) {
  for (let index = 0; index < keys.length; index += 50) {
    await mediaRequest({ action: "delete", keys: keys.slice(index, index + 50) });
  }
}

export async function compressNewsImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지를 압축할 수 없습니다.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob || blob.type !== "image/webp") throw new Error("이 브라우저에서 WebP 압축을 사용할 수 없습니다.");
    return scale < 1 || blob.size < file.size
      ? new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: blob.type })
      : file;
  } finally {
    bitmap.close();
  }
}
