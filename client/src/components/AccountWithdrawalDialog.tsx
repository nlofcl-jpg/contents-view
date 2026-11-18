import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { supabase, setSupabaseAccessTokenCookie } from "@/lib/supabase";
import { ACCOUNT_WITHDRAWAL_CONFIRMATION, canWithdrawAccount } from "@shared/accountWithdrawal";

export default function AccountWithdrawalDialog({ onClose }: { onClose: () => void }) {
  const [confirmation, setConfirmation] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const mutation = trpc.user.withdraw.useMutation();
  const queryClient = useQueryClient();

  const handleWithdraw = async () => {
    if (isSubmitting || isComposing || !canWithdrawAccount(confirmation)) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await mutation.mutateAsync({ confirmation: ACCOUNT_WITHDRAWAL_CONFIRMATION });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "탈퇴하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setIsSubmitting(false);
      return;
    }
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase?.auth.signOut({ scope: "local" });
    } finally {
      setSupabaseAccessTokenCookie(null);
      try { window.localStorage.removeItem("contents-view-user-info"); } catch { /* Storage may be unavailable. */ }
      window.location.replace("/");
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open && !isSubmitting) onClose(); }}>
      <DialogContent
        overlayClassName="z-[11000]"
        className="accountWithdrawalDialog z-[11001] max-w-[400px] rounded-lg text-white"
        showCloseButton={!isSubmitting}
        onOpenAutoFocus={event => { event.preventDefault(); cancelRef.current?.focus(); }}
        onEscapeKeyDown={event => { if (isSubmitting) event.preventDefault(); }}
        onPointerDownOutside={event => { if (isSubmitting) event.preventDefault(); }}
      >
        <DialogTitle>회원 탈퇴</DialogTitle>
        <DialogDescription className="text-sm leading-6 text-slate-300">
          탈퇴하면 회원 정보, 보관함과 등록한 API 키가 삭제되며 복구할 수 없습니다.
          법령에 따라 보관해야 하는 정보는 개인정보처리방침에 따라 처리됩니다.
          Google 계정이나 외부 플랫폼의 원본 콘텐츠는 삭제되지 않습니다.
        </DialogDescription>
        <div className="grid gap-2">
          <label htmlFor="account-withdrawal-confirmation" className="text-sm text-slate-300">
            계속하려면 아래에 <strong className="text-white">회원탈퇴</strong>를 입력해 주세요.
          </label>
          <input
            id="account-withdrawal-confirmation"
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder="회원탈퇴"
            autoComplete="off"
            spellCheck={false}
            disabled={isSubmitting}
            className="h-10 w-full rounded-md border border-slate-600 bg-slate-800 px-3 text-sm text-white outline-none focus:border-blue-400 disabled:opacity-50"
          />
        </div>
        {error && <p role="alert" className="text-sm leading-5 text-rose-300">{error}</p>}
        <div className="mt-1 flex justify-center gap-2">
          <button ref={cancelRef} type="button" disabled={isSubmitting} onClick={onClose} className="h-9 rounded-md border border-slate-600 px-4 text-sm hover:bg-slate-800 disabled:opacity-50">취소</button>
          <button type="button" disabled={isSubmitting || isComposing || !canWithdrawAccount(confirmation)} onClick={handleWithdraw} className="h-9 rounded-md bg-rose-600 px-4 text-sm font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">
            {isSubmitting ? "탈퇴 처리 중..." : "탈퇴하기"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
