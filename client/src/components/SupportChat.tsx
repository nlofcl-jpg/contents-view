import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, MessageCircle, RotateCcw, Send, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import PartnershipInquiryDialog from "@/components/PartnershipInquiryDialog";
import { getSupportReply, supportQuestions, type SupportReply } from "@/lib/supportGuide";

type Message = SupportReply & { id: number; role: "user" | "assistant" };
const welcome: Message = {
  id: 0,
  role: "assistant",
  text: "안녕하세요. 컨텐츠뷰 이용 도우미입니다.\n궁금한 메뉴를 선택하거나 질문을 입력해 주세요.",
};

export default function SupportChat() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const latestReplyRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useLayoutEffect(() => {
    const launcher = launcherRef.current;
    const footer = document.querySelector<HTMLElement>(".siteFooter");
    const scroller = document.querySelector<HTMLElement>(".mainContent");
    if (!launcher || !footer || !scroller) return;
    let frame = 0;
    const update = () => {
      const footerTop = footer.getBoundingClientRect().top;
      const bottom = parseFloat(getComputedStyle(launcher).bottom) || 0;
      const lift = Math.max(0, window.innerHeight - footerTop + 12 - bottom);
      launcher.style.transform = `translateY(-${lift}px)`;
      launcher.style.visibility = footerTop < launcher.offsetHeight + 12 ? "hidden" : "visible";
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(footer);
    observer.observe(scroller);
    for (const child of Array.from(scroller.children)) observer.observe(child);
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [location]);

  const close = () => {
    setOpen(false);
    launcherRef.current?.focus();
  };

  useEffect(() => {
    const log = logRef.current;
    const reply = latestReplyRef.current;
    if (!open || !log || !reply) return;
    log.scrollTop += reply.getBoundingClientRect().top - log.getBoundingClientRect().top - 16;
  }, [open, messages]);

  useEffect(() => {
    if (!open || inquiryOpen) return;
    inputRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, inquiryOpen]);

  const ask = (question: string) => {
    const value = question.trim().slice(0, 500);
    if (!value) return;
    const userId = nextId.current++;
    const replyId = nextId.current++;
    setMessages(previous => [...previous, { id: userId, role: "user", text: value }, { id: replyId, role: "assistant", ...getSupportReply(value) }]);
    setInput("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    ask(input);
  };

  return (
    <>
      {open && (
        <section id="support-chat-panel" className="supportChat" role="dialog" aria-modal="false" aria-labelledby="support-chat-title">
          <header className="supportChatHeader">
            <div className="supportChatAvatar" aria-hidden="true"><MessageCircle size={20} /></div>
            <div className="supportChatHeading">
              <h2 id="support-chat-title">컨텐츠뷰 도우미</h2>
              <span><i aria-hidden="true" />이용 안내</span>
            </div>
            <button type="button" className="supportChatIconButton" title="대화 초기화" aria-label="대화 초기화" onClick={() => { setMessages([welcome]); setInput(""); }}><RotateCcw size={16} /></button>
            <button type="button" className="supportChatIconButton" title="채팅 닫기" aria-label="채팅 닫기" onClick={close}><X size={19} /></button>
          </header>

          <div ref={logRef} className="supportChatLog" role="log" aria-label="이용 안내 대화" aria-live="polite" aria-relevant="additions">
            <p className="supportChatPrivacy">비밀번호·API 키 등 민감한 정보는 입력하지 마세요.</p>
            {messages.map(message => (
              <div key={message.id} ref={message.role === "assistant" && message.id === messages[messages.length - 1].id ? latestReplyRef : undefined} className={`supportChatMessage ${message.role}`}>
                {message.role === "assistant" && <span className="supportChatSender">CONTENTS VIEW</span>}
                <div className="supportChatBubble">{message.text}</div>
                {message.questions && (
                  <div className="supportChatTopics" aria-label="추가 사용법 선택">
                    {message.questions.map(question => <button type="button" key={question} onClick={() => ask(question)}>{question}</button>)}
                  </div>
                )}
                {message.actions && (
                  <div className="supportChatLinks">
                    {message.actions.map(action => "inquiry" in action ? (
                      <button type="button" key={action.label} onClick={() => setInquiryOpen(true)}>{action.label}<ArrowUpRight size={13} /></button>
                    ) : action.href.startsWith("/") ? (
                      <Link key={action.label} href={action.href}>{action.label}<ArrowUpRight size={13} /></Link>
                    ) : (
                      <a key={action.label} href={action.href}>{action.label}<ArrowUpRight size={13} /></a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="supportChatQuestions" aria-label="자주 묻는 질문">
            {supportQuestions.map(question => <button type="button" key={question} onClick={() => ask(question)}>{question}</button>)}
          </div>
          <form className="supportChatForm" onSubmit={submit}>
            <input ref={inputRef} value={input} onChange={event => setInput(event.target.value)} maxLength={500} placeholder="궁금한 이용 방법을 입력하세요" aria-label="이용 안내 질문" />
            <button type="submit" disabled={!input.trim()} title="질문 보내기" aria-label="질문 보내기"><Send size={18} /></button>
          </form>
          <p className="supportChatFootnote">기본 안내 · 대화 내용은 서버에 저장되지 않습니다.</p>
        </section>
      )}
      <button ref={launcherRef} type="button" className="supportChatLauncher" aria-label={open ? "이용 안내 채팅 닫기" : "이용 안내 채팅 열기"} aria-expanded={open} aria-controls={open ? "support-chat-panel" : undefined} title="컨텐츠뷰 이용 안내" onClick={() => open ? close() : setOpen(true)}>
        {open ? <X size={23} /> : <MessageCircle size={24} />}
      </button>
      <PartnershipInquiryDialog open={inquiryOpen} onOpenChange={setInquiryOpen} />
    </>
  );
}
