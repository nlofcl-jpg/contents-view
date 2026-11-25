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
  const statusStyle = status.isError ? "failed" : configured && !editing ? "success" : "neutral";

  return (
    <section className="flex min-h-[280px] flex-col rounded-md border border-slate-800 bg-slate-950/50 p-4">
      <div className="border-b border-slate-800 pb-4">
        <h3 className="text-sm font-semibold text-slate-100">쿠팡 파트너스</h3>
        <p className="mt-2 text-xs leading-5 text-slate-400">커머스 트렌드의 쿠팡 상품 조회에 사용하는 공용 키입니다.</p>
      </div>
      <form
        className="mypageApiKeyPanel mt-4"
        onSubmit={event => {
          event.preventDefault();
          if (!editing || busy || !accessKey.trim() || !secretKey.trim()) return;
          setError("");
          save.mutate({ accessKey, secretKey });
        }}
      >
        {(error || status.error?.message) && <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error || status.error?.message}</div>}
        <div className="apiCredentialFieldStack">
          <input type="password" autoComplete="off" className="mypageModalNameInput min-w-0" aria-label="쿠팡 Access Key" placeholder="Access Key" value={accessKey} onChange={event => setAccessKey(event.target.value)} maxLength={200} disabled={!editing || busy} required />
          <input type="password" autoComplete="new-password" className="mypageModalNameInput min-w-0" aria-label="쿠팡 Secret Key" placeholder="Secret Key" value={secretKey} onChange={event => setSecretKey(event.target.value)} maxLength={300} disabled={!editing || busy} required />
        </div>
        <p role="status" className={`mypageApiStatus ${statusStyle}`}>
          {status.isPending ? "쿠팡 파트너스 API 상태 확인 중" : status.isError ? "연동 상태 확인 불가" : editing ? "저장하면 쿠팡 파트너스 API 연결 확인이 진행됩니다." : configured ? "연결 완료" : "연결 필요"}
        </p>
        <div className="mypageModalActionRow">
          <button className="mypageModalEditButton mypageModalEditButtonSecondary" type="button" disabled={!editing || busy} onClick={clearForm}>취소</button>
          {editing ? (
            <button key="save" className="mypageModalEditButton" type="submit" disabled={busy || !accessKey.trim() || !secretKey.trim()}>{save.isPending ? "저장 중" : "저장"}</button>
          ) : (
            <button key="edit" className="mypageModalEditButton" type="button" disabled={busy || status.isPending || status.isError} onClick={() => { setError(""); setEditing(true); }}>{configured ? "수정" : "등록"}</button>
          )}
        </div>
        {configured && !editing && <button className="apiDeleteButton" type="button" disabled={busy} onClick={() => {
          if (window.confirm("쿠팡 파트너스 API 키를 삭제하시겠습니까?")) {
            setError("");
            remove.mutate();
          }
        }}>{remove.isPending ? "삭제 중" : "키 삭제"}</button>}
      </form>
    </section>
  );
}
