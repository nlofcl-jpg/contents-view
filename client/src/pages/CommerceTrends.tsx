import { useState } from "react";
import { Search } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import VoiceSearchButton from "@/components/VoiceSearchButton";
import { useNaverTrendComparison } from "@/components/NaverTrendComparison";
import { NAVER_GUEST_DAILY_LIMIT_MESSAGE, NAVER_MEMBER_DAILY_LIMIT_MESSAGE } from "@shared/naverAnalysisQuota";

export default function CommerceTrends() {
  const [, navigate] = useLocation();
  const { loading: authLoading } = useAuth();
  const [guestPromptOpen, setGuestPromptOpen] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");
  const { renderPanel, submitComparisonKeyword, isTrendFilterLoading } = useNaverTrendComparison({
    authLoading,
    metric: "shopping",
    onError: (error, fallback) => {
      const message = error instanceof Error ? error.message : "";
      if (message === NAVER_GUEST_DAILY_LIMIT_MESSAGE) {
        setGuestPromptOpen(true);
        return "";
      }
      return message === NAVER_MEMBER_DAILY_LIMIT_MESSAGE ? message : fallback;
    },
  });

  const goToAuth = (mode: "login" | "signup") => {
    const params = new URLSearchParams({ redirect: "/commerce" });
    if (mode === "signup") params.set("mode", "signup");
    setGuestPromptOpen(false);
    navigate(`/login?${params.toString()}`);
  };

  return (
    <div className="youtubePageContainer commerceTrendPage min-h-full">
      <div className="pageHeader">
        <h1 className="pageTitle">
          커머스 트렌드 <span className="ml-1 align-middle text-xs font-normal tracking-normal text-slate-400/70">Test</span>
        </h1>
      </div>
      <div className="tabMenu youtubeTabMenu" role="group" aria-label="커머스 트렌드 선택">
        <button type="button" className="tabButton active" aria-pressed="true">
          쇼핑 트렌드 비교
        </button>
      </div>
      <form
        className="heroSearch naverAnalysisComposer commerceAnalysisComposer"
        role="search"
        aria-label="쇼핑 트렌드 비교 분석"
        onSubmit={async event => {
          event.preventDefault();
          const input = keywordInput;
          if (await submitComparisonKeyword(input)) {
            setKeywordInput(current => current === input ? "" : current);
          }
        }}
      >
        <input
          type="search"
          value={keywordInput}
          onChange={event => setKeywordInput(event.target.value)}
          placeholder="비교할 검색어 입력"
          aria-label="비교할 검색어"
          autoComplete="off"
          maxLength={100}
          className="heroSearchInput"
        />
        <div className="flex items-center gap-1">
          {!isTrendFilterLoading && <VoiceSearchButton onTranscript={text => setKeywordInput(value =>
            [value.trimEnd(), text].filter(Boolean).join(" ").slice(0, 100)
          )} />}
          <button type="submit" className="heroSearchButton" aria-label="분석" title="분석" disabled={authLoading || isTrendFilterLoading || !keywordInput.trim()}>
            <Search size={18} aria-hidden="true" />
          </button>
        </div>
      </form>
      {renderPanel()}
      <GuestAccessPrompt
        open={guestPromptOpen}
        description={NAVER_GUEST_DAILY_LIMIT_MESSAGE}
        onBrowse={() => setGuestPromptOpen(false)}
        onLogin={() => goToAuth("login")}
        onSignup={() => goToAuth("signup")}
      />
    </div>
  );
}
