import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Globe, LoaderCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";

type ChatText = { role: "user" | "assistant"; text: string };
type Message = ChatText & {
  sources?: { title: string; url: string }[];
  searchSuggestions?: string | null;
};

type HeroAiChatProps = {
  input: string;
  setInput: (value: string) => void;
  renderInput: (sendDisabled: boolean) => ReactNode;
  onAnalyze?: () => void;
};

export default function HeroAiChat({ input, setInput, renderInput, onAnalyze }: HeroAiChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [consent, setConsent] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [analysisConfirmOpen, setAnalysisConfirmOpen] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const status = trpc.aiTest.status.useQuery(undefined, { retry: false });
  const chat = trpc.aiTest.chat.useMutation();
  const busy = chat.isPending;
  const sendDisabled = !input.trim() || (!onAnalyze && (busy || status.isLoading));

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, pendingQuestion]);

  const send = async () => {
    const question = input.trim();
    if (status.error || !status.data?.configured || !question || busy) return;
    setPendingQuestion(question);
    setInput("");
    const nextMessage: Message = { role: "user", text: question };
    const history: ChatText[] = [nextMessage];
    let remaining = 16000 - question.length;
    for (let i = messages.length - 2; i >= 0 && history.length < 11; i -= 2) {
      const pair = messages.slice(i, i + 2).map(({ role, text }) => ({ role, text: text.slice(0, 4000) }));
      const length = pair[0].text.length + pair[1].text.length;
      if (length > remaining) break;
      remaining -= length;
      history.unshift(...pair);
    }
    try {
      const result = await chat.mutateAsync({ consent: true, messages: history });
      setMessages(previous => [...previous, nextMessage, {
        role: "assistant", text: result.reply, sources: result.sources, searchSuggestions: result.searchSuggestions,
      }]);
    } catch (cause) {
      if (logRef.current && !inputRef.current.trim()) setInput(question);
      if (logRef.current) toast.error(cause instanceof Error ? cause.message : "답변을 불러오지 못했습니다.");
    } finally {
      setPendingQuestion(null);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (sendDisabled) return;
    if (onAnalyze) {
      setAnalysisConfirmOpen(true);
      return;
    }
    if (status.error || !status.data?.configured) {
      toast.error(status.error?.data?.code === "FORBIDDEN"
        ? "AI 모드의 질문 전송은 관리자만 이용할 수 있습니다."
        : "Gemini에 연결할 수 없습니다. 연결 설정을 확인해 주세요.");
      return;
    }
    if (!consent) {
      setConsentOpen(true);
      return;
    }
    void send();
  };

  const inputRef = useRef(input);
  useEffect(() => { inputRef.current = input; }, [input]);

  const restoreInputFocus = (event: Event) => {
    event.preventDefault();
    formRef.current?.querySelector("textarea")?.focus();
  };

  return (
    <section className="heroAiPage" aria-label="AI 대화">
      <section className="heroAiChatPanel" aria-label="AI 모드">
        <header className="aiTestHeader">
          <p className="m-0 flex items-center gap-1.5 text-sm font-semibold">
            AI 모드
            <span className="inline-grid h-4 place-items-center rounded border border-sky-400/30 bg-sky-400/10 px-1 text-[10px] font-medium leading-none text-sky-300">Test</span>
          </p>
          <div className="flex items-center gap-1">
            <button type="button" title="Google 웹검색 사용 불가" aria-label="Google 웹검색 사용 불가" disabled className="aiTestIcon">
              <Globe size={15} aria-hidden="true" />
            </button>
            <button type="button" title="대화 초기화" aria-label="대화 초기화" disabled={busy} onClick={() => { setMessages([]); setInput(""); }} className="aiTestIcon">
              <RotateCcw size={15} aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="aiTestLog" ref={logRef} role="log" aria-label="Gemini 테스트 대화" aria-live="polite">
          {messages.map((message, index) => (
            <div className={`aiTestMessage ${message.role === "user" ? "isUser" : "isAssistant"}`} key={index}>
              <span className="sr-only">{message.role === "user" ? "나" : "Gemini"}</span>
              <p>{message.text}</p>
              {Boolean(message.sources?.length) && (
                <ul className="mt-3 space-y-1.5 text-xs" aria-label="Google 검색 출처">
                  {message.sources?.map(({ title, url }) => (
                    <li className="break-words" key={url}>
                      <a className="text-blue-300 underline underline-offset-2" href={url} target="_blank" rel="noopener noreferrer">{title}</a>
                    </li>
                  ))}
                </ul>
              )}
              {message.searchSuggestions && (
                <iframe
                  title="Google 추천 검색어"
                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                  referrerPolicy="no-referrer"
                  className="mt-2 block h-[95px] w-full border-0"
                  srcDoc={`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https://www.gstatic.com"><base target="_blank"><body style="margin:0">${message.searchSuggestions}</body>`}
                />
              )}
            </div>
          ))}
          {pendingQuestion && (
            <>
              <div className="aiTestMessage isUser"><span className="sr-only">나</span><p>{pendingQuestion}</p></div>
              <div role="status" aria-label="답변을 작성하고 있습니다" className="text-blue-300">
                <LoaderCircle size={16} aria-hidden="true" className="motion-safe:animate-spin" />
              </div>
            </>
          )}
        </div>
      </section>
      <form ref={formRef} className="heroSearch heroSearchAi" aria-label={onAnalyze ? "트렌드 분석" : "Gemini 대화"} onSubmit={submit}>
        {renderInput(sendDisabled)}
        <p className="aiTestFootnote">AI 답변은 부정확할 수 있습니다.</p>
      </form>
    <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
      <DialogContent onCloseAutoFocus={restoreInputFocus}>
        <DialogHeader>
          <DialogTitle className="sr-only">AI 이용 동의</DialogTitle>
          <DialogDescription>
            질문과 최근 대화가 Google Gemini에 전송됩니다. 개인정보나 API 키는 입력하지 마세요.
            <span className="mt-2 block">대화는 DB에 저장되지 않습니다.</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mx-auto grid w-full max-w-52 grid-cols-2">
          <Button type="button" variant="outline" onClick={() => setConsentOpen(false)}>취소</Button>
          <Button type="button" onClick={() => { setConsent(true); setConsentOpen(false); void send(); }}>동의</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
      <AlertDialog open={analysisConfirmOpen} onOpenChange={setAnalysisConfirmOpen}>
        <AlertDialogContent className="sm:max-w-sm" onCloseAutoFocus={restoreInputFocus}>
          <AlertDialogHeader className="sm:text-center">
            <AlertDialogTitle>분석 화면으로 이동할까요?</AlertDialogTitle>
            <AlertDialogDescription>이동하면 현재 AI 대화가 모두 삭제됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mx-auto grid w-full max-w-52 grid-cols-2">
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => onAnalyze?.()}>확인</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
