import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  PARTNERSHIP_CONSENT_VERSION,
  PARTNERSHIP_COLLECTION_NOTICE,
  PARTNERSHIP_TRANSFER_NOTICE,
} from "@shared/partnershipConsent";

type PartnershipInquiryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function PartnershipInquiryDialog({
  open,
  onOpenChange,
}: PartnershipInquiryDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [overseasConsent, setOverseasConsent] = useState(false);
  const submit = trpc.partnership.submit.useMutation();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!privacyConsent || !overseasConsent) {
      setError(
        "개인정보 수집·이용 및 국외 이전 안내를 확인하고 각각 동의해 주세요."
      );
      return;
    }
    try {
      await submit.mutateAsync({
        name,
        phone,
        email,
        message,
        privacyConsent: true,
        overseasConsent: true,
        consentVersion: PARTNERSHIP_CONSENT_VERSION,
      });
      setSubmitted(true);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "문의 접수에 실패했습니다. 다시 시도해 주세요."
      );
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
      setPrivacyConsent(false);
      setOverseasConsent(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        overlayClassName="z-[10090]"
        className="z-[10100] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[440px] overflow-y-auto rounded-md border border-slate-700 bg-[#101b2d] p-6 text-white shadow-2xl sm:max-w-[440px]"
      >
        <DialogTitle className="text-lg font-semibold">제휴 문의</DialogTitle>
        <DialogDescription className="text-sm text-slate-400">
          문의를 남겨주시면 확인 후 입력하신 연락처로 답변드리겠습니다.
        </DialogDescription>
        {submitted ? (
          <p
            role="status"
            className="rounded-md border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-100"
          >
            문의가 접수되었습니다.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-2 space-y-4"
            aria-busy={submit.isPending}
          >
            <fieldset disabled={submit.isPending} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="partnership-name"
                  className="text-sm text-slate-200"
                >
                  이름 (상호명)
                </label>
                <input
                  id="partnership-name"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  autoComplete="organization"
                  maxLength={100}
                  required
                  className="w-full rounded-md border border-slate-600 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="partnership-phone"
                  className="text-sm text-slate-200"
                >
                  연락처
                </label>
                <input
                  id="partnership-phone"
                  type="tel"
                  value={phone}
                  onChange={event => setPhone(event.target.value)}
                  autoComplete="tel"
                  minLength={7}
                  maxLength={30}
                  required
                  className="w-full rounded-md border border-slate-600 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="partnership-email"
                  className="text-sm text-slate-200"
                >
                  이메일
                </label>
                <input
                  id="partnership-email"
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  autoComplete="email"
                  maxLength={254}
                  required
                  className="w-full rounded-md border border-slate-600 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="partnership-message"
                  className="text-sm text-slate-200"
                >
                  문의 내용
                </label>
                <textarea
                  id="partnership-message"
                  value={message}
                  onChange={event => setMessage(event.target.value)}
                  minLength={10}
                  maxLength={5000}
                  rows={5}
                  required
                  className="w-full resize-y rounded-md border border-slate-600 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400"
                />
              </div>
              <div className="space-y-3 border-t border-slate-700 pt-4 text-xs leading-relaxed text-slate-300">
                <details open>
                  <summary className="cursor-pointer font-medium text-slate-100">
                    개인정보 수집·이용 안내
                  </summary>
                  <dl className="mt-2 space-y-1">
                    <div>
                      <dt className="inline">수집 주체: </dt>
                      <dd className="inline">
                        {PARTNERSHIP_COLLECTION_NOTICE.controller}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">목적: </dt>
                      <dd className="inline">
                        {PARTNERSHIP_COLLECTION_NOTICE.purpose}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">항목: </dt>
                      <dd className="inline">
                        {PARTNERSHIP_COLLECTION_NOTICE.items}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">보유기간: </dt>
                      <dd className="inline">
                        {PARTNERSHIP_COLLECTION_NOTICE.retention}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2">
                    {PARTNERSHIP_COLLECTION_NOTICE.refusal}
                  </p>
                </details>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-100">
                  <input
                    type="checkbox"
                    required
                    checked={privacyConsent}
                    onChange={event => setPrivacyConsent(event.target.checked)}
                    className="mt-1 size-4 shrink-0 accent-blue-500"
                  />
                  <span>[필수] 개인정보 수집·이용에 동의합니다.</span>
                </label>
                <details open>
                  <summary className="cursor-pointer font-medium text-slate-100">
                    개인정보 국외 이전 안내
                  </summary>
                  <dl className="mt-2 space-y-1 break-words">
                    <div>
                      <dt className="inline">이전받는 자: </dt>
                      <dd className="inline">
                        {PARTNERSHIP_TRANSFER_NOTICE.recipient}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">국가: </dt>
                      <dd className="inline">
                        {PARTNERSHIP_TRANSFER_NOTICE.country}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">항목: </dt>
                      <dd className="inline">
                        {PARTNERSHIP_TRANSFER_NOTICE.items}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">목적: </dt>
                      <dd className="inline">
                        {PARTNERSHIP_TRANSFER_NOTICE.purpose}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">시기·방법: </dt>
                      <dd className="inline">
                        {PARTNERSHIP_TRANSFER_NOTICE.method}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">보유 기준: </dt>
                      <dd className="inline">
                        {PARTNERSHIP_TRANSFER_NOTICE.retention}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2">{PARTNERSHIP_TRANSFER_NOTICE.refusal}</p>
                </details>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-100">
                  <input
                    type="checkbox"
                    required
                    checked={overseasConsent}
                    onChange={event => setOverseasConsent(event.target.checked)}
                    className="mt-1 size-4 shrink-0 accent-blue-500"
                  />
                  <span>[필수] 위 개인정보 국외 이전에 동의합니다.</span>
                </label>
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sky-300 underline underline-offset-2"
                >
                  개인정보처리방침
                </a>
              </div>
            </fieldset>
            {error && (
              <p role="alert" className="text-sm text-rose-300">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submit.isPending || !privacyConsent || !overseasConsent}
              className="h-10 w-full rounded-md bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submit.isPending ? "제출 중..." : "제출"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
