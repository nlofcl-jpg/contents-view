import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Save } from "lucide-react";
import { saveSiteBanner, siteBannerQuery } from "@/lib/siteBanner";
import { getBannerLink, MAX_BANNER_LINK_LENGTH, MAX_BANNER_MESSAGE_LENGTH, type SiteBanner } from "@shared/siteBanner";

const fieldClass = "w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-blue-400";

export default function SiteBannerPanel() {
  const queryClient = useQueryClient();
  const { data, isPending, isFetching, isError, refetch } = useQuery(siteBannerQuery);
  const [draft, setDraft] = useState<SiteBanner | null>(null);
  const [validationError, setValidationError] = useState("");
  const save = useMutation({
    mutationFn: saveSiteBanner,
    onSuccess: async (banner) => {
      await queryClient.cancelQueries({ queryKey: siteBannerQuery.queryKey });
      queryClient.setQueryData(siteBannerQuery.queryKey, banner);
      setDraft(null);
    },
  });
  const fields = draft ?? data;
  const update = (next: Partial<SiteBanner>) => {
    if (!fields) return;
    setDraft({ ...fields, ...next });
    setValidationError("");
    save.reset();
  };

  return (
    <section className="max-w-2xl space-y-5" aria-labelledby="site-banner-title">
      <h2 id="site-banner-title" className="text-xl font-semibold text-white">배너 관리</h2>
      {isPending && <p role="status" className="text-sm text-slate-400">배너 설정을 불러오는 중입니다.</p>}
      {isError && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm text-red-300">배너 설정을 불러오지 못했습니다.</p>
          <button type="button" title="다시 불러오기" aria-label="배너 설정 다시 불러오기" disabled={isFetching} onClick={() => void refetch()} className="p-2 text-slate-300 hover:text-white disabled:opacity-40">
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>
      )}
      {fields && (
        <form onSubmit={event => {
          event.preventDefault();
          if (!draft || save.isPending) return;
          const message = fields.message.trim();
          const link = fields.link_url.trim();
          const href = getBannerLink(link);
          if (!message || message.length > MAX_BANNER_MESSAGE_LENGTH) {
            setValidationError(`배너 문구를 1~${MAX_BANNER_MESSAGE_LENGTH}자로 입력하세요.`);
          } else if (link && !href) {
            setValidationError("링크는 /로 시작하는 사이트 경로나 https:// 주소를 입력하세요.");
          } else {
            save.mutate({ message, link_url: href ?? "", is_visible: fields.is_visible });
          }
        }}>
          <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
            <label className="block space-y-2 text-sm text-slate-200">
              <span>배너 문구</span>
              <input className={fieldClass} value={fields.message} required maxLength={MAX_BANNER_MESSAGE_LENGTH} onChange={event => update({ message: event.target.value })} />
            </label>
            <label className="block space-y-2 text-sm text-slate-200">
              <span>이동 링크 <span className="text-slate-400">(선택)</span></span>
              <input className={fieldClass} value={fields.link_url} maxLength={MAX_BANNER_LINK_LENGTH} placeholder="/ai-studio 또는 https://..." onChange={event => update({ link_url: event.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input type="checkbox" className="size-4 accent-blue-600" checked={fields.is_visible} onChange={event => update({ is_visible: event.target.checked })} />
              상단 배너 노출
            </label>
            {(validationError || save.isError) && <p role="alert" className="text-sm text-red-300">{validationError || "배너 설정을 저장하지 못했습니다."}</p>}
            {save.isSuccess && <p role="status" className="text-sm text-emerald-300">배너 설정을 저장했습니다.</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" disabled={!draft} onClick={() => { setDraft(null); setValidationError(""); save.reset(); }} className="secondaryButton issueFormAction">취소</button>
              <button type="submit" disabled={!draft} className="primaryButton issueFormAction">
                <Save size={16} aria-hidden="true" /> {save.isPending ? "저장 중" : "저장"}
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
