import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { isNewsAudioAttachment, isNewsVideoAttachment, NEWS_ATTACHMENT_BUCKET } from "@/lib/newsAttachments";
import { supabase } from "@/lib/supabase";
import { newsMediaHref, parseNewsMediaKey } from "@shared/newsMedia";

export default function NewsAttachment({ path, name }: { path: string; name: string }) {
  const video = isNewsVideoAttachment(path);
  const audio = isNewsAudioAttachment(path);
  const r2 = parseNewsMediaKey(path)?.kind === "attachments";
  const url = useQuery({
    queryKey: ["news-attachment", path, name],
    staleTime: 20 * 60_000,
    retry: false,
    enabled: !r2,
    queryFn: async () => {
      if (!supabase) throw new Error("Missing news attachment storage");
      const { data, error } = await supabase.storage.from(NEWS_ATTACHMENT_BUCKET)
        .createSignedUrl(path, 1800, video || audio ? undefined : { download: name });
      if (error) throw error;
      return data.signedUrl;
    },
  });
  const playbackUrl = r2 ? newsMediaHref(path) : url.data;
  const downloadUrl = r2 ? `${playbackUrl}&download=1` : playbackUrl;

  return (
    <div className="mx-auto mt-6 max-w-[960px] border-t border-slate-800 pt-4">
      {playbackUrl ? (
        <>
          {video && <video src={playbackUrl} controls playsInline preload="metadata" aria-label={name} className="mb-2 max-h-[560px] w-full rounded-lg bg-black" />}
          {audio && <audio src={playbackUrl} controls preload="metadata" aria-label={name} className="mb-2 w-full" />}
          <a href={downloadUrl} className="inline-flex max-w-full items-center gap-2 text-sm text-blue-300 hover:text-white">
            <Download size={16} className="shrink-0" aria-hidden="true" /><span className="truncate">{name}</span>
          </a>
        </>
      ) : url.isPending ? (
        <p role="status" className="text-sm text-slate-400">첨부 파일을 불러오는 중입니다.</p>
      ) : (
        <button type="button" onClick={() => void url.refetch()} className="text-sm text-slate-400 hover:text-white">첨부 파일 다시 불러오기</button>
      )}
    </div>
  );
}
