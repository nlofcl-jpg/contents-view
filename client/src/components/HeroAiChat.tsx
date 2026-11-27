import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Globe, LoaderCircle, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import HeroAnalysisResult from "@/components/HeroAnalysisResult";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { getHeroAnalysisRange, heroAnalysisLabels, type HeroAnalysisPlatform, type HeroAnalysisResult as AnalysisResult, type NaverKeywordResult } from "@/lib/heroAnalysis";
import { NAVER_GUEST_DAILY_LIMIT_MESSAGE, NAVER_MEMBER_DAILY_LIMIT_MESSAGE } from "@shared/naverAnalysisQuota";

type ChatText = { role: "user" | "assistant"; text: string };
type ChatMessage = ChatText & {
  sources?: { title: string; url: string }[];
};

type AnalysisRequest = { keyword: string; platform: HeroAnalysisPlatform };
type AnalysisMessage = AnalysisRequest & { role: "analysis"; result: AnalysisResult };

type HeroAiChatProps = {
  input: string;
  setInput: (value: string) => void;
  renderInput: (sendDisabled: boolean) => ReactNode;
  analysisPlatform?: HeroAnalysisPlatform;
  onClose: () => void;
  entryOrigin: DOMRectReadOnly | null;
};

export default function HeroAiChat({ input, setInput, renderInput, analysisPlatform, onClose, entryOrigin }: HeroAiChatProps) {
  const [messages, setMessages] = useState<(ChatMessage | AnalysisMessage)[]>([]);
  const [consent, setConsent] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [pendingAnalysis, setPendingAnalysis] = useState<AnalysisRequest | null>(null);
  const [headerPinned, setHeaderPinned] = useState(false);
  const headerTriggerRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const latestAnalysisRef = useRef<HTMLDivElement>(null);
  const status = trpc.aiTest.status.useQuery(undefined, { retry: false, enabled: !analysisPlatform });
  const chat = trpc.aiTest.chat.useMutation();
  const api = trpc.useUtils();
  const naverAnalysis = trpc.naver.unifiedInsight.useMutation();
  const shoppingAnalysis = trpc.naver.shoppingStatistics.useMutation();
  const busy = Boolean(pendingAnalysis || pendingQuestion || chat.isPending);
  const sendDisabled = !input.trim() || busy || (!analysisPlatform && status.isLoading);

  useLayoutEffect(() => {
    const form = formRef.current;
    if (!form || !entryOrigin || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const destination = form.getBoundingClientRect();
    if (!entryOrigin.width || !destination.width) return;

    // Align the new composer to the homepage input before animating to its final layout.
    const centerDelta = entryOrigin.left + entryOrigin.width / 2 - (destination.left + destination.width / 2);
    form.style.setProperty("--ai-entry-x", `${centerDelta}px`);
    form.style.setProperty("--ai-entry-y", `${entryOrigin.bottom - destination.bottom}px`);
    form.style.setProperty("--ai-entry-scale", String(entryOrigin.width / destination.width));
    form.classList.add("isEntering");
    return () => form.classList.remove("isEntering");
  }, [entryOrigin]);

  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    const latestAnalysis = latestAnalysisRef.current;
    if (latestAnalysis && !pendingQuestion && !pendingAnalysis) {
      log.scrollTop += latestAnalysis.getBoundingClientRect().top - log.getBoundingClientRect().top - 10;
    } else {
      log.scrollTop = log.scrollHeight;
    }
  }, [messages, pendingQuestion, pendingAnalysis]);

  useEffect(() => {
    if (!headerPinned) return;
    const header = document.getElementById("site-header");
    const dismissOnOutsidePress = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!header?.contains(event.target) && !headerTriggerRef.current?.contains(event.target)) {
        setHeaderPinned(false);
      }
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setHeaderPinned(false);
      headerTriggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", dismissOnOutsidePress);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOnOutsidePress);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [headerPinned]);

  const send = async () => {
    const question = input.trim();
    if (status.error || !status.data?.configured || !question || busy) return;
    setPendingQuestion(question);
    setInput("");
    const nextMessage: ChatMessage = { role: "user", text: question };
    const history: ChatText[] = [nextMessage];
    const chatMessages = messages.filter(message => message.role !== "analysis");
    let remaining = 16000 - question.length;
    for (let i = chatMessages.length - 2; i >= 0 && history.length < 11; i -= 2) {
      const pair = chatMessages.slice(i, i + 2).map(({ role, text }) => ({ role, text: text.slice(0, 4000) }));
      const length = pair[0].text.length + pair[1].text.length;
      if (length > remaining) break;
      remaining -= length;
      history.unshift(...pair);
    }
    try {
      const result = await chat.mutateAsync({ consent: true, messages: history });
      setMessages(previous => [...previous, nextMessage, {
        role: "assistant", text: result.reply, sources: result.sources,
      }]);
    } catch (cause) {
      if (logRef.current && !inputRef.current.trim()) setInput(question);
      if (logRef.current) toast.error(cause instanceof Error ? cause.message : "답변을 불러오지 못했습니다.");
    } finally {
      setPendingQuestion(null);
    }
  };

  const analyze = async (platform: HeroAnalysisPlatform) => {
    const keyword = input.trim().replace(/\s+/g, " ");
    const max = platform === "youtube" ? 120 : 100;
    if (keyword.length > max) {
      toast.error(`키워드는 ${max}자까지 입력할 수 있습니다.`);
      return;
    }
    setPendingAnalysis({ keyword, platform });
    setInput("");

    let result: AnalysisResult;
    try {
      const range = getHeroAnalysisRange();
      const request = { keywords: [keyword], ...range };
      switch (platform) {
        case "youtube":
          result = { kind: platform, data: await api.youtube.searchVideos.fetch({ query: keyword, regionCode: "KR", sortBy: "relevance", durationType: "all", maxResults: 50 }) };
          break;
        case "news":
          result = { kind: platform, data: await api.news.searchNews.fetch({ query: keyword, limit: 80 }) };
          break;
        case "naver":
          result = { kind: platform, data: await naverAnalysis.mutateAsync(request) as NaverKeywordResult, range };
          break;
        case "shopping":
          result = { kind: platform, data: await shoppingAnalysis.mutateAsync({ requests: [request], keywordForCategory: keyword, categoryFilters: range }), range };
          break;
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      const code = (cause as { data?: { code?: string } } | null)?.data?.code;
      const loginRequired = code === "UNAUTHORIZED" || message === NAVER_GUEST_DAILY_LIMIT_MESSAGE;
      result = {
        kind: "error",
        message: code === "UNAUTHORIZED" ? "로그인 후 이용할 수 있습니다."
          : loginRequired || message === NAVER_MEMBER_DAILY_LIMIT_MESSAGE ? message
          : "분석 결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        loginRequired,
      };
    }

    setMessages(previous => [...previous, { role: "analysis", keyword, platform, result }]);
    setPendingAnalysis(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (sendDisabled) return;
    if (analysisPlatform) {
      void analyze(analysisPlatform);
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
      <button
        ref={headerTriggerRef}
        type="button"
        className="heroAiHeaderTrigger"
        aria-label={headerPinned ? "사이트 메뉴 닫기" : "사이트 메뉴 열기"}
        aria-controls="site-header"
        aria-expanded={headerPinned}
        onClick={event => {
          if (event.detail > 0 && window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
          setHeaderPinned(!headerPinned);
          if (!headerPinned && event.detail === 0) {
            requestAnimationFrame(() => document.querySelector<HTMLButtonElement>("#site-header .headerBrand")?.focus());
          }
        }}
      />
      <button type="button" className="aiTestIcon heroAiClose" aria-label="AI 모드 닫기" title="AI 모드 닫기" onClick={onClose}>
        <X size={20} aria-hidden="true" />
      </button>
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
          {messages.map((message, index) => message.role === "analysis" ? (
            <div key={index} ref={index === messages.length - 1 ? latestAnalysisRef : undefined}>
              <div className="aiTestUserMessage"><span className="sr-only">나</span><p>{message.keyword}</p></div>
              <article className="aiTestReply min-w-0" aria-label={heroAnalysisLabels[message.platform]}>
                <h3 className="mb-3 text-sm font-semibold text-slate-100">{heroAnalysisLabels[message.platform]}</h3>
                <HeroAnalysisResult result={message.result} />
              </article>
            </div>
          ) : message.role === "user" ? (
            <div className="aiTestUserMessage" key={index}>
              <span className="sr-only">나</span>
              <p>{message.text}</p>
            </div>
          ) : (
            <article className="aiTestReply" aria-label="Gemini 답변" key={index}>
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
            </article>
          ))}
          {pendingQuestion && (
            <>
              <div className="aiTestUserMessage"><span className="sr-only">나</span><p>{pendingQuestion}</p></div>
              <div role="status" aria-label="답변을 작성하고 있습니다" className="text-blue-300">
                <LoaderCircle size={16} aria-hidden="true" className="motion-safe:animate-spin" />
              </div>
            </>
          )}
          {pendingAnalysis && (
            <>
              <div className="aiTestUserMessage"><span className="sr-only">나</span><p>{pendingAnalysis.keyword}</p></div>
              <div role="status" className="flex items-center gap-2 text-xs text-slate-400">
                <LoaderCircle size={16} aria-hidden="true" className="text-sky-300 motion-safe:animate-spin" />
                {heroAnalysisLabels[pendingAnalysis.platform]} 중
              </div>
            </>
          )}
        </div>
      </section>
      <div className="heroAiComposer">
        <form ref={formRef} className="heroSearch heroSearchAi" aria-label={analysisPlatform ? heroAnalysisLabels[analysisPlatform] : "Gemini 대화"} onSubmit={submit}>
          {renderInput(sendDisabled)}
        </form>
        <p className="aiTestFootnote">AI 답변은 부정확할 수 있습니다.</p>
      </div>
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
    </section>
  );
}
