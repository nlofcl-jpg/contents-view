import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type SpeechResultEvent = Event & {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

function getSpeechRecognition() {
  if (typeof window === "undefined" || !window.isSecureContext) return undefined;
  const speechWindow = window as Window & {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function releaseRecognition(recognition: BrowserSpeechRecognition) {
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
  recognition.abort();
}

export default function VoiceSearchButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const session = useRef<BrowserSpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const SpeechRecognition = getSpeechRecognition();

  useEffect(() => () => {
    if (session.current) releaseRecognition(session.current);
    session.current = null;
  }, []);

  if (!SpeechRecognition) return null;

  const toggleVoiceInput = () => {
    if (session.current) {
      try {
        session.current.stop();
      } catch {
        releaseRecognition(session.current);
        session.current = null;
        setIsListening(false);
      }
      return;
    }

    let recognition: BrowserSpeechRecognition;
    try {
      recognition = new SpeechRecognition();
    } catch {
      toast.error("음성 입력을 사용할 수 없어요. 검색어를 직접 입력해 주세요.");
      return;
    }
    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = event => {
      const transcript = event.results[event.resultIndex]?.[0]?.transcript.trim();
      if (transcript) onTranscript(transcript);
    };
    recognition.onerror = event => {
      if (event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        toast.error("브라우저에서 마이크 사용을 허용해 주세요.");
      } else if (event.error === "no-speech") {
        toast.error("음성이 감지되지 않았어요. 다시 말해 주세요.");
      } else {
        toast.error("음성 입력을 사용할 수 없어요. 검색어를 직접 입력해 주세요.");
      }
    };
    recognition.onend = () => {
      if (session.current !== recognition) return;
      session.current = null;
      setIsListening(false);
    };

    try {
      session.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      session.current = null;
      releaseRecognition(recognition);
      toast.error("음성 입력을 시작할 수 없어요. 검색어를 직접 입력해 주세요.");
    }
  };

  const label = isListening ? "음성 입력 종료" : "음성 입력";

  return (
    <button
      type="button"
      className={`heroSearchFilterButton isUnselected ${isListening ? "ring-1 ring-blue-400/50" : ""}`}
      aria-label="음성 입력"
      aria-pressed={isListening}
      title={label}
      onClick={toggleVoiceInput}
    >
      {isListening ? <Square size={13} aria-hidden="true" /> : <Mic size={17} aria-hidden="true" />}
    </button>
  );
}
