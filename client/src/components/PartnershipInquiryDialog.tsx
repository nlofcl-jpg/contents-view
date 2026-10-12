import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";

type PartnershipInquiryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function PartnershipInquiryDialog({ open, onOpenChange }: PartnershipInquiryDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const submit = trpc.partnership.submit.useMutation();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    try {
      await submit.mutateAsync({ name, phone, email, message });
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "문의 접수에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (submit.isPending) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setName("");
      setPhone("");
      setEmail("");
      setMessage("");
      setError("");
      setSubmitted(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[440px] rounded-md border border-slate-700 bg-[#101b2d] p-6 text-white shadow-2xl">
        <DialogTitle className="text-lg font-semibold">제휴 문의</DialogTitle>
        <DialogDescription className="text-sm text-slate-400">
          문의를 남겨주시면 확인 후 입력하신 연락처로 답변드리겠습니다.
        </DialogDescription>
        {submitted ? (
          <p role="status" className="rounded-md border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-100">문의가 접수되었습니다.</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-2 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="partnership-name" className="text-sm text-slate-200">이름 (상호명)</label>
              <input id="partnership-name" value={name} onChange={event => setName(event.target.value)} autoComplete="organization" maxLength={100} required className="w-full rounded-md border border-slate-600 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="partnership-phone" className="text-sm text-slate-200">연락처</label>
              <input id="partnership-phone" type="tel" value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel" minLength={7} maxLength={30} required className="w-full rounded-md border border-slate-600 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="partnership-email" className="text-sm text-slate-200">이메일</label>
              <input id="partnership-email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" maxLength={254} required className="w-full rounded-md border border-slate-600 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="partnership-message" className="text-sm text-slate-200">문의 내용</label>
              <textarea id="partnership-message" value={message} onChange={event => setMessage(event.target.value)} minLength={10} maxLength={5000} rows={5} required className="w-full resize-y rounded-md border border-slate-600 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400" />
            </div>
            {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
            <button type="submit" disabled={submit.isPending} className="h-10 w-full rounded-md bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60">
              {submit.isPending ? "제출 중..." : "제출"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
