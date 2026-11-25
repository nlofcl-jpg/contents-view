import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function CoupangPartnersKeyPanel() {
  const status = trpc.coupang.adminStatus.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [error, setError] = useState("");

  function clearForm() {
    setAccessKey("");
    setSecretKey("");
    setError("");
    setEditing(false);
  }

  function updateStatus(configured: boolean) {
    utils.coupang.adminStatus.setData(undefined, { configured });
    void utils.coupang.products.invalidate();
    clearForm();
  }

  const save = trpc.coupang.save.useMutation({
    onSuccess: result => updateStatus(result.configured),
    onError: error => setError(error.message),
  });
  const remove = trpc.coupang.remove.useMutation({
    onSuccess: result => updateStatus(result.configured),
    onError: error => setError(error.message),
  });
  const busy = save.isPending || remove.isPending;
  const configured = status.data?.configured === true;

  return (
    <section className="flex min-h-[280px] flex-col rounded-md border border-slate-800 bg-slate-950/50 p-4">
      <div className="border-b border-slate-800 pb-4">
        <h3 className="text-sm font-semibold text-slate-100">쿠팡 파트너스</h3>
        <p className="mt-2 text-xs leading-5 text-slate-400">커머스 트렌드의 쿠팡 상품 조회에 사용하는 공용 키입니다.</p>
      </div>
      <form
        className="mt-4 space-y-3"
        onSubmit={event => {
          event.preventDefault();
          setError("");
          save.mutate({ accessKey, secretKey });
        }}
      >
        <p role="status" className={`text-sm ${configured ? "text-emerald-300" : "text-slate-400"}`}>
          {status.isPending ? "상태 확인 중" : status.isError ? "연동 상태 확인 불가" : configured ? "연결 완료" : "연결 필요"}
        </p>
        {editing && (
          <div className="grid gap-2 sm:grid-cols-2">
            <input type="password" autoComplete="off" className="mypageModalNameInput min-w-0" aria-label="쿠팡 Access Key" placeholder="Access Key" value={accessKey} onChange={event => setAccessKey(event.target.value)} maxLength={200} disabled={busy} required />
            <input type="password" autoComplete="new-password" className="mypageModalNameInput min-w-0" aria-label="쿠팡 Secret Key" placeholder="Secret Key" value={secretKey} onChange={event => setSecretKey(event.target.value)} maxLength={300} disabled={busy} required />
          </div>
        )}
        {(error || status.error?.message) && <p role="alert" className="text-sm text-red-300">{error || status.error?.message}</p>}
        <div className="mypageModalActionRow">
          {editing ? (
            <>
              <button className="mypageModalEditButton mypageModalEditButtonSecondary" type="button" disabled={busy} onClick={clearForm}>취소</button>
              <button className="mypageModalEditButton" type="submit" disabled={busy || !accessKey.trim() || !secretKey.trim()}>{save.isPending ? "연결 확인 중" : "저장"}</button>
            </>
          ) : (
            <>
              {configured && <button className="mypageModalEditButton mypageModalEditButtonSecondary" type="button" disabled={busy} onClick={() => {
                if (window.confirm("쿠팡 파트너스 API 키를 삭제하시겠습니까?")) {
                  setError("");
                  remove.mutate();
                }
              }}>키 삭제</button>}
              <button className="mypageModalEditButton" type="button" disabled={busy || status.isPending || status.isError} onClick={() => { setError(""); setEditing(true); }}>{configured ? "수정" : "등록"}</button>
            </>
          )}
        </div>
      </form>
    </section>
  );
}
